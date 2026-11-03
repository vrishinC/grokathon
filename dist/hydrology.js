// Geometry here is a visual exploration aid, not a hydraulic solver.
export const EARTH_METRES_PER_DEGREE = 111320;
export function sampleAtProgress(samples, progress) {
  if (!samples.length) return null;
  const first = Date.parse(samples[0].time), last = Date.parse(samples.at(-1).time);
  const target = first + (last - first) * Math.max(0, Math.min(100, progress)) / 100;
  return samples.reduce((best, sample) => Math.abs(Date.parse(sample.time)-target) < Math.abs(Date.parse(best.time)-target) ? sample : best);
}
export function sampleProgress(samples, time) {
  const span = Date.parse(samples.at(-1).time)-Date.parse(samples[0].time);
  return span ? (Date.parse(time)-Date.parse(samples[0].time))/span*100 : 0;
}
export function previewWidth(flowCfs, observedPeak) {
  // A deliberately schematic corridor, in metres; never interpret as flood depth.
  return 16 + 170 * Math.sqrt(Math.max(0, flowCfs) / Math.max(1, observedPeak));
}
export function centroid(ring) {
  const points = ring.length > 1 && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1] ? ring.slice(0,-1) : ring;
  return points.reduce((out,p) => [out[0]+p[0]/points.length,out[1]+p[1]/points.length],[0,0]);
}
export function distanceToLines(point, lines) {
  const sx = EARTH_METRES_PER_DEGREE*Math.cos(point[1]*Math.PI/180), sy = EARTH_METRES_PER_DEGREE;
  let best = Infinity;
  for (const coords of lines) for(let i=1;i<coords.length;i++) {
    const a=[(coords[i-1][0]-point[0])*sx,(coords[i-1][1]-point[1])*sy], b=[(coords[i][0]-point[0])*sx,(coords[i][1]-point[1])*sy];
    const dx=b[0]-a[0],dy=b[1]-a[1],len=dx*dx+dy*dy;
    const t=len ? Math.max(0,Math.min(1,-(a[0]*dx+a[1]*dy)/len)) : 0;
    best=Math.min(best,Math.hypot(a[0]+t*dx,a[1]+t*dy));
  }
  return best;
}
export function validatePrediction(data, event, maxSize=20000) {
  if (!data || data.eventId!==event.id) throw new Error(`Choose a prediction file for ${event.id}.`);
  if(typeof data.label!=='string'||!data.label.trim()||data.label.length>100) throw new Error('Include a model label of 1–100 characters.');
  if(typeof data.provenance!=='string'||!data.provenance.trim()||data.provenance.length>1000) throw new Error('Include model provenance (maximum 1,000 characters).');
  if(!Array.isArray(data.samples)||data.samples.length<2||data.samples.length>maxSize) throw new Error('Provide 2–20,000 timestamped samples.');
  let prev=-Infinity;
  for(const s of data.samples){
    const t=Date.parse(s.time);
    if(!Number.isFinite(t)||typeof s.time!=='string'||!/(Z|[+-]\d\d:\d\d)$/.test(s.time)) throw new Error('Sample timestamps must include a timezone.');
    if(t<=prev) throw new Error('Samples must be ordered with unique timestamps.');
    if(!Number.isFinite(s.flow_cfs)||s.flow_cfs<0||s.flow_cfs>1000000) throw new Error('Flow must be a finite, nonnegative value in cfs.');
    prev=t;
  }
  if(Date.parse(data.samples.at(-1).time)<Date.parse(event.samples[0].time)||Date.parse(data.samples[0].time)>Date.parse(event.samples.at(-1).time)) throw new Error('The prediction must overlap the observed event.');
  return {eventId:data.eventId,label:data.label,provenance:data.provenance,samples:data.samples.map(s=>({time:s.time,flow_cfs:s.flow_cfs}))};
}
export function sampleInterval(samples) {
  const intervals=samples.slice(1).map((sample,i)=>Date.parse(sample.time)-Date.parse(samples[i].time)).filter(ms=>ms>0).sort((a,b)=>a-b);
  if(!intervals.length)return 0;
  const middle=Math.floor(intervals.length/2);
  return intervals.length%2 ? intervals[middle] : (intervals[middle-1]+intervals[middle])/2;
}

// Only measured/model samples close in time are compared. Every observed sample
// can appear at most once; no interpolation, extrapolation or filled data gaps.
export function compareHydrographs(observed, predicted, toleranceMs=sampleInterval(observed)/2) {
  const empty={matchedCount:0,observedCount:observed.length,coverage:0,toleranceMs,observedPeak:null,modelPeak:null,peakErrorCfs:null,peakErrorPercent:null,timingErrorMinutes:null,nse:null,firstTime:null,lastTime:null};
  if(!observed.length||!predicted.length)return empty;
  if(!Number.isFinite(toleranceMs)||toleranceMs<0)throw new Error('Comparison tolerance must be a nonnegative number of milliseconds.');
  const times=observed.map(s=>Date.parse(s.time)), matched=new Map();
  let cursor=0;
  for(const model of predicted){
    const time=Date.parse(model.time);
    if(time<times[0]||time>times.at(-1))continue;
    while(cursor+1<times.length&&Math.abs(times[cursor+1]-time)<Math.abs(times[cursor]-time))cursor++;
    const difference=Math.abs(times[cursor]-time), previous=matched.get(cursor);
    if(difference<=toleranceMs&&(!previous||difference<previous.difference))matched.set(cursor,{observed:observed[cursor],model,difference});
  }
  const pairs=[...matched.values()];
  if(!pairs.length)return empty;
  const observedPeak=pairs.reduce((peak,pair)=>pair.observed.flow_cfs>peak.flow_cfs?pair.observed:peak,pairs[0].observed);
  const modelPeak=pairs.reduce((peak,pair)=>pair.model.flow_cfs>peak.flow_cfs?pair.model:peak,pairs[0].model);
  const mean=pairs.reduce((sum,pair)=>sum+pair.observed.flow_cfs,0)/pairs.length;
  const denominator=pairs.reduce((sum,pair)=>sum+(pair.observed.flow_cfs-mean)**2,0);
  const numerator=pairs.reduce((sum,pair)=>sum+(pair.observed.flow_cfs-pair.model.flow_cfs)**2,0);
  const peakErrorCfs=modelPeak.flow_cfs-observedPeak.flow_cfs;
  return {...empty,matchedCount:pairs.length,coverage:pairs.length/observed.length,observedPeak,modelPeak,peakErrorCfs,peakErrorPercent:observedPeak.flow_cfs?peakErrorCfs/observedPeak.flow_cfs*100:null,timingErrorMinutes:(Date.parse(modelPeak.time)-Date.parse(observedPeak.time))/60000,nse:pairs.length>1&&denominator>0?1-numerator/denominator:null,firstTime:pairs[0].observed.time,lastTime:pairs.at(-1).observed.time};
}
export function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
