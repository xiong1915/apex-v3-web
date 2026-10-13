// scripts/inject-admin.cjs
// APEX V3 管理员 UUID 一键配置工具 (非交互式 + 超时保护)
const { spawn } = require('child_process');

const [adminUuid] = process.argv.slice(2);
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

if (!adminUuid || !UUID_REGEX.test(adminUuid.trim())) {
  console.error('用法: node scripts/inject-admin.cjs <36位Supabase用户UUID>');
  process.exit(1);
}

function runSpawn(cmd, args, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    console.log(`> ${cmd} ${args.join(' ')}`);
    const p = spawn(cmd, args, {
      stdio: ['ignore', 'inherit', 'inherit'],
      shell: true,
      cwd: 'C:/Users/Administrator/.gemini/antigravity/scratch/apex-v3-web'
    });

    const timer = setTimeout(() => {
      p.kill('SIGKILL');
      reject(new Error(`Timeout after ${timeoutMs}ms for ${cmd}`));
    }, timeoutMs);

    p.on('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`Process exited with code ${code}`));
    });
  });
}

async function main() {
  const uuid = adminUuid.trim();
  console.log(`=== 1. 正在注入管理员 ADMIN_USER_ID: ${uuid} ===`);
  await runSpawn('npx.cmd', ['--yes', 'vercel', 'env', 'add', 'ADMIN_USER_ID', 'production,preview,development', '--value', uuid, '--force', '--yes'], 25000);

  console.log('=== 2. 正在触发 Vercel 生产热发布 ===');
  await runSpawn('npx.cmd', ['--yes', 'vercel', 'deploy', '--prod', '--yes'], 180000);

  console.log('=== 3. 部署完成！专属管理员配置已全量生效 ===');
}

main().catch(err => {
  console.error('执行失败:', err.message);
  process.exit(1);
});
