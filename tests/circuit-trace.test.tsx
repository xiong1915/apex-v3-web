import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { CircuitTrace } from '../components/circuit-trace';
import { circuitOutlines } from '../lib/circuits/outlines';

test('animated geometry matches the existing licensed circuit SVG assets', () => {
  for (const [name, d] of Object.entries(circuitOutlines)) {
    const svg = readFileSync(new URL(`../public/circuits/${name}.svg`, import.meta.url), 'utf8');
    assert.ok(svg.includes(`d="${d}"`), `${name} must use the real existing geometry`);
  }
});

test('unknown or historically invalid layouts never display a different circuit', () => {
  assert.match(renderToStaticMarkup(<CircuitTrace circuitId="unknown" season="2026" />), /真实赛道构型暂缺/);
  assert.match(renderToStaticMarkup(<CircuitTrace circuitId="americas" season="1950" />), /真实赛道构型暂缺/);
  const markup = renderToStaticMarkup(<CircuitTrace circuitId="americas" season="2026" />);
  assert.match(markup, /pathLength="1"/);
  assert.match(markup, /role="img"/);
});
