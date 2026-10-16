// tests/glass-and-responsive.test.mjs
// Phase 3 Quality Gate Automated Verification

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

test('Phase 3 — 1. Glass Component System Completeness', () => {
  const glassDir = path.join(ROOT_DIR, 'components', 'glass');
  assert.ok(fs.existsSync(glassDir), 'components/glass directory must exist');

  const requiredComponents = [
    'GlassSurface.tsx',
    'GlassButton.tsx',
    'GlassNav.tsx',
    'GlassComposer.tsx',
    'GlassPopover.tsx',
    'GlassSheet.tsx',
    'index.ts'
  ];

  for (const comp of requiredComponents) {
    const compPath = path.join(glassDir, comp);
    assert.ok(fs.existsSync(compPath), `Missing Glass component: ${comp}`);
    const content = fs.readFileSync(compPath, 'utf8');
    assert.ok(content.length > 50, `${comp} must have substantive content`);
  }

  // Check barrel index exports all components
  const indexContent = fs.readFileSync(path.join(glassDir, 'index.ts'), 'utf8');
  assert.match(indexContent, /GlassSurface/);
  assert.match(indexContent, /GlassButton/);
  assert.match(indexContent, /GlassNav/);
  assert.match(indexContent, /GlassComposer/);
  assert.match(indexContent, /GlassPopover/);
  assert.match(indexContent, /GlassSheet/);
});

test('Editorial CSS uses solid surfaces, responsive layout and reduced motion', () => {
  const css = fs.readFileSync(path.join(ROOT_DIR, 'app/globals.css'), 'utf8');
  const components = fs.readFileSync(path.join(ROOT_DIR, 'app/styles/components.css'), 'utf8');
  assert.match(css, /@media\s*\(max-width:\s*767px\)/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /animation:\s*none\s*!important/);
  assert.doesNotMatch(css + components, /backdrop-filter:\s*blur/);
  // Actual viewport overflow is asserted by tests/browser/editorial.cjs at five widths.
  assert.match(css, /main\s*\{\s*min-width:\s*0/);
});
test('Phase 3 — 3. Viewport & Overflow Safety Across Core Pages', () => {
  const pageFiles = [
    'app/page.tsx',
    'app/standings/page.tsx',
    'app/races/page.tsx',
    'app/races/[id]/page.tsx',
    'app/drivers/page.tsx',
    'app/teams/page.tsx',
    'app/ai/page.tsx'
  ];

  for (const relPath of pageFiles) {
    const fullPath = path.join(ROOT_DIR, relPath);
    assert.ok(fs.existsSync(fullPath), `Page must exist: ${relPath}`);
    const content = fs.readFileSync(fullPath, 'utf8');

    // Ensure no hardcoded desktop width like width: 1200px without responsive container
    const fixedWidthMatch = content.match(/width:\s*['"](1[0-9]{3}|[6-9][0-9]{2})px['"]/);
    assert.equal(
      fixedWidthMatch,
      null,
      `Page ${relPath} has hazardous fixed width: ${fixedWidthMatch?.[0]}`
    );

    // Verify container uses max-width instead of fixed width
    if (content.includes('maxWidth:')) {
      assert.ok(!content.includes('width: "1240px"'), `${relPath} should not use fixed 1240px width`);
    }
  }
});

test('Phase 3 — 4. Editorial Solid Data Hierarchy (No Blanket Glass Blur on Content)', () => {
  // Standings, Drivers, Teams, Races must maintain high-contrast solid backgrounds
  const dataPages = [
    'app/standings/page.tsx',
    'app/drivers/page.tsx',
    'app/teams/page.tsx'
  ];

  for (const relPath of dataPages) {
    const fullPath = path.join(ROOT_DIR, relPath);
    const content = fs.readFileSync(fullPath, 'utf8');

    // Should not use glass blur for raw tabular data cards
    assert.ok(
      !content.includes('glass-elevated'),
      `${relPath} should maintain solid editorial surfaces for data clarity`
    );
  }
});
