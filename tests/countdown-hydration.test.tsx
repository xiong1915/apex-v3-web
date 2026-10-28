import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToString} from 'react-dom/server';
import {Countdown} from '../components/countdown';
test('SSR and hydration reuse the same countdown seed even if scripts arrive late',()=>{
 const original=Date.now;
 try{
  Date.now=()=>100000;
  const props={targetUtcMs:200000,serverTimeMs:100000};
  const server=renderToString(createElement(Countdown,props));
  Date.now=()=>109000;
  assert.equal(renderToString(createElement(Countdown,props)),server);
 }finally{Date.now=original;}
});
