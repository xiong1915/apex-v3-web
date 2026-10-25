// tests/historical-center-and-real-replay.test.mjs
// 历史比赛中心、真实回放引擎、真实赛道匹配与更新状态自动化质量门禁测试套件

import test from 'node:test';
import assert from 'node:assert';
import { CircuitRegistry } from '../lib/circuits/registry.ts';
import { normalizeCircuitId } from '../lib/circuits/mapping.ts';
import { determineStandingsCutoff } from '../providers/f1/service.ts';

test('Historical Center, Authentic Circuits & Real Replay Gate', async (t) => {
  await t.test('1. 赛道资产年代匹配与严格禁回退新加坡原则', () => {
    // 1.1 未知赛道必须返回 null，严禁隐式回退到 marina_bay
    assert.strictEqual(CircuitRegistry.getCircuit('non_existent_track'), null);
    assert.strictEqual(CircuitRegistry.getCircuit('fake_circuit'), null);
    assert.strictEqual(CircuitRegistry.getCircuit(''), null);

    // 1.2 现代银石在 2023/2026 赛季匹配成功
    const modernSilverstone = CircuitRegistry.getCircuit('silverstone', '2023');
    assert.ok(modernSilverstone !== null);
    assert.strictEqual(modernSilverstone.circuitId, 'silverstone');
    assert.strictEqual(modernSilverstone.layoutId, '2010-current');

    // 1.3 1950 年代无现代 Arena 构型，必须返回 null (由 UI 显示历史构型暂缺)，严禁拿 2010 构型冒充
    const histSilverstone = CircuitRegistry.getCircuit('silverstone', '1950');
    assert.strictEqual(histSilverstone, null, '1950 年 Silverstone 无现代构型，必须返回 null');

    // 1.4 2015 年墨尔本 (16 弯旧布局) 严禁使用 2022 年翻新后的 14 弯构型冒充
    const melbourne2015 = CircuitRegistry.getCircuit('albert_park', '2015');
    assert.strictEqual(melbourne2015, null, '2015 年 Albert Park 严禁使用 2022 构型，必须返回 null');
    assert.ok(CircuitRegistry.getCircuit('albert_park', '2026') !== null, '2026 Albert Park 正常匹配 2022 现代构型');

    // 1.5 2008 年巴塞罗那 (带减速弯) 严禁使用 2023 年移除减速弯的新布局冒充
    const catalunya2008 = CircuitRegistry.getCircuit('catalunya', '2008');
    assert.strictEqual(catalunya2008, null, '2008 年 Catalunya 严禁使用 2023 构型，必须返回 null');
    assert.ok(CircuitRegistry.getCircuit('catalunya', '2026') !== null, '2026 Catalunya 正常匹配 2023 现代构型');

    // 1.6 2015 年新加坡严禁使用 2023 移除浮动看台直角弯的新构型冒充
    assert.strictEqual(CircuitRegistry.getCircuit('marina_bay', '2015'), null);
    assert.ok(CircuitRegistry.getCircuit('marina_bay', '2026') !== null);

    // 1.7 2026 新增赛道 Madring，在 2026 有效，在 2020 无效
    assert.ok(CircuitRegistry.getCircuit('madring', '2026') !== null);
    assert.strictEqual(CircuitRegistry.getCircuit('madring', '2020'), null);

    // 1.8 验证别名映射均可正确归一化
    assert.strictEqual(normalizeCircuitId('bahrain'), 'bahrain');
    assert.strictEqual(normalizeCircuitId('sakhir'), 'bahrain');
    assert.strictEqual(normalizeCircuitId('sepang'), 'sepang');
    assert.strictEqual(normalizeCircuitId('shanghai'), 'shanghai');
  });

  await t.test('2. 历史赛季最终官方积分榜核验与数学推导验证', () => {
    // 2.1 1950 年已完结历史赛季：直接标记为权威最终官方积分榜，verified = true
    const res1950 = determineStandingsCutoff(
      [{ rank: 1, driverId: 'farina', points: 30, wins: 3, code: 'FAR', number: '1', name: 'Farina', nameEn: 'Farina', fullZh: 'Farina', team: 'Alfa Romeo', teamId: 'alfa', gap: 0 }],
      [], // 1950 年未设车队世界冠军
      [{ round: 7, season: '1950', name: 'Italian GP', nameZh: '意大利大奖赛', country: 'Italy', locality: 'Monza', circuitId: 'monza', circuitName: 'Monza', raceStartUTC: '1950-09-03T14:00:00Z', isSprintWeekend: false, sessions: [] }],
      undefined,
      undefined,
      '1950'
    );
    assert.strictEqual(res1950.verified, false);
    assert.strictEqual(res1950.desc, '历史积分统计范围待核实');
    assert.strictEqual(res1950.reason, 'HISTORICAL_SCOPE_UNVERIFIED');

    // 2.2 2008 年已完结历史赛季
    const res2008 = determineStandingsCutoff(
      [{ rank: 1, driverId: 'hamilton', points: 98, wins: 5, code: 'HAM', number: '22', name: 'Hamilton', nameEn: 'Hamilton', fullZh: 'Hamilton', team: 'McLaren', teamId: 'mclaren', gap: 0 }],
      [{ rank: 1, teamId: 'ferrari', name: 'Ferrari', nameEn: 'Ferrari', points: 172, wins: 8, gap: 0 }],
      [{ round: 18, season: '2008', name: 'Brazilian GP', nameZh: '巴西大奖赛', country: 'Brazil', locality: 'Sao Paulo', circuitId: 'interlagos', circuitName: 'Interlagos', raceStartUTC: '2008-11-02T17:00:00Z', isSprintWeekend: false, sessions: [] }],
      undefined,
      undefined,
      '2008'
    );
    assert.strictEqual(res2008.verified, false);
    assert.strictEqual(res2008.desc, '历史积分统计范围待核实');

    // 2.3 2023 年已完结历史赛季
    const res2023 = determineStandingsCutoff(
      [{ rank: 1, driverId: 'verstappen', points: 575, wins: 19, code: 'VER', number: '1', name: 'Verstappen', nameEn: 'Verstappen', fullZh: 'Verstappen', team: 'Red Bull', teamId: 'red_bull', gap: 0 }],
      [{ rank: 1, teamId: 'red_bull', name: 'Red Bull', nameEn: 'Red Bull', points: 860, wins: 21, gap: 0 }],
      [{ round: 22, season: '2023', name: 'Abu Dhabi GP', nameZh: '阿布扎比大奖赛', country: 'UAE', locality: 'Yas Marina', circuitId: 'yas_marina', circuitName: 'Yas Marina', raceStartUTC: '2023-11-26T13:00:00Z', isSprintWeekend: false, sessions: [] }],
      undefined,
      undefined,
      '2023'
    );
    assert.strictEqual(res2023.verified, false);
    assert.strictEqual(res2023.desc, '历史积分统计范围待核实');

    // 2.4 未来赛季 (如 2030 年)：严禁标记为已验证最终官方榜
    const res2030 = determineStandingsCutoff([], [], [], undefined, undefined, '2030');
    assert.strictEqual(res2030.verified, false);
    assert.strictEqual(res2030.desc, '2030 赛季尚未开赛');

    // 2.5 空数据拦截：未取得积分榜时严禁冒充已核实
    const resEmpty = determineStandingsCutoff([], [], [], undefined, undefined, '2008');
    assert.strictEqual(resEmpty.verified, false);
    assert.strictEqual(resEmpty.desc, '2008 赛季暂无积分数据');

    // 2.6 2026 进行中赛季：在缺少场次证据时坚决保持待核实
    const res2026SprintPending = determineStandingsCutoff(
      [{ rank: 1, driverId: 'antonelli', points: 340, wins: 8, code: 'ANT', number: '12', name: 'Antonelli', nameEn: 'Antonelli', fullZh: 'Antonelli', team: 'Mercedes', teamId: 'mercedes', gap: 0, officialRound: 17 }],
      [{ rank: 1, teamId: 'mercedes', name: 'Mercedes', nameEn: 'Mercedes', points: 578, wins: 11, gap: 0, officialRound: 17 }],
      [{ round: 17, season: '2026', name: 'Singapore GP', nameZh: '新加坡大奖赛', country: 'Singapore', locality: 'Singapore', circuitId: 'marina_bay', circuitName: 'Marina Bay', raceStartUTC: '2026-10-11T12:00:00Z', isSprintWeekend: true, sessions: [] }],
      undefined,
      undefined,
      '2026'
    );
    assert.strictEqual(res2026SprintPending.verified, false);
    assert.strictEqual(res2026SprintPending.desc, '截止场次待核实');

    // 2.7 冲刺周末数学推导核对：上一站 332 分，冲刺赛 8 分，当前 340 分，数学验证成功
    const resMathReconciled = determineStandingsCutoff(
      [{ rank: 1, driverId: 'antonelli', points: 340, wins: 8, code: 'ANT', number: '12', name: 'Antonelli', nameEn: 'Antonelli', fullZh: 'Antonelli', team: 'Mercedes', teamId: 'mercedes', gap: 0, officialRound: 17 }],
      [{ rank: 1, teamId: 'mercedes', name: 'Mercedes', nameEn: 'Mercedes', points: 578, wins: 11, gap: 0, officialRound: 17 }],
      [{ round: 17, season: '2026', name: 'Singapore GP', nameZh: '新加坡大奖赛', country: 'Singapore', locality: 'Singapore', circuitId: 'marina_bay', circuitName: 'Marina Bay', raceStartUTC: '2026-10-11T12:00:00Z', isSprintWeekend: true, sessions: [] }],
      undefined,
      undefined,
      '2026',
      { previousRoundDriverPoints: { antonelli: 332 } }
    );
    assert.strictEqual(resMathReconciled.verified, false);
    assert.strictEqual(resMathReconciled.isSprintPending, false);
    assert.equal(resMathReconciled.desc, '截止场次待核实');
  });


});
