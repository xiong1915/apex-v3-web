import { trustedClientBucket, extractClientIp } from '@/lib/auth/client-ip';
import { recordAIChatLog } from '@/lib/admin/ai-chat-logs';
import { after } from 'next/server';
import { NextRequest, NextResponse } from 'next/server';
import { defaultAIOrchestrator } from '@/lib/ai/orchestrator';
import { AIMessage } from '@/lib/ai/types';
import { getStorageInfo, getRateLimitStore } from '@/lib/storage';
import { MemoryRateLimitStore } from '@/lib/storage/memory';
import { getServerUser } from '@/lib/auth/server';
import { recordAIRateLimitHit, recordAIRequestStart, recordAITokenUsage } from '@/lib/admin/service';
import { recordAIOutcome } from '@/lib/admin/ai-monitor';

export const dynamic = 'force-dynamic';

const memoryFallbackLimiter = new MemoryRateLimitStore();


async function checkRateLimit(clientIp: string, userId: string): Promise<{ allowed: boolean; retryAfter: number; reason?: string }> {
  try {
    if ((process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') && !getStorageInfo().persistent) return {allowed:false,retryAfter:60,reason:'全站额度服务暂不可用，请稍后重试'};
    const limiter = getRateLimitStore();
    const account = await limiter.checkRateLimit(`ai:user:${userId}`, 60, 3600);
    if (!account.allowed) return {allowed:false,retryAfter:Math.max(1,Math.ceil((account.resetAt-Date.now())/1000)),reason:'当前账号已达到小时使用额度，请稍后重试'};

    // 1. 全局小时总使用量保护 (600次/小时, 跨实例由 Redis INCR 原子保证)
    const globalRes = await limiter.checkRateLimit('ai:global:hourly', 600, 3600);
    if (!globalRes.allowed) {
      const retryAfter = Math.max(1, Math.ceil((globalRes.resetAt - Date.now()) / 1000));
      return {
        allowed: false,
        retryAfter,
        reason: '服务当前调用量较高，已启用总额度保护，请稍后重试'
      };
    }

    // 2. 单客户端 IP 频次限制 (15次/分钟, 跨实例由 Redis INCR 原子保证)
    const ipRes = await limiter.checkRateLimit(`ai:ip:${clientIp}`, 15, 60);
    if (!ipRes.allowed) {
      const retryAfter = Math.max(1, Math.ceil((ipRes.resetAt - Date.now()) / 1000));
      return {
        allowed: false,
        retryAfter,
        reason: '请求过于频繁，请稍后再试'
      };
    }

    return { allowed: true, retryAfter: 0 };
  } catch (storeErr) {
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') return {allowed:false,retryAfter:60,reason:'额度服务暂不可用，请稍后重试'};
    console.warn('[RateLimit] RateLimitStore check error, safe fail-open fallback with strict memory limiter:', storeErr);
    try {
      // Redis 异常时自动降级至内存限流器，彻底杜绝无限制放行风险
      const globalRes = await memoryFallbackLimiter.checkRateLimit('ai:global:hourly', 600, 3600);
      if (!globalRes.allowed) {
        return {
          allowed: false,
          retryAfter: Math.max(1, Math.ceil((globalRes.resetAt - Date.now()) / 1000)),
          reason: '服务当前调用量较高，已启用总额度保护，请稍后重试'
        };
      }

      const ipRes = await memoryFallbackLimiter.checkRateLimit(`ai:ip:${clientIp}`, 15, 60);
      if (!ipRes.allowed) {
        return {
          allowed: false,
          retryAfter: Math.max(1, Math.ceil((ipRes.resetAt - Date.now()) / 1000)),
          reason: '请求过于频繁，请稍后再试'
        };
      }

      return { allowed: true, retryAfter: 0 };
    } catch (_) {
      // 降级兜底失败时坚决 fail-closed，绝不允许无限放行
      return {
        allowed: false,
        retryAfter: 60,
        reason: '限流服务保护中，请稍后重试'
      };
    }
  }
}

function sanitizeErrorMessage(err: any): string {
  if (err?.name === 'AbortError' || err?.message === 'REQUEST_TIMEOUT') {
    return '请求超时，上游模型响应耗时过长，请稍后重试';
  }
  const msg = String(err?.message || '');
  if (/key|token|auth|bearer|secret|password|credential/i.test(msg)) {
    return '服务响应异常，请稍后重试';
  }
  return msg || '服务响应异常，请稍后重试';
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  try {
    // 0. 服务端身份验证：未登录或未验证邮箱用户直接阻断，绝不调用 DeepSeek
    const user = await getServerUser(req);
    if (!user) {
      return NextResponse.json(
        { error: '未登录用户无法调用 AI 服务，请先登录' },
        { status: 401 }
      );
    }

    const expectedOwner = req.headers.get('x-apex-history-owner');
    if (expectedOwner && expectedOwner !== user.id) return NextResponse.json({error:'账号已变化，请刷新后重试'}, {status:409,headers:{'Cache-Control':'private, no-store'}});
    if (!user.email_confirmed_at) {
      return NextResponse.json(
        { error: '未经验证邮箱的用户无法调用 AI 服务，请先完成邮箱验证' },
        { status: 403 }
      );
    }

    const clientIp = trustedClientBucket(req.headers);
    const realIp = extractClientIp(req.headers);
    const userAgent = req.headers.get('user-agent') || undefined;
    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json({ error: '无效的 JSON 请求体' }, { status: 400 });
    }

    let messages: AIMessage[] = [];
    if (Array.isArray(body.messages)) {
      messages = body.messages;
    } else if (typeof body.message === 'string') {
      messages = [{ role: 'user', content: body.message }];
    } else {
      return NextResponse.json({ error: '请提供有效的 message 或 messages 数组' }, { status: 400 });
    }

    // 1. 消息数量校验
    if (messages.length === 0) {
      return NextResponse.json({ error: '消息内容不能为空' }, { status: 400 });
    }
    if (messages.length > 20) {
      return NextResponse.json({ error: '上下文消息数量超过上限 (最多 20 条)' }, { status: 400 });
    }

    // 2. 校验消息角色、单条输入上限与总上下文上限
    let totalLength = 0;
    for (const msg of messages) {
      if (msg.role !== 'user' && msg.role !== 'assistant') {
        return NextResponse.json({ error: '非法消息角色，不允许通过 system 或 developer 角色覆盖系统指令' }, { status: 400 });
      }
      if (typeof msg.content !== 'string' || msg.content.trim().length === 0) {
        return NextResponse.json({ error: '单条消息内容不能为空' }, { status: 400 });
      }
      if (msg.content.length > 1000) {
        return NextResponse.json({ error: '单条输入内容长度超过上限 (最多 1000 字符)' }, { status: 400 });
      }
      totalLength += msg.content.length;
    }

    if (totalLength > 4000) {
      return NextResponse.json({ error: '总上下文长度超过上限 (最多 4000 字符)' }, { status: 400 });
    }

    // 3. 服务端限流与使用量保护 (基于持久化设施与原子递增)
    const rateCheck = await checkRateLimit(clientIp, user.id);
    if (!rateCheck.allowed) {
      await recordAIRateLimitHit().catch(() => {});
      return NextResponse.json(
        { error: rateCheck.reason, retryAfter: rateCheck.retryAfter },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateCheck.retryAfter),
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // 4. 记录有效 AI 提问请求 (APEX Control 真实监控统计)
    after(() => recordAIRequestStart().catch(() => {}));

    const wantStream = body.stream !== false; // 默认流式

    // 5. 建立请求取消控制器，并设置 25 秒超时与客户端中断监听
    const abortController = new AbortController();
    const timeoutTimer = setTimeout(() => {
      abortController.abort(new Error('REQUEST_TIMEOUT'));
    }, 25000);

    req.signal.addEventListener('abort', () => {
      clearTimeout(timeoutTimer);
      abortController.abort();
    });

    if (wantStream) {
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          let collectedText = '';
          let completed = false;
          let failed = false;
          let estTokens = 0;
          try {
            for await (const chunk of defaultAIOrchestrator.streamAnswer(messages, clientIp, abortController.signal)) {
              if (abortController.signal.aborted) break;
              if (chunk.type === 'delta' && chunk.content) {
                collectedText += chunk.content;
              }
              if (chunk.type === 'done') completed = true;
              if (chunk.type === 'error') failed = true;
              const data = `data: ${JSON.stringify(chunk)}\n\n`;
              controller.enqueue(encoder.encode(data));
            }
            if (!abortController.signal.aborted) {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              // 统计 Token 用量
              const inChars = messages.reduce((acc, m) => acc + (m.content?.length || 0), 0);
              const outChars = collectedText.length;
              estTokens = Math.ceil(inChars / 2) + Math.ceil(outChars / 2);
              after(() => recordAITokenUsage(estTokens).catch(() => {}));
            }
          } catch (err: any) {
            failed ||= !abortController.signal.aborted;
            if (!abortController.signal.aborted) {
              const safeErr = sanitizeErrorMessage(err);
              const errData = `data: ${JSON.stringify({ type: 'error', error: safeErr })}\n\n`;
              controller.enqueue(encoder.encode(errData));
            }
          } finally {
            clearTimeout(timeoutTimer);
            const outcome = failed ? 'error' : completed ? 'success' : abortController.signal.reason?.message === 'REQUEST_TIMEOUT' ? 'timeout' : abortController.signal.aborted ? 'cancelled' : 'error';
            const durationMs = Math.max(0, Math.min(120000, Date.now() - startedAt));
            after(() => recordAIOutcome(outcome, startedAt));
            after(() => recordAIChatLog({
              userId: user.id,
              userEmail: user.email || '未绑定邮箱',
              userDisplayName: (user.user_metadata?.full_name as string) || (user.user_metadata?.name as string) || undefined,
              clientIp: realIp,
              userAgent,
              messages,
              response: collectedText,
              model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
              tokensEstimated: estTokens,
              durationMs,
              outcome
            }).catch(() => {}));
            try {
              controller.close();
            } catch (_) {}
          }
        },
        cancel() {
          clearTimeout(timeoutTimer);
          abortController.abort();
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    }

    // 非流式回退
    try {
      const result = await defaultAIOrchestrator.answer(messages, clientIp, abortController.signal);
      const inChars = messages.reduce((acc, m) => acc + (m.content?.length || 0), 0);
      const outChars = result.reply?.length || 0;
      const estTokens = Math.ceil(inChars / 2) + Math.ceil(outChars / 2);
      const durationMs = Math.max(0, Math.min(120000, Date.now() - startedAt));
      after(() => recordAITokenUsage(estTokens).catch(() => {}));
      after(() => recordAIOutcome('success', startedAt));
      after(() => recordAIChatLog({
        userId: user.id,
        userEmail: user.email || '未绑定邮箱',
        userDisplayName: (user.user_metadata?.full_name as string) || (user.user_metadata?.name as string) || undefined,
        clientIp: realIp,
        userAgent,
        messages,
        response: result.reply || '',
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
        tokensEstimated: estTokens,
        durationMs,
        outcome: 'success'
      }).catch(() => {}));
      return NextResponse.json(result);
    } catch (error) {
      const durationMs = Math.max(0, Math.min(120000, Date.now() - startedAt));
      const outcome = abortController.signal.reason?.message === 'REQUEST_TIMEOUT' ? 'timeout' : abortController.signal.aborted ? 'cancelled' : 'error';
      after(() => recordAIOutcome(outcome, startedAt));
      after(() => recordAIChatLog({
        userId: user.id,
        userEmail: user.email || '未绑定邮箱',
        userDisplayName: (user.user_metadata?.full_name as string) || (user.user_metadata?.name as string) || undefined,
        clientIp: realIp,
        userAgent,
        messages,
        response: '',
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
        tokensEstimated: 0,
        durationMs,
        outcome
      }).catch(() => {}));
      throw error;
    } finally {
      clearTimeout(timeoutTimer);
    }
  } catch (err: any) {
    const safeMsg = sanitizeErrorMessage(err);
    return NextResponse.json({ error: safeMsg }, { status: 500 });
  }
}
