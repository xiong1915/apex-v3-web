// scripts/deploy-prod.cjs
// APEX V3 生产发布脚本 (非交互式 + 180s 超时保护)
const { spawn } = require('child_process');

function runSpawn(cmd, args, timeoutMs = 180000) {
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
  console.log('=== 正在执行 Vercel 生产发布 (--prod) ===');
  await runSpawn('npx.cmd', ['--yes', 'vercel', 'deploy', '--prod', '--yes'], 180000);
  console.log('=== 生产部署成功！ ===');
}

main().catch(err => {
  console.error('部署失败:', err.message);
  process.exit(1);
});
