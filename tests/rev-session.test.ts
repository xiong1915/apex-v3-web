import test from 'node:test';
import assert from 'node:assert/strict';
import { RevSession, RevInputs, readRecords, saveRecord, readGhost, ghostGap } from '../lib/arcade/rev-session';
import { CAR_SPECS } from '../lib/arcade/car-specs';

test('independent throttle sources release without cancelling another held input', () => {
  const input = new RevInputs();
  input.set('Space', 1); input.set('KeyW', 1); input.set('pointer:1', .4);
  input.set('Space', 0); assert.equal(input.throttle, 1);
  input.set('KeyW', 0); assert.equal(input.throttle, .4);
  input.clear(); assert.equal(input.throttle, 0);
});
test('false start ends challenge; pause freezes countdown and clears input', () => {
  const game = new RevSession('DRAG', CAR_SPECS['v10-2004'], () => 0);
  game.start(); game.inputs.set('Space', 1); game.pause(); game.tick(10);
  assert.equal(game.elapsed, 0); assert.equal(game.inputs.throttle, 0);
  game.resume(); game.releaseClutch(); assert.equal(game.phase, 'RESULT');
  assert.equal(game.result?.failed, true);
  game.start(); assert.equal(game.result, null); assert.equal(game.phase, 'COUNTDOWN');
});
for (const spec of Object.values(CAR_SPECS)) {
  test(`${spec.id}: playable 400m, independent gearbox, timing includes reaction`, () => {
    const game = new RevSession('DRAG', spec, () => 0);
    game.start(); game.inputs.set('pedal', .53);
    while (game.phase === 'COUNTDOWN') game.tick(1 / 120);
    for (let i = 0; i < 30; i++) game.tick(1 / 120);
    game.releaseClutch(); game.inputs.set('pedal', 1);
    for (let i = 0; i < 120 * 40 && game.phase !== 'RESULT'; i++) {
      if (game.telemetry.rpm >= spec.optimalShiftRpmMin) game.shift(1);
      game.tick(1 / 120);
    }
    assert.equal(game.phase, 'RESULT');
    assert.ok(game.result!.time! > 5 && game.result!.time! < 30);
    assert.ok(game.result!.reactionMs! >= 249);
    assert.ok(game.telemetry.gear <= spec.totalGears);
    assert.ok(game.result!.zero100! > 0);
    const finished = game.telemetry.distanceM;
    game.tick(5); assert.equal(game.telemetry.distanceM, finished);
  });
}
test('launch requires stable target RPM then evaluates clutch release immediately', () => {
  const spec = CAR_SPECS['v10-2004'];
  const game = new RevSession('LAUNCH', spec, () => 0);
  game.start(); game.inputs.set('pedal', ((spec.launchRpmMin + spec.launchRpmMax)/2 - spec.enginePreset.idleRpm)/(spec.enginePreset.limiterRpm-spec.enginePreset.idleRpm));
  for (let i=0; i<1200 && game.phase !== 'GO'; i++) game.tick(1/120);
  assert.equal(game.phase, 'GO'); game.tick(.15); game.releaseClutch();
  assert.equal(game.phase, 'RESULT'); assert.equal(game.result?.quality, 'PERFECT');
});
test('quiz cannot answer without playback, rejects duplicate answers and finishes ten questions', () => {
  const game = new RevSession('QUIZ', CAR_SPECS['v10-2004'], () => 0);
  game.start(); game.answer('v10-2004'); assert.equal(game.question, 0);
  for(let i=0;i<10;i++) {
    game.playQuiz(); game.answer(game.quizEngine.id); game.answer(game.quizEngine.id);
    assert.equal(game.score, i+1); game.nextQuestion();
  }
  assert.equal(game.phase, 'RESULT'); assert.equal(game.result?.score, 10);
});
test('answer-screen pause/resume never requests audio; expired quiz clips stay silent',()=>{
  const game=new RevSession('QUIZ',CAR_SPECS['v10-2004']);
  game.start();game.playQuiz();assert.equal(game.needsAudio,true);
  game.answer(game.quizEngine.id);game.pause();assert.equal(game.needsAudio,false);
  game.resume();assert.equal(game.needsAudio,false);
  game.nextQuestion();game.playQuiz();for(let i=0;i<400;i++)game.tick(.01);
  game.pause();assert.equal(game.needsAudio,false);
});
test('records tolerate corrupt/denied storage and retain best per engine and mode', () => {
  let raw = '{broken';
  const storage = { getItem: () => raw, setItem: (_: string, value: string) => {raw=value;} };
  assert.deepEqual(readRecords(storage), {});
  assert.equal(saveRecord(storage, 'DRAG:v10', 10), true);
  assert.equal(saveRecord(storage, 'DRAG:v10', 11), false);
  assert.equal(saveRecord(storage, 'QUIZ', 8, true), true);
  assert.equal(saveRecord(storage, 'QUIZ', 7, true), false);
  assert.equal(readRecords(storage)['DRAG:v10'], 10);
  assert.deepEqual(readRecords({getItem(){throw Error('denied');}}), {});
});
test('ghost time gap interpolates real trajectory and rejects corrupt/nonmonotonic input',()=>{
  const points=[{time:1,distance:10},{time:2,distance:30}];
  assert.equal(ghostGap(points,20,1.7),.19999999999999996);
  assert.equal(ghostGap(points,0,0),null);
  assert.deepEqual(readGhost({getItem:()=>JSON.stringify(points.toReversed())},'v10'),[]);
});
test('existing v2 race records survive migration with reaction time included',()=>{
  const store={getItem:(key:string)=>key==='apex_rev_arcade_records_v2'?JSON.stringify({'v10-2004':{time400m:9,reactionTimeMs:200}}):null};
  assert.equal(readRecords(store)['DRAG:v10-2004'],9.2);
});
