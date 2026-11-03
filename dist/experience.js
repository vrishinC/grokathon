import {escapeHtml} from './hydrology.js';

const $ = id => document.getElementById(id);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const explorer = () => window.aquaticExplorer;
const scrollToExplorer = () => $('explorer').scrollIntoView({behavior:reducedMotion.matches?'auto':'smooth',block:'start'});

// Keep the original explorer available as a dedicated stop in the story.
$('exploreBtn').addEventListener('click',scrollToExplorer);
document.querySelectorAll('a[href="#explorer"]').forEach(link=>link.addEventListener('click',()=>explorer()?.flyHome()));
document.querySelectorAll('[data-replay]').forEach(button=>button.addEventListener('click',()=>{
  explorer()?.selectEvent(button.dataset.replay);
  explorer()?.setProgress(0);
  explorer()?.setSpeed(2);
  explorer()?.play();
  explorer()?.flyHome();
  scrollToExplorer();
}));

const mobileControls = document.createElement('button');
mobileControls.className='mobile-controls-toggle';
mobileControls.setAttribute('aria-expanded','false');
mobileControls.setAttribute('aria-controls','explorerSidebar');
mobileControls.innerHTML='EVENT, LAYERS & BUILDINGS <span>＋</span>';
document.querySelector('.sidebar').id='explorerSidebar';
$('explorer').prepend(mobileControls);
mobileControls.addEventListener('click',()=>{
  const expanded=$('explorer').classList.toggle('controls-open');
  mobileControls.setAttribute('aria-expanded',String(expanded));
  mobileControls.querySelector('span').textContent=expanded?'−':'＋';
});
const quickEvents=document.createElement('div');
quickEvents.className='map-event-switch';quickEvents.setAttribute('role','group');quickEvents.setAttribute('aria-label','Quick event selection');
quickEvents.innerHTML='<button data-quick-event="fred" aria-pressed="true">Fred <span>2021</span></button><button data-quick-event="helene" aria-pressed="false">Helene <span>2024</span></button>';
document.querySelector('.map-panel').append(quickEvents);
quickEvents.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>explorer()?.selectEvent(button.dataset.quickEvent)));
window.addEventListener('aquatic:change',event=>quickEvents.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.quickEvent===event.detail.eventId))));
const legendToggle=document.createElement('button');legendToggle.className='mobile-legend-toggle';legendToggle.textContent='Legend';legendToggle.setAttribute('aria-expanded','false');legendToggle.setAttribute('aria-controls','mapLegend');document.querySelector('.legend').id='mapLegend';
document.querySelector('.map-panel').append(legendToggle);
legendToggle.addEventListener('click',()=>{const open=document.querySelector('.map-panel').classList.toggle('legend-open');legendToggle.setAttribute('aria-expanded',String(open));});
document.querySelector('#buildingSearchResults')?.addEventListener('click',scrollToExplorer);
document.querySelector('#dialogContent').addEventListener('click',event=>{if(event.target.closest('[data-building-index],[data-income-geoid]'))scrollToExplorer();});

