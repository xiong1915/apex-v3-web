// scripts/audit-secrets.cjs
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const SENSITIVE_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/,
  /ghp_[a-zA-Z0-9]{20,}/,
  /gho_[a-zA-Z0-9]{20,}/,
  /tvly-[a-zA-Z0-9]{20,}/,
  /open\.feishu\.cn\/open-apis\/bot\/v2\/hook\/[a-zA-Z0-9_-]{10,}/,
  /sctapi\.ftqq\.com/,
  /https:\/\/pushplus\.plus\/send/
];

function scan(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.next'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scan(full, results);
    } else {
      if (entry.name.startsWith('.env')) continue; // env files ignored by git
      try {
        const content = fs.readFileSync(full, 'utf8');
        for (const p of SENSITIVE_PATTERNS) {
          if (p.test(content)) {
            results.push({ file: path.relative(root, full), pattern: p.toString() });
          }
        }
      } catch (_) {}
    }
  }
  return results;
}

const hits = scan(root);
if (hits.length > 0) {
  console.error('❌ Found potential sensitive leaks:', hits);
  process.exit(1);
} else {
  console.log('✅ Security audit passed: 0 sensitive credentials or webhooks found in tracked files.');
  process.exit(0);
}
