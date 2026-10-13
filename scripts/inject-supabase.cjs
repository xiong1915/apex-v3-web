// scripts/inject-supabase.cjs
// APEX V3 Supabase 生产环境变量一键全自动注入与生产热发布工具
const { execSync } = require('child_process');

const [url, anonKey, serviceRoleKey] = process.argv.slice(2);

if (!url || !anonKey) {
  console.error('用法: node scripts/inject-supabase.cjs <SUPABASE_URL> <ANON_KEY> [SERVICE_ROLE_KEY]');
  process.exit(1);
}

function run(cmd) {
  console.log(`> ${cmd}`);
  return execSync(cmd, { stdio: 'inherit', shell: true });
}

console.log('=== 1. 正在向 Vercel 自动注入 Supabase 环境变量 ===');
run(`npx.cmd --yes vercel env add NEXT_PUBLIC_SUPABASE_URL production,preview,development --value "${url}" --force --yes`);
run(`npx.cmd --yes vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production,preview,development --value "${anonKey}" --force --yes`);

if (serviceRoleKey) {
  run(`npx.cmd --yes vercel env add SUPABASE_SERVICE_ROLE_KEY production,preview,development --value "${serviceRoleKey}" --force --yes`);
}

console.log('=== 2. 正在自动触发生产全量编译与热发布 ===');
run('npx.cmd --yes vercel deploy --prod --yes');

console.log('=== 3. 部署完成，准备进行线上实测 ===');
