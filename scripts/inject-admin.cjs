// scripts/inject-admin.cjs
// APEX V3 管理员 UUID 一键配置工具
const { execSync } = require('child_process');

const [adminUuid] = process.argv.slice(2);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

if (!adminUuid || !UUID_REGEX.test(adminUuid.trim())) {
  console.error('用法: node scripts/inject-admin.cjs <36位Supabase用户UUID>');
  process.exit(1);
}

function run(cmd) {
  console.log(`> ${cmd}`);
  return execSync(cmd, { stdio: 'inherit', shell: true });
}

console.log(`=== 正在配置专属管理员 ADMIN_USER_ID: ${adminUuid} ===`);
run(`npx.cmd --yes vercel env add ADMIN_USER_ID production,preview,development --value "${adminUuid.trim()}" --force --yes`);
run('npx.cmd --yes vercel deploy --prod --yes');

console.log('=== 管理员配置生效，已成功部署上线！===');