const pipelineSteps=[
  {status:'RESEARCH PIPELINE / INPUTS',title:'Start with the watershed.',copy:'Rainfall, weather and basin characteristics describe the conditions upstream. They are the inputs to a model of how much water reaches the river.',availability:'The current explorer starts with observed USGS flow. Weather and basin model inputs are a planned integration.',water:15},
  {status:'RESEARCH PIPELINE / PREDICTION',title:'Forecast the river’s flow.',copy:'NeuralHydrology learns relationships between weather, the landscape and river discharge. Its output is a time series: how much water passes a point, and when.',availability:'Import your own prediction JSON in the explorer. Compare its hydrograph, peak, timing and NSE against observations; a trained model is not bundled.',water:30},
  {status:'RESEARCH PIPELINE / CALIBRATION',title:'Translate flow into height.',copy:'A rating curve relates river flow to the height recorded at a gauge. Local calibration is then needed to translate that gauge reading to water height along each river reach.',availability:'Recorded gauge stage is available. Reach-specific stage-to-drainage calibration remains to be connected. Gauge stage is not flood depth.',water:47},
  {status:'RESEARCH PIPELINE / TERRAIN',title:'Let the terrain tell the story.',copy:'HAND measures the height of each place above the drainage it connects to. Compare that height with calibrated water height to estimate which cells flood and how deeply.',availability:'~10 m is the target resolution. No calibrated HAND raster is bundled; the cross-section and current map corridor are illustrative.',water:72},
  {status:'RESEARCH PIPELINE / COMMUNITY',title:'Ask who is there.',copy:'Overlay the results with real buildings and Census context. The goal is to understand how flood burden differs across communities, and make those differences visible.',availability:'Building footprints and ACS income estimates are connected. Population exposure and disparity claims still require validated depths and a documented allocation method.',water:57}
];
const tabs=[...document.querySelectorAll('[data-step]')];
function selectPipeline(index,focus=false){
  const item=pipelineSteps[index];
  tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;});
  $('pipelinePanel').setAttribute('aria-labelledby',tabs[index].id);
  $('pipelineStatus').textContent=item.status;
  $('pipelineTitle').textContent=item.title;
  $('pipelineCopy').textContent=item.copy;
  $('pipelineAvailability').textContent=item.availability;
  $('handSlider').value=item.water;
  updateHand();
  if(focus)tabs[index].focus();
}
tabs.forEach((tab,index)=>{
  tab.addEventListener('click',()=>selectPipeline(index));
  tab.addEventListener('keydown',event=>{
    let next=index;
    if(event.key==='ArrowRight')next=(index+1)%tabs.length;
    else if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;
    else if(event.key==='Home')next=0;
    else if(event.key==='End')next=tabs.length-1;
    else return;
    event.preventDefault();selectPipeline(next,true);
  });
});
function updateHand(){
  const progress=Number($('handSlider').value),height=241-progress*1.13;
  $('handWater').setAttribute('y',height);
  $('handWater').setAttribute('height',280-height);
  $('handWaterline').setAttribute('y1',height);
  $('handWaterline').setAttribute('y2',height);
  $('handReadout').textContent=progress<25?'Water stays near the channel':progress<55?'Lower ground floods first':progress<80?'Water reaches the floodplain':'Higher ground remains above water';
  $('handSlider').setAttribute('aria-valuetext',$('handReadout').textContent);
}
$('handSlider').addEventListener('input',updateHand);updateHand();

