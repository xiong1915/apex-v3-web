import test from 'node:test';
import assert from 'node:assert/strict';
import {teamTheme,teamStyle} from '../lib/ui/team-colors';
test('shared team accents resolve Chinese and upstream aliases without mixing Red Bull teams',()=>{
 assert.equal(teamTheme('Scuderia Ferrari').color,teamTheme('法拉利车队').color);
 assert.equal(teamTheme('red_bull').color,teamTheme('Red Bull Racing').color);
 assert.notEqual(teamTheme('小红牛车队').color,teamTheme('红牛车队').color);
 assert.notEqual(teamTheme('Audi').color,teamTheme('Cadillac').color);
 assert.equal(teamTheme('unknown historical constructor').color,'#747A84');
 assert.ok('--team-ink' in teamStyle('Mercedes-AMG'));
});
