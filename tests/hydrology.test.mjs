import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sampleAtProgress,sampleProgress,previewWidth,distanceToLines,centroid,validatePrediction,compareHydrographs,sampleInterval,escapeHtml} from '../dist/hydrology.js';
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
const series=(values,offset=0)=>values.map((flow_cfs,index)=>({time:new Date(Date.UTC(2021,7,17,0,index*15)+offset).toISOString(),flow_cfs}));
test('comparison gives a perfect score only for matching recorded observations',()=>{
  const observed=series([10,50,100,20]);const result=compareHydrographs(observed,observed);
  assert.equal(result.nse,1);assert.equal(result.peakErrorCfs,0);assert.equal(result.peakErrorPercent,0);assert.equal(result.timingErrorMinutes,0);assert.equal(result.coverage,1);assert.equal(result.toleranceMs,7.5*60000);
});
test('peak error and timing error are signed and use paired samples',()=>{
  const result=compareHydrographs(series([10,100,50,20]),series([10,50,120,20]));
  assert.equal(result.peakErrorCfs,20);assert.equal(result.peakErrorPercent,20);assert.equal(result.timingErrorMinutes,15);assert.ok(result.nse<1);
});
test('comparison refuses distant timestamps and never extrapolates to event endpoints',()=>{
  const observed=series([10,50,100,20]);
  assert.equal(compareHydrographs(observed,series([11,52,90,18],4*60000),3*60000).matchedCount,0);
  assert.equal(compareHydrographs(observed,[{time:new Date(Date.parse(observed[0].time)-1).toISOString(),flow_cfs:10}]).matchedCount,0);
  assert.equal(compareHydrographs(observed,series([10,50,100,20],24*60*60000)).nse,null);
});
test('partial models report coverage and each observed sample is paired at most once',()=>{
  const observed=series([10,50,100,20]);
  const predicted=[{time:new Date(Date.parse(observed[1].time)-60000).toISOString(),flow_cfs:1000},observed[1],observed[2]];
  const result=compareHydrographs(observed,predicted);
  assert.equal(result.matchedCount,2);assert.equal(result.coverage,.5);assert.equal(result.nse,1);assert.equal(result.modelPeak.flow_cfs,100);
});
test('NSE is unavailable for constant observations or a single matched sample',()=>{
  assert.equal(compareHydrographs(series([10,10,10]),series([10,10,10])).nse,null);
  assert.equal(compareHydrographs(series([10,50,100]),series([10])).nse,null);
  assert.equal(compareHydrographs([],[]).matchedCount,0);
  assert.equal(sampleInterval(series([10,20,30,40])),15*60000);
});