// Real footprints and mapped waterways; decorative contour lines are explicitly conceptual.
const bbox={west:-82.89,east:-82.8,south:35.4,north:35.47};
const point=([lon,lat],w=680,h=480)=>[(lon-bbox.west)/(bbox.east-bbox.west)*(w-90)+45,(bbox.north-lat)/(bbox.north-bbox.south)*(h-80)+40];
const line=(coords,w,h)=>coords.map((coord,index)=>`${index?'L':'M'}${point(coord,w,h).map(v=>v.toFixed(1)).join(',')}`).join('');
const polygon=(coords,w,h)=>coords.map(ring=>line(ring,w,h)+'Z').join('');
const geometryPath=(geometry,w,h)=>geometry.type==='MultiPolygon'?geometry.coordinates.map(rings=>polygon(rings,w,h)).join(''):polygon(geometry.coordinates,w,h);
function contours(){
  let paths='';
  for(let k=0;k<21;k++){
    let d='';
    for(let i=0;i<=100;i++){
      const angle=i/100*Math.PI*2,rx=70+k*16,ry=35+k*11;
      const ripple=1+.12*Math.sin(angle*4+k*.06)+.06*Math.cos(angle*7);
      const x=490+Math.cos(angle)*rx*ripple,y=180+Math.sin(angle)*ry*ripple;
      d+=`${i?'L':'M'}${x.toFixed(1)},${y.toFixed(1)}`;
    }
    paths+=`<path d="${d}Z" fill="none" stroke="#92b4a1" stroke-opacity="${k%4===0?.23:.1}" stroke-width="${k%4===0?1:.7}"/>`;
  }
  return paths;
}
async function buildStoryMaps(){
  try{
    const [buildings,rivers]=await Promise.all(['buildings','rivers'].map(async name=>{const response=await fetch(`./data/${name}.geojson`);if(!response.ok)throw new Error('Map data unavailable');return response.json();}));
    const mainRivers=rivers.features.filter(feature=>feature.properties.main_river);
    const riverLines=(w,h)=>mainRivers.map(f=>`<path d="${line(f.geometry.coordinates,w,h)}"/>`).join('');
    const footprints=(w,h)=>buildings.features.map(feature=>`<path d="${geometryPath(feature.geometry,w,h)}"/>`).join('');
    let fineGrid='';for(let x=45;x<640;x+=18)fineGrid+=`<path d="M${x},40V440"/>`;for(let y=40;y<440;y+=18)fineGrid+=`<path d="M45,${y}H640"/>`;
    $('resolutionMap').innerHTML=`<defs><clipPath id="studyClip"><rect x="0" y="0" width="680" height="480"/></clipPath></defs><g clip-path="url(#studyClip)">${contours()}<g fill="none" stroke="#355a5b" stroke-width="25" opacity=".35">${riverLines(680,480)}</g><g fill="none" stroke="#5ab4bc" stroke-width="2">${riverLines(680,480)}</g><g id="fineMapGrid" fill="none" stroke="#b4d6ba" stroke-width=".6" opacity="0">${fineGrid}</g><g id="detailBuildings" fill="#d6e3c3" opacity=".1">${footprints(680,480)}</g><g id="coarseMapGrid"><path d="M70 80H610V405H70Z" fill="#b3c8b5" fill-opacity=".06" stroke="#d5dcc0" stroke-width="1.5"/><path d="M340 80V405M70 242H610" fill="none" stroke="#c0d4b5" stroke-width=".6" opacity=".4"/><text x="340" y="220" text-anchor="middle" fill="#d5e6ce" font-family="Manrope,sans-serif" font-size="25" letter-spacing="1">ONE COARSE CELL</text><text x="340" y="245" text-anchor="middle" fill="#9dbfae" font-family="sans-serif" font-size="9" letter-spacing="2">THE DETAILS DISAPPEAR</text></g></g>`;
    $('equityMap').innerHTML=`<defs><clipPath id="equityClip"><rect width="620" height="400"/></clipPath></defs><g clip-path="url(#equityClip)"><g id="equityRegions"></g><g fill="none" stroke="#68c5ca" stroke-width="14" opacity=".12">${riverLines(620,400)}</g><g fill="none" stroke="#68c5ca" stroke-width="1.5">${riverLines(620,400)}</g><g fill="#cce4cb" fill-opacity=".8">${footprints(620,400)}</g><text x="35" y="36" font-family="sans-serif" font-size="8" fill="#a8c2b4" letter-spacing="2">EAST FORK PIGEON RIVER</text></g>`;
    updateResolution();
    await addEquityContext();
  }catch(error){
    $('gridLabel').textContent='MAP ILLUSTRATION UNAVAILABLE';
    $('equityIncomeNote').textContent='Context unavailable; see the source notes';
  }
}
function updateResolution(){
  const progress=Number($('resolutionSlider').value)/100;
  $('fineMapGrid')?.setAttribute('opacity',String(progress*.48));
  $('detailBuildings')?.setAttribute('opacity',String(.1+progress*.9));
  $('coarseMapGrid')?.setAttribute('opacity',String(1-progress));
  const fine=progress>=.5;
  $('scaleNumber').textContent=fine?'~10':'110';$('scaleUnit').textContent=fine?'m':'km';
  $('scaleTitle').textContent=fine?'A street. A home. A place.':'A region in one cell.';
  $('scaleDescription').textContent=fine?'The research target is flood depth at roughly 10 m resolution: detailed enough to relate water to terrain and individual building footprints.':'A roughly 1° grid cell spans about 110 km north to south. That scale hides the terrain and streets that shape local flood risk.';
  $('gridLabel').textContent=fine?'STREET-LEVEL DEPTH / RESEARCH TARGET':'REGIONAL PROBABILITY / CONCEPT';
  $('resolutionSlider').setAttribute('aria-valuetext',fine?'Conceptual fine grid; approximately 10 metre target':'Conceptual coarse grid; approximately 110 kilometres');
}
$('resolutionSlider').addEventListener('input',updateResolution);
async function addEquityContext(){
  const response=await fetch('./data/census-block-groups.geojson');if(!response.ok)throw new Error('Census context unavailable');
  const collection=await response.json();
  const colors=['#f0d5a4','#c19a78','#8973a4'];
  const color=value=>value<50000?colors[0]:value<75000?colors[1]:colors[2];
  $('equityRegions').innerHTML=collection.features.map(f=>`<path d="${geometryPath(f.geometry,620,400)}" fill="${color(f.properties.median_household_income)}" fill-opacity=".13" stroke="${color(f.properties.median_household_income)}" stroke-opacity=".5" stroke-width="1"/>`).join('');
  $('equityIncomeStatus').textContent=collection.features.length;
  $('equityIncomeNote').textContent='Real 2019–2023 ACS estimates · with uncertainty';
  const maximum=Math.max(...collection.features.map(f=>f.properties.median_household_income+f.properties.moe));
  const chart=document.createElement('div');chart.className='income-context-chart';
  chart.innerHTML=`<div class="tiny-label">COMMUNITY INCOME / ESTIMATE ± 90% MOE</div>${collection.features.map(f=>{
    const p=f.properties,value=p.median_household_income,moe=p.moe;
    return `<div class="income-context-row"><div><span>${escapeHtml(p.display_name||p.NAME)}</span><b>$${value.toLocaleString('en-US')} <small>± $${moe.toLocaleString('en-US')}</small></b></div><div class="income-context-track"><span style="left:${Math.max(0,value-moe)/maximum*100}%;width:${2*moe/maximum*100}%"><i style="background:${color(value)}"></i></span><b style="left:${value/maximum*100}%;background:${color(value)}"></b></div></div>`;
  }).join('')}<p>Block-group estimates in 2023 dollars. Wide intervals show uncertainty; point estimates alone do not establish significant differences.</p>`;
  document.querySelector('.equity-network').append(chart);
  const button=document.createElement('button');button.className='action-text';button.textContent='Show income on the map ↗';
  button.addEventListener('click',()=>{explorer()?.setLayerMode('combined');scrollToExplorer();});
  document.querySelector('.equity-content').append(button);
}
buildStoryMaps();

