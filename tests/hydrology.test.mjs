import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sampleAtProgress,sampleProgress,previewWidth,distanceToLines,centroid,validatePrediction,escapeHtml} from '../dist/hydrology.js';
const {events}=JSON.parse(fs.readFileSync(new URL('../dist/data/observed-events.json',import.meta.url)));
test('each historical peak is present in its measured record and reachable on the slider',()=>{
  for(const e of events){const sample=sampleAtProgress(e.samples,sampleProgress(e.samples,e.peak.time));assert.equal(sample.flow_cfs,e.peak.flow_cfs);assert.equal(sample.stage_ft,e.peak.stage_ft);assert.equal(Math.max(...e.samples.map(s=>s.flow_cfs)),e.peak.flow_cfs);}
});
test('progress clamps to the recorded range and never invents an interpolated measurement',()=>{
  const samples=events[0].samples;assert.equal(sampleAtProgress(samples,-1),samples[0]);assert.equal(sampleAtProgress(samples,101),samples.at(-1));assert.ok(samples.includes(sampleAtProgress(samples,53.23)));
});
test('centroid and point-to-river distances use metres and ignore repeated closing vertex',()=>{
  assert.deepEqual(centroid([[0,0],[2,0],[2,2],[0,2],[0,0]]),[1,1]);assert.ok(Math.abs(distanceToLines([0,0],[[[0,.001],[.01,.001]]])-111.32)<.01);assert.equal(distanceToLines([0,0],[[[-1,0],[1,0]]]),0);
});
test('illustrative corridor responds monotonically without claiming stage is depth',()=>{assert.equal(previewWidth(0,19800),16);assert.equal(previewWidth(19800,19800),186);assert.ok(previewWidth(5000,19800)<previewWidth(10000,19800));});
test('model import rejects wrong events, unordered samples, missing timezone, and invalid flows',()=>{
  const e=events[0],valid={eventId:e.id,label:'Test model',provenance:'Held-out test',samples:e.samples.slice(0,3).map(({time,flow_cfs})=>({time,flow_cfs}))};
  assert.equal(validatePrediction(valid,e).samples.length,3);
  assert.throws(()=>validatePrediction({...valid,eventId:'helene'},e));
  assert.throws(()=>validatePrediction({...valid,samples:[...valid.samples].reverse()},e));
  assert.throws(()=>validatePrediction({...valid,samples:[{time:'2021-08-16T00:00:00',flow_cfs:10},valid.samples[1]]},e));
  assert.throws(()=>validatePrediction({...valid,samples:[{...valid.samples[0],flow_cfs:-1},valid.samples[1]]},e));
  assert.throws(()=>validatePrediction({...valid,samples:[{...valid.samples[0],flow_cfs:'10'},valid.samples[1]]},e));
});
test('untrusted labels are escaped for display',()=>{assert.equal(escapeHtml('<img onerror="x">'),'&lt;img onerror=&quot;x&quot;&gt;');});
