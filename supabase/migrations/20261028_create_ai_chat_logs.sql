-- supabase/migrations/20261028_create_ai_chat_logs.sql
-- APEX V3 AI 交互日志与对话历史审计持久化

CREATE TABLE IF NOT EXISTS public.ai_chat_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    user_email TEXT,
    user_display_name TEXT,
    client_ip TEXT NOT NULL DEFAULT 'unknown',
    user_agent TEXT,
    messages JSONB NOT NULL,
    response TEXT,
    model TEXT,
    tokens_estimated INTEGER DEFAULT 0,
    duration_ms INTEGER DEFAULT 0,
    outcome TEXT DEFAULT 'success',
    device_info JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_logs_created_at ON public.ai_chat_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_chat_logs_user_id ON public.ai_chat_logs (user_id);

ALTER TABLE public.ai_chat_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'ai_chat_logs' AND policyname = 'service_role_all'
    ) THEN
        CREATE POLICY service_role_all ON public.ai_chat_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;