// Only play ambient footage while visible. An explicit pause persists during this visit.
const heroVideo=$('heroVideo'),storyVideo=$('storyVideo');
let manuallyPaused=false,heroVisible=false,videoLoaded=false;
function updateHeroPlayback(){
  const paused=manuallyPaused||reducedMotion.matches;
  $('motionToggle').setAttribute('aria-pressed',String(paused));
  $('motionToggle').setAttribute('aria-label',paused?'Play background animation':'Pause background animation');
  $('motionToggle').innerHTML=paused?'▷ <span>Play motion</span>':'Ⅱ <span>Pause motion</span>';
  if(heroVisible&&!paused&&!document.hidden){
    if(!videoLoaded){heroVideo.querySelector('source').src=heroVideo.querySelector('source').dataset.src;heroVideo.load();videoLoaded=true;}
    heroVideo.play().catch(()=>{manuallyPaused=true;updateHeroPlayback();});
  }else heroVideo.pause();
}
$('motionToggle').addEventListener('click',()=>{manuallyPaused=!manuallyPaused;updateHeroPlayback();});
const heroObserver=new IntersectionObserver(entries=>{heroVisible=entries[0].isIntersecting;updateHeroPlayback();},{threshold:.05});heroObserver.observe($('story'));
reducedMotion.addEventListener('change',updateHeroPlayback);
document.addEventListener('visibilitychange',()=>{updateHeroPlayback();if(document.hidden)storyVideo.pause();});
$('playFilm').addEventListener('click',async()=>{
  if(!storyVideo.paused){storyVideo.pause();return;}
  storyVideo.scrollIntoView({behavior:reducedMotion.matches?'auto':'smooth',block:'center'});
  try{await storyVideo.play();$('playFilm').innerHTML='Pause the film <span>Ⅱ</span>';}catch{$('playFilm').textContent='Use the player to start';}
});
storyVideo.addEventListener('play',()=>{$('playFilm').innerHTML='Pause the film <span>Ⅱ</span>';heroVideo.pause();});
storyVideo.addEventListener('pause',()=>{$('playFilm').innerHTML='Play the film <svg><use href="#i-play"/></svg>';});

// Scroll reveals enhance the layout without hiding content when JavaScript is unavailable.
if(!reducedMotion.matches){
  document.documentElement.classList.add('motion-ready');
  const revealObserver=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('is-visible');revealObserver.unobserve(entry.target);}},{threshold:.08});
  document.querySelectorAll('.section-heading,.resolution-layout,.method-detail,.event-comparison,.equity-layout,.impact-grid,.film-copy').forEach(element=>{element.classList.add('reveal');revealObserver.observe(element);});
}
