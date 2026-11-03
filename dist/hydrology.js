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
export function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
