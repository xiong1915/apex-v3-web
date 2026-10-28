import {test} from 'node:test';
import assert from 'node:assert/strict';
import {computeDisplacementData, getRefractionSize, supportsRefraction} from '../lib/glass/refraction';

test('refraction budgets reject invalid and large surfaces, cap map pixels',()=>{
 assert.equal(getRefractionSize(0,40),null);
 assert.equal(getRefractionSize(Infinity,40),null);
 assert.equal(getRefractionSize(1200,600),null);
 const size=getRefractionSize(320,96);
 assert.ok(size && size.width*size.height<=65536);
});
test('generated displacement has a neutral interior and finite bounded channels',()=>{
 const result=computeDisplacementData({width:100,height:60,radius:16,bevelDepth:10,dpr:1});
 assert.equal(result.data.length,100*60*4);
 const center=(30*100+50)*4;
 assert.equal(result.data[center],128);assert.equal(result.data[center+1],128);
 assert.ok(result.data.some((v,i)=>i%4<2&&v!==128));
});
test('only eligible Chromium desktops use refraction; other engines use frosted glass',()=>{
 assert.equal(supportsRefraction('Mozilla Chrome/140.0 Safari/537.36',1440,false,true),true);
 for(const ua of ['Mozilla Version/18 Safari/605.1.15','Mozilla Firefox/140.0','Mozilla CriOS/140 Mobile Safari/604.1'])assert.equal(supportsRefraction(ua,1440,false,true),false);
 assert.equal(supportsRefraction('Chrome/140.0',390,false,true),false);
 assert.equal(supportsRefraction('Chrome/140.0',1440,true,true),false);
 assert.equal(supportsRefraction('Chrome/140.0',1440,false,false),false);
});
