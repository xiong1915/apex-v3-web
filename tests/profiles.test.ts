import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DRIVER_PROFILES,
  TEAM_PROFILES,
  getDriverBiography,
  getTeamBiography
} from '../lib/f1/profiles';

test('Driver Profiles: comprehensive coverage and structure verification', () => {
  // Test key 2026 active drivers
  const sampleDriverIds = [
    'antonelli',
    'russell',
    'hamilton',
    'leclerc',
    'norris',
    'piastri',
    'verstappen',
    'hadjar',
    'lawson',
    'gasly',
    'lindblad',
    'colapinto',
    'bearman',
    'bortoleto',
    'hulkenberg',
    'ocon',
    'alonso',
    'sainz',
    'albon',
    'tsunoda',
    'stroll',
    'bottas',
    'perez',
    'zhou'
  ];

  for (const id of sampleDriverIds) {
    const profile = DRIVER_PROFILES[id];
    assert.ok(profile, `Driver profile for ${id} should exist`);
    assert.ok(profile.name.length > 0, `Driver ${id} should have name`);
    assert.ok(profile.nameEn.length > 0, `Driver ${id} should have nameEn`);
    assert.ok(profile.summary.length > 20, `Driver ${id} should have summary`);
    assert.ok(profile.racingStyle.length > 20, `Driver ${id} should have racingStyle`);
    assert.ok(profile.careerHighlights.length > 0, `Driver ${id} should have highlights`);
    assert.ok(profile.technicalNotes.length > 10, `Driver ${id} should have technicalNotes`);
    assert.ok(profile.tags.length > 0, `Driver ${id} should have tags`);
  }
});

test('Driver Profiles: getDriverBiography handles aliases, codes, and unknown drivers', () => {
  // By alias
  const ver = getDriverBiography({ driverId: 'max_verstappen', code: 'VER', name: '维斯塔潘' });
  assert.equal(ver.name, '马克斯·维斯塔潘');

  // By code
  const ant = getDriverBiography({ code: 'ANT', name: '安东内利' });
  assert.equal(ant.name, '基米·安东内利');

  // Dynamic fallback for unknown driver
  const unknown = getDriverBiography({
    driverId: 'unknown_legend',
    code: 'LEG',
    name: '传奇车手',
    nameEn: 'Legendary Driver',
    team: '历史名门车队',
    number: '99'
  });
  assert.equal(unknown.name, '传奇车手');
  assert.equal(unknown.code, 'LEG');
  assert.equal(unknown.permanentNumber, '99');
  assert.ok(unknown.summary.includes('传奇车手'));
  assert.ok(unknown.racingStyle.length > 10);
});

test('Team Profiles: comprehensive coverage and structure verification', () => {
  const sampleTeamIds = [
    'ferrari',
    'mclaren',
    'mercedes',
    'red_bull',
    'aston_martin',
    'alpine',
    'haas',
    'rb',
    'williams',
    'audi',
    'cadillac'
  ];

  for (const id of sampleTeamIds) {
    const profile = TEAM_PROFILES[id];
    assert.ok(profile, `Team profile for ${id} should exist`);
    assert.ok(profile.name.length > 0, `Team ${id} should have name`);
    assert.ok(profile.headquarters.length > 0, `Team ${id} should have headquarters`);
    assert.ok(profile.powerUnit.length > 0, `Team ${id} should have powerUnit`);
    assert.ok(profile.heritage.length > 20, `Team ${id} should have heritage`);
    assert.ok(profile.technicalFocus.length > 20, `Team ${id} should have technicalFocus`);
    assert.ok(profile.tags.length > 0, `Team ${id} should have tags`);
  }
});

test('Team Profiles: getTeamBiography handles aliases and unknown teams', () => {
  // By alias
  const rb = getTeamBiography({ teamId: 'racing_bulls', name: '小红牛' });
  assert.equal(rb.name, '小红牛车队');

  // Dynamic fallback for unknown team
  const unknown = getTeamBiography({
    teamId: 'future_racing',
    name: '极速挑战车队 (Future Racing)',
    nameEn: 'Future Racing Team'
  });
  assert.equal(unknown.name, '极速挑战车队');
  assert.ok(unknown.heritage.includes('极速挑战车队'));
  assert.ok(unknown.technicalFocus.length > 10);
});
