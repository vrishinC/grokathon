import {sampleAtProgress,sampleProgress,previewWidth,centroid,distanceToLines,validatePrediction,compareHydrographs,escapeHtml} from './hydrology.js';

const $=id=>document.getElementById(id);
const C=window.Cesium;
const state={eventId:'fred',progress:50,source:'observed',playing:false,speed:1,topDown:false,exaggeration:3,layerMode:'flood',predictions:{},tourTimer:null};
let viewer,assetViewer,events,geography,buildingData,riverData,floodData,roadsData,placesData,incomeData,incomeFeatures=[],corridorLegend='',mainLines=[],buildingItems=[],selection=null,hoveredBuilding=null,selectionMarker,animationId,lastFrame=0,toastTimer,widthAnimation,renderedWidth=null,comparisonCache=new WeakMap();
const formatNum=n=>Number(n).toLocaleString('en-US',{maximumFractionDigits:0});
const dateLong=t=>new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'long',day:'numeric',year:'numeric'}).format(new Date(t));
const timeShort=t=>new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(t));
const currentEvent=()=>events?.events?.find(e=>e.id===state.eventId);
const currentSamples=()=>state.source==='model' ? (state.predictions[state.eventId]?.samples||[]) : (currentEvent()?.samples||[]);
const icon=name=>`<svg><use href="#i-${name}"/></svg>`;

function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4800);}
function requestRender(){viewer?.scene.requestRender();}
async function readJSON(path){const r=await fetch(path);if(!r.ok)throw new Error(`Could not load ${path} (${r.status}).`);return r.json();}
function showError(message){$('mapLoading').hidden=true;$('mapError').hidden=false;$('mapErrorText').textContent=message;}

function getComparison(){const prediction=state.predictions[state.eventId];if(!prediction)return null;if(!comparisonCache.has(prediction))comparisonCache.set(prediction,compareHydrographs(currentEvent()?.samples||[],prediction.samples));return comparisonCache.get(prediction);}
function signed(value,digits=1){return value===null?'Unavailable':`${value>0?'+':''}${value.toFixed(digits)}`;}
function updateComparison(){
  const panel=$('comparisonSummary'),model=state.predictions[state.eventId];panel.hidden=!model;if(!model)return;
  const result=getComparison();
  panel.innerHTML=`<div class="comparison-title"><span>MEASURED / MODEL</span><b>${escapeHtml(model.label)}</b></div><div class="comparison-metrics"><div><span>Measured peak*</span><strong>${result.observedPeak?formatNum(result.observedPeak.flow_cfs)+' <small>cfs</small>':'—'}</strong></div><div><span>Model peak*</span><strong>${result.modelPeak?formatNum(result.modelPeak.flow_cfs)+' <small>cfs</small>':'—'}</strong></div><div><span>Peak error</span><strong>${signed(result.peakErrorPercent)}${result.peakErrorPercent===null?'':'%'}</strong></div><div><span>Timing error</span><strong>${signed(result.timingErrorMinutes)}${result.timingErrorMinutes===null?'':' <small>min</small>'}</strong></div><div><span>NSE</span><strong>${result.nse===null?'Unavailable':result.nse.toFixed(3)}</strong></div></div><p class="comparison-note">*Peaks and scores use ${result.matchedCount} paired samples (${Math.round(result.coverage*100)}% of the observed record); nearest timestamps within ±${(result.toleranceMs/60000).toLocaleString('en-US',{maximumFractionDigits:1})} min. No gap filling. Positive errors mean higher / later model peaks.${result.nse===null?' NSE needs at least two pairs and changing observed flow.':''}</p>`;
}

function updateChart(){
  const samples=currentSamples(),observed=currentEvent()?.samples||[],model=state.predictions[state.eventId]?.samples;
  if(!samples.length)return;
  const first=Date.parse(samples[0].time),last=Date.parse(samples.at(-1).time),span=last-first||1;
  const inWindow=series=>(series||[]).filter(s=>Date.parse(s.time)>=first&&Date.parse(s.time)<=last);
  const observedWindow=inWindow(observed),modelWindow=inWindow(model),max=Math.max(1,...observedWindow.map(s=>s.flow_cfs),...modelWindow.map(s=>s.flow_cfs));
  // Keep every measured point, including brief peaks; both paths share one axis.
  const lineFor=series=>series.length?'M'+series.map(s=>`${((Date.parse(s.time)-first)/span*800).toFixed(2)},${(38-s.flow_cfs/max*35).toFixed(2)}`).join('L'):'';
  const line=lineFor(observedWindow),paths=document.querySelectorAll('.hydrograph>svg>path');
  paths[0].setAttribute('d',line?line+`L${((Date.parse(observedWindow.at(-1).time)-first)/span*800).toFixed(2)},40L${((Date.parse(observedWindow[0].time)-first)/span*800).toFixed(2)},40Z`:'');paths[1].setAttribute('d',line);paths[1].setAttribute('stroke','#67d6d1');
  $('modelHydrograph').setAttribute('d',lineFor(modelWindow));$('modelHydrograph').hidden=!model;
  document.querySelector('.chart-legend').hidden=!model;
  const peakTime=Date.parse(currentEvent().peak.time),peakPosition=(peakTime-first)/span*100;
  $('peakMarker').hidden=!Number.isFinite(peakTime)||peakTime<first||peakTime>last;
  $('peakMarker').style.left=`${Math.max(0,Math.min(100,peakPosition))}%`;
  const tickTimes=[0,25,50,75,100].map(p=>sampleAtProgress(samples,p).time);
  document.querySelector('.time-ticks').innerHTML=tickTimes.map(t=>`<span>${new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric'}).format(new Date(t))}</span>`).join('');
  $('timeSlider').setAttribute('aria-label',state.source==='model'?'Imported model event time':'Observed event time');
  updateComparison();
}
function updateEvent(id){
  if(!events?.events?.some(e=>e.id===id&&e.samples?.length))return;
  stopPlayback();state.eventId=id;state.source='observed';const e=currentEvent();state.progress=sampleProgress(e.samples,e.peak.time);
  document.querySelectorAll('[data-event]').forEach(b=>{const on=b.dataset.event===id;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',on);});
  $('peakFlow').innerHTML=`${formatNum(e.peak.flow_cfs)} <small>cfs</small>`;$('peakStage').innerHTML=`${e.peak.stage_ft.toFixed(2)} <small>ft</small>`;
  $('scenarioMode').textContent='Observed';$('scenarioMode').classList.add('active');$('modelMode').classList.remove('active');
  $('scenarioMode').setAttribute('aria-pressed','true');$('modelMode').setAttribute('aria-pressed','false');
  $('modelMode').innerHTML=state.predictions[id]?'Model':'Model <span>＋</span>';
  $('timeSlider').value=state.progress;updateChart();updateTime(true);
}
function drawCorridor(width,animate=false){
  cancelAnimationFrame(widthAnimation);
  const draw=value=>{renderedWidth=value;if(floodData)floodData.entities.values.forEach(entity=>{const next=Math.round(value/2)*2*entity._band;if(entity._lastWidth!==next){entity.corridor.width=next;entity._lastWidth=next;}});requestRender();};
  if(!animate||renderedWidth===null||window.matchMedia('(prefers-reduced-motion: reduce)').matches){draw(width);return;}
  const start=renderedWidth,startTime=performance.now();
  const frame=time=>{const progress=Math.min(1,(time-startTime)/650),ease=1-(1-progress)**3;draw(start+(width-start)*ease);if(progress<1)widthAnimation=requestAnimationFrame(frame);};
  widthAnimation=requestAnimationFrame(frame);
}
function updateTime(animate=false){
  const e=currentEvent(),sample=sampleAtProgress(currentSamples(),state.progress);if(!e||!sample)return;const width=previewWidth(sample.flow_cfs,e.peak.flow_cfs);
  $('chartCursor').style.left=`${state.progress}%`;
  $('timelineDate').textContent=timeShort(sample.time);
  $('currentStage').textContent=Number.isFinite(sample.stage_ft)?`${sample.stage_ft.toFixed(2)} ft gauge stage`:'Gauge stage not supplied';
  $('timeSlider').setAttribute('aria-valuetext',`${timeShort(sample.time)}, ${formatNum(sample.flow_cfs)} cubic feet per second${Number.isFinite(sample.stage_ft)?`, gauge stage ${sample.stage_ft.toFixed(2)} feet`:''}`);
  $('phaseLabel').textContent=formatNum(sample.flow_cfs);
  document.querySelector('.phase-readout>span').textContent='FLOW · CFS';
  document.querySelector('.timeline-top .section-label').textContent=state.source==='model'?'IMPORTED MODEL SERIES':'OBSERVED GAUGE PLAYBACK';
  drawCorridor(width,animate);
  let count=0;
  buildingItems.forEach(item=>{const inCorridor=item.distance<=width/2;if(inCorridor)count++;if(item.inCorridor!==inCorridor){item.inCorridor=inCorridor;styleBuilding(item);}});
  $('scenarioCount').textContent=formatNum(count);$('scenarioPercent').textContent=buildingItems.length?`${Math.round(count/buildingItems.length*100)}%`:'—';$('exposureBar').style.width=buildingItems.length?`${count/buildingItems.length*100}%`:'0';
  if(selection)showBuilding(selection);requestRender();
  window.dispatchEvent(new CustomEvent('aquatic:change',{detail:getExplorerState()}));
}
function stopPlayback(){state.playing=false;cancelAnimationFrame(animationId);$('playBtn').innerHTML=icon('play');$('playBtn').setAttribute('aria-label',`Play ${state.source==='model'?'model':'observed'} hydrograph`);$('playBtn').setAttribute('aria-pressed','false');}
function togglePlayback(){if(!currentSamples().length)return;if(state.playing){stopPlayback();return;}state.playing=true;lastFrame=0;$('playBtn').textContent='Ⅱ';$('playBtn').setAttribute('aria-label','Pause playback');$('playBtn').setAttribute('aria-pressed','true');if(state.progress>=100)state.progress=0;
  const tick=t=>{if(!state.playing)return;if(!lastFrame)lastFrame=t;if(t-lastFrame<250){animationId=requestAnimationFrame(tick);return;}state.progress=Math.min(100,state.progress+(t-lastFrame)/650*state.speed);lastFrame=t;$('timeSlider').value=state.progress;updateTime();if(state.progress>=100){stopPlayback();return;}animationId=requestAnimationFrame(tick);};animationId=requestAnimationFrame(tick);
}
function jumpToPeak(){if(!events)return;updateEvent(state.eventId);toast(`Recorded peak · ${timeShort(currentEvent().peak.time)} · ${formatNum(currentEvent().peak.flow_cfs)} cfs`);}
function flyTo(lon,lat,range=6500,heading=-20,pitch=-43,duration=2){
  if(!viewer)return;
  viewer.camera.flyToBoundingSphere(new C.BoundingSphere(C.Cartesian3.fromDegrees(lon,lat,800),1),{duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:duration,offset:new C.HeadingPitchRange(C.Math.toRadians(heading),C.Math.toRadians(pitch),range)});
}
function homeView(){state.topDown=false;$('viewMode').textContent='2D';$('viewMode').setAttribute('aria-label','Switch to overhead view');flyTo(-82.84,35.435,8500,-25,-43);}
function stopTour(){clearTimeout(state.tourTimer);state.tourTimer=null;$('tourBtn').innerHTML=icon('play')+' Valley tour';}
function startTour(){
  if(!viewer){toast('The map is still loading. Please try the valley tour shortly.');return;}
  if(state.tourTimer){stopTour();viewer.camera.cancelFlight();return;}
  const stops=[[-82.810686,35.417608,2700,10,-38,'Cruso · a community along the East Fork'],[-82.839,35.439,3800,-45,-35,'Follow the East Fork Pigeon River'],[-82.8697222,35.46166667,2700,-20,-40,'USGS 03456500 · the observed flow record']];let i=0;
  $('tourBtn').textContent='Stop tour';const next=()=>{if(i>=stops.length){stopTour();return;}const [lon,lat,r,h,p,label]=stops[i++];flyTo(lon,lat,r,h,p,3);toast(label);state.tourTimer=setTimeout(next,6500);};next();
}
function styleBuilding(item){if(item)item.entity.polygon.material=C.Color.fromCssColorString(item===selection?'#74f1e2':item===hoveredBuilding?'#b9fff0':item.inCorridor?'#efd29c':'#e9eddb').withAlpha(item===selection?1:.92);}
function clearSelection(){const previous=selection;selection=null;styleBuilding(previous);if(selectionMarker)selectionMarker.show=false;$('selectionCard').hidden=true;requestRender();}
function markSelection(lon,lat,label,building=null){
  if(!placesData)return;
  if(!selectionMarker)selectionMarker=placesData.entities.add({id:'selection-marker',position:C.Cartesian3.fromDegrees(lon,lat),point:{pixelSize:10,color:C.Color.fromCssColorString('#8cfff0'),outlineWidth:5,outlineColor:C.Color.fromCssColorString('#8cfff0').withAlpha(.25),heightReference:C.HeightReference.CLAMP_TO_GROUND,disableDepthTestDistance:Number.POSITIVE_INFINITY},label:{text:label,font:'11px sans-serif',fillColor:C.Color.fromCssColorString('#bafff2'),outlineColor:C.Color.fromCssColorString('#112d31'),outlineWidth:4,style:C.LabelStyle.FILL_AND_OUTLINE,pixelOffset:new C.Cartesian2(0,-24),heightReference:C.HeightReference.CLAMP_TO_GROUND,disableDepthTestDistance:Number.POSITIVE_INFINITY}});
  selectionMarker.position=C.Cartesian3.fromDegrees(lon,lat);selectionMarker.label.text=label;selectionMarker._building=building;selectionMarker.show=true;requestRender();
}
function showBuilding(item){if(!item||!currentEvent())return;const previous=selection;selection=item;styleBuilding(previous);styleBuilding(item);const [lon,lat]=centroid(item.feature.geometry.coordinates[0]);markSelection(lon,lat,'SELECTED BUILDING',item);$('selectionName').textContent=item.feature.properties.name||'Mapped building';const p=item.feature.properties;
  document.querySelector('#selectionCard>.eyebrow').textContent='BUILDING FOOTPRINT';document.querySelector('#selectionCard>p').textContent='Building height is schematic. No observed flood depth is available.';$('selectionNavigation').hidden=false;
  $('selectionDetails').innerHTML=`<dt>Selected event</dt><dd>${escapeHtml(currentEvent().name)}</dd><dt>Flow series</dt><dd>${state.source==='model'?'Imported model':'Observed USGS gauge'}</dd><dt>Map source</dt><dd>Microsoft / Esri</dd><dt>Preview overlap</dt><dd>${item.inCorridor?'Inside illustrative corridor':'Outside illustrative corridor'}</dd><dt>Flood depth</dt><dd class="data-tag">Not yet calibrated</dd><dt>Rendered height</dt><dd>${item.height} m ${Number.isFinite(p.height_m)?'':'(assumed)'}</dd><dt>View source</dt><dd><a href="${escapeHtml(p.source_url)}" target="_blank" rel="noreferrer">${escapeHtml(p.id||p.osm_id)} ↗</a></dd>`;
  $('selectionCard').hidden=false;
}
function inspectBuilding(index){if(!buildingItems.length||!Number.isFinite(index))return;const item=buildingItems[((Math.trunc(index)%buildingItems.length)+buildingItems.length)%buildingItems.length];showBuilding(item);const [lon,lat]=centroid(item.feature.geometry.coordinates[0]);flyTo(lon,lat,1300,-20,-48,1.6);$('selectionCard').focus({preventScroll:true});}
function renderBuildingList(query=''){
  const matches=buildingItems.map((item,index)=>({item,index})).filter(({item})=>`${item.feature.properties.name} ${item.feature.properties.id}`.toLowerCase().includes(query.toLowerCase()));
  $('buildingSearchCount').textContent=`${formatNum(matches.length)} buildings${matches.length>60?' · showing the first 60; search by ID to narrow the list':''}`;
  $('buildingSearchResults').innerHTML=matches.slice(0,60).map(({item,index})=>`<button class="building-result" data-building-index="${index}"><span>${escapeHtml(item.feature.properties.name||'Mapped building')}<small>${escapeHtml(item.feature.properties.id)}</small></span><span>${item.inCorridor?'In preview corridor':'Outside corridor'} ↗</span></button>`).join('')||'<p>No buildings match that search.</p>';
}

async function addGeography(){
  [buildingData,riverData,floodData,roadsData,placesData]=['Buildings','River network','Illustrative corridor','Roads','Places'].map(name=>new C.CustomDataSource(name));
  for(const data of [roadsData,floodData,riverData,buildingData,placesData])await viewer.dataSources.add(data);
  mainLines=geography.rivers.features.filter(f=>f.properties.main_river).map(f=>f.geometry.coordinates);
  const color=hex=>C.Color.fromCssColorString(hex);
  geography.roads.features.filter(f=>['primary','secondary','tertiary','residential','unclassified'].includes(f.properties.highway)).forEach((f,i)=>roadsData.entities.add({id:'road'+i,polyline:{positions:C.Cartesian3.fromDegreesArray(f.geometry.coordinates.flat()),clampToGround:true,width:f.properties.highway==='secondary'?2.2:1,material:color('#d5d9b3').withAlpha(.4)}}));
  geography.rivers.features.forEach((f,i)=>riverData.entities.add({id:'river'+i,polyline:{positions:C.Cartesian3.fromDegreesArray(f.geometry.coordinates.flat()),clampToGround:true,width:f.properties.main_river?2.3:1,material:color(f.properties.main_river?'#a6e2de':'#82b9b4').withAlpha(f.properties.main_river?.9:.45)}}));
  for(const [i,line]of mainLines.entries())for(const [band,hex,alpha]of [[1,'#8cd4d8',.42],[.64,'#32afb9',.44],[.29,'#287897',.62]]){
    const entity=floodData.entities.add({id:`flood-${i}-${band}`,corridor:{positions:C.Cartesian3.fromDegreesArray(line.flat()),width:180*band,material:color(hex).withAlpha(alpha),cornerType:C.CornerType.ROUNDED,classificationType:C.ClassificationType.TERRAIN,zIndex:band===1?1:band===.64?2:3}});entity._band=band;
  }
  geography.buildings.features.forEach((f,i)=>{
    const ring=f.geometry.coordinates[0];const height=Number.isFinite(f.properties.height_m)?f.properties.height_m:6;
    const entity=buildingData.entities.add({id:'building'+i,polygon:{hierarchy:C.Cartesian3.fromDegreesArray(ring.flat()),height:0,heightReference:C.HeightReference.CLAMP_TO_GROUND,extrudedHeight:height,extrudedHeightReference:C.HeightReference.RELATIVE_TO_GROUND,material:color('#e9eddb').withAlpha(.92),outline:false}});
    const item={entity,feature:f,height,distance:distanceToLines(centroid(ring),mainLines),inCorridor:false};entity._building=item;buildingItems.push(item);
  });
  geography.places.features.forEach((f,i)=>{const [lon,lat]=f.geometry.coordinates;const gauge=f.properties.kind==='gauge';placesData.entities.add({id:'place'+i,position:C.Cartesian3.fromDegrees(lon,lat),point:{pixelSize:gauge?8:5,color:color(gauge?'#e6c782':'#eef3db'),outlineWidth:2,outlineColor:color('#375341'),heightReference:C.HeightReference.CLAMP_TO_GROUND,disableDepthTestDistance:Number.POSITIVE_INFINITY},label:{text:gauge?'USGS 03456500':'CRUSO',font:'12px sans-serif',fillColor:color('#f1f4e4'),outlineColor:color('#273e31'),outlineWidth:4,style:C.LabelStyle.FILL_AND_OUTLINE,pixelOffset:new C.Cartesian2(0,-23),heightReference:C.HeightReference.CLAMP_TO_GROUND,disableDepthTestDistance:Number.POSITIVE_INFINITY}});});
  $('buildingCount').textContent=formatNum(buildingItems.length);$('buildingLayerLabel').textContent=`${formatNum(buildingItems.length)} mapped · schematic heights`;
  const handler=new C.ScreenSpaceEventHandler(viewer.scene.canvas);handler.setInputAction(click=>{const picked=viewer.scene.pick(click.position);if(picked?.id?._building)showBuilding(picked.id._building);else if(picked?.id?._income)showIncome(picked.id._income);},C.ScreenSpaceEventType.LEFT_CLICK);
  let lastHover=0;
  handler.setInputAction(move=>{if(performance.now()-lastHover<80)return;lastHover=performance.now();const picked=viewer.scene.pick(move.endPosition),next=picked?.id?._building||null;viewer.scene.canvas.style.cursor=next||picked?.id?._income?'pointer':'grab';if(next!==hoveredBuilding){const previous=hoveredBuilding;hoveredBuilding=next;styleBuilding(previous);styleBuilding(next);requestRender();}},C.ScreenSpaceEventType.MOUSE_MOVE);
  viewer.scene.canvas.addEventListener('mouseleave',()=>{const previous=hoveredBuilding;hoveredBuilding=null;styleBuilding(previous);requestRender();});
}

const incomeColor=value=>!Number.isFinite(value)?'#69798b':value<50000?'#f0d5a4':value<75000?'#c19a78':'#8973a4';
function showIncome(properties){
  clearSelection();document.querySelector('#selectionCard>.eyebrow').textContent='CENSUS BLOCK GROUP';$('selectionName').textContent=properties.NAME;
  $('selectionDetails').innerHTML=`<dt>Median household income</dt><dd>${Number.isFinite(properties.median_household_income)?'$'+formatNum(properties.median_household_income):'Unavailable'}</dd><dt>Margin of error</dt><dd>${Number.isFinite(properties.moe)?'± $'+formatNum(properties.moe)+' (90% confidence)':'Unavailable'}</dd><dt>Estimate period</dt><dd>${escapeHtml(properties.vintage)}</dd><dt>Units</dt><dd>2023 inflation-adjusted USD</dd><dt>Census GEOID</dt><dd>${escapeHtml(properties.GEOID)}</dd><dt>View source</dt><dd><a href="${escapeHtml(properties.source_url)}" target="_blank" rel="noreferrer">ACS table B19013 ↗</a></dd>`;
  document.querySelector('#selectionCard>p').textContent='Area-level context, not an individual household’s income. These estimates are not event-specific and do not establish flood exposure.';$('selectionNavigation').hidden=true;$('selectionCard').hidden=false;
}
function setLayerMode(mode){
  if(!['flood','income','combined'].includes(mode)||mode!=='flood'&&!incomeData)return;
  state.layerMode=mode;if(floodData)floodData.show=mode!=='income'&&$('floodToggle').checked;if(incomeData){incomeData.show=mode!=='flood';incomeData.entities.values.forEach(entity=>{if(entity.polygon)entity.polygon.material=C.Color.fromCssColorString(incomeColor(entity._income.median_household_income)).withAlpha(mode==='combined'?.27:.55);});}
  document.querySelectorAll('[data-layer-mode]').forEach(button=>{const active=button.dataset.layerMode===mode;button.classList.toggle('active',active);button.setAttribute('aria-pressed',active);});
  document.querySelector('.legend').innerHTML=mode==='flood'?corridorLegend:`<span class="legend-title">${mode==='combined'?'INCOME + PREVIEW CORRIDOR':'MEDIAN HOUSEHOLD INCOME'}</span><div class="income-legend-scale"><i style="background:#f0d5a4"></i><i style="background:#c19a78"></i><i style="background:#8973a4"></i></div><div class="legend-labels"><span>&lt;$50k</span><span>$50–75k</span><span>&gt;$75k</span></div><p>2019–2023 ACS · block group estimates<br>Click a region for the margin of error.${mode==='combined'?'<br>Cyan water = illustrative corridor.':''}</p>`;
  requestRender();window.dispatchEvent(new CustomEvent('aquatic:change',{detail:getExplorerState()}));
}
async function addIncomeLayer(){
  try{
    const collection=await readJSON('./data/census-block-groups.geojson');if(!Array.isArray(collection.features))throw new Error('Census polygons are unavailable.');incomeFeatures=collection.features;
    incomeData=await C.GeoJsonDataSource.load(collection,{clampToGround:true,stroke:C.Color.fromCssColorString('#efdac1').withAlpha(.65),strokeWidth:1});
    incomeData.name='ACS median household income (2019–2023)';
    incomeData.entities.values.forEach(entity=>{entity._income=entity.properties?.getValue(C.JulianDate.now())||{};if(entity.polygon){entity.polygon.outline=false;entity.polygon.material=C.Color.fromCssColorString(incomeColor(entity._income.median_household_income)).withAlpha(.55);entity.polygon.classificationType=C.ClassificationType.TERRAIN;entity.polygon.zIndex=0;}});
    incomeData.show=false;await viewer.dataSources.add(incomeData);
    document.querySelectorAll('[data-layer-mode]').forEach(button=>{button.disabled=false;});
    const pill=document.querySelector('.income-card .pending-pill');if(pill)pill.textContent='ACS 2023';
    document.querySelector('.income-card small').textContent='Census income & uncertainty';
    requestRender();
  }catch(error){incomeData=null;incomeFeatures=[];console.info('Income layer unavailable:',error.message);}
}

function openDialog(kind){
  if(kind==='model'&&!currentEvent()){toast('Observed event data is not available yet.');return;}
  if(assetViewer){assetViewer.destroy();assetViewer=null;}
  const el=$('dialogContent');
  if(kind==='buildings')el.innerHTML=`<h2>Every footprint has a place.</h2><p>Search mapped buildings and fly to a footprint. Preview overlap is a geometric illustration, not an observed flood-depth measurement.</p><label class="building-search-label" for="buildingSearch">Search building name or ID</label><input id="buildingSearch" class="building-search" type="search" placeholder="e.g. 77362093" autocomplete="off"><p id="buildingSearchCount" role="status"></p><div id="buildingSearchResults" class="building-search-results"></div>`;
  else if(kind==='equity')el.innerHTML=`<h2>Who is most exposed?</h2><p>Flood exposure is only half of the story. The next layer compares exposure across Census block groups using household income and population estimates.</p><div class="data-status"><b>Building footprints</b><span>${buildingItems.length} mapped in this window</span></div><div class="data-status"><b>ACS median household income</b><span class="data-tag">Not connected</span></div><div class="data-status"><b>Population exposure</b><span class="data-tag">Not estimated</span></div><div class="data-status"><b>Validated flood depths</b><span class="data-tag">Calibration required</span></div><h3>Before reporting disparities</h3><p>Join a calibrated depth raster to building footprints, then join buildings to Census block groups and ACS estimates for a documented vintage. Report sampling uncertainty and explain how population is allocated to buildings. A block group's income does not establish a specific household's income.</p><div class="note-box">The count in the sidebar is centroid overlap with an illustrative corridor. It does not measure historical inundation, affected residents, or income disparity.</div><p><a href="https://www.census.gov/programs-surveys/acs" target="_blank" rel="noreferrer">American Community Survey ↗</a></p>`;
  else if(kind==='model')el.innerHTML=`<h2>Bring in the model.</h2><p>NeuralHydrology predictions are not connected yet. Import a timestamped flow series to compare it with the observed hydrograph and drive the same illustrative corridor.</p><div class="note-box">Imported data stays in this browser tab. A series is labeled “Model”; importing it does not make it validated or turn the corridor into a hydraulic depth map.</div><h3>Prediction format</h3><p>A JSON object with <code>eventId</code> (${state.eventId}), <code>label</code>, <code>provenance</code>, and <code>samples</code> containing timezone-qualified <code>time</code> and numeric <code>flow_cfs</code>. Samples must be chronological and overlap this event.</p><div class="import-row"><label for="predictionFile">Import ${escapeHtml(currentEvent().name)} prediction</label><br><br><input id="predictionFile" type="file" accept="application/json,.json"><p id="importStatus" role="status"></p></div>${state.predictions[state.eventId]?`<h3>Loaded model</h3><p>${escapeHtml(state.predictions[state.eventId].label)} — ${escapeHtml(state.predictions[state.eventId].provenance)}</p><button class="download-link" id="activateModel">View model series</button>`:''}<p><a href="https://github.com/vrishinC/grokathon" target="_blank" rel="noreferrer">Integration instructions in the repository ↗</a></p>`;
  else if(kind==='assets'){
    el.innerHTML=`<h2>Built from open assets.</h2><p>This interactive rock model is <a href="https://polyhaven.com/a/rock_09" target="_blank" rel="noreferrer">Rock 09 by Jenelle van Heerden / Poly Haven</a>, released under <a href="https://polyhaven.com/license" target="_blank" rel="noreferrer">CC0</a>. Drag to inspect it.</p><div class="asset-preview"><div id="assetCanvas"></div></div><p>Illustrative scenery only. It is not a surveyed object in the Pigeon River basin. The map's buildings use Microsoft footprints, with a 6 m assumed height where height is unknown.</p>`;
  }else el.innerHTML=`<h2>Real records.<br>Transparent assumptions.</h2><p>This is the first working explorer for Aquatic Sustainability. It combines observed USGS hydrographs with a real geographic landscape, while keeping unvalidated spatial estimates visible as a preview.</p><div class="data-status"><b>Fred / 17 August 2021</b><span>19,800 cfs · 16.03 ft</span></div><div class="data-status"><b>Helene / 27 September 2024</b><span>15,900 cfs · 14.10 ft</span></div><div class="data-status"><b>Terrain & satellite imagery</b><span>Esri public services</span></div><div class="data-status"><b>Building footprints</b><span>Microsoft / Esri · ODbL</span></div><div class="data-status"><b>Rivers & roads</b><span>OpenStreetMap / ODbL</span></div><h3>How to read the water overlay</h3><p>The blue corridor is an illustrative buffer around the mapped East Fork. Its width follows the selected hydrograph, using 16 + 170 × √(flow / observed event peak) metres. The colors show nested buffer bands, not depth. They have not been calibrated with HAND, a rating curve or high-water marks.</p><h3>A gauge reading is not water depth</h3><p>Gauge stage uses a local vertical reference. The 16.03 ft and 14.10 ft readings cannot be subtracted from HAND directly. A calibrated conversion to reach-specific height above drainage is needed first. Terrain exaggeration is visual only.</p><h3>Scope of this first version</h3><p>The displayed area is a rectangular study window around Cruso and the gauge, not a delineated drainage basin. Microsoft building footprints are not event-specific and may differ from 2021/2024. Exposed-building counts use footprint centroids, and buildings are extruded 6 m unless a source height exists.</p><h3>Data you can inspect</h3><ul><li><a href="https://nwis.waterdata.usgs.gov/nwis/peak?site_no=03456500&agency_cd=USGS&format=rdb" target="_blank" rel="noreferrer">USGS annual peak-flow record</a> (Helene has discharge qualifier 9; see source notes).</li><li><a href="./data/observed-events.json" target="_blank">Bundled observed hydrographs and gauge metadata</a></li><li><a href="./data/provenance.json" target="_blank">Source links, collection window and limitations</a></li><li><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors / ODbL</a></li></ul><button class="download-link" id="assetsButton">Explore the Poly Haven 3D asset ↗</button><div class="note-box">Research prototype. No 10 m HAND raster, trained-model evaluation, high-water-mark validation, or Census disparity estimate has been completed in this version.</div>`;
  $('infoDialog').showModal();
  if(kind==='equity'&&incomeFeatures.length){
    el.innerHTML=`<h2>Risk has a social context.</h2><p>Income can shape a community’s ability to prepare, evacuate and recover. This layer adds official Census block-group estimates around the study window, including their uncertainty.</p><div class="data-status"><b>Source</b><span>2019–2023 ACS 5-year · B19013</span></div><div class="data-status"><b>Units</b><span>2023 inflation-adjusted USD</span></div><div class="income-data-list">${incomeFeatures.map(feature=>{const p=feature.properties;return `<button class="income-data-row" data-income-geoid="${escapeHtml(p.GEOID)}"><span>${escapeHtml(p.display_name||p.NAME)}<small>Block group ${escapeHtml(p.GEOID)}</small></span><span><b>${Number.isFinite(p.median_household_income)?'$'+formatNum(p.median_household_income):'Unavailable'}</b><small>${Number.isFinite(p.moe)?'± $'+formatNum(p.moe)+' · 90% MOE':'MOE unavailable'}</small></span><span>↗</span></button>`;}).join('')}</div><p>Choose a block group to locate it on the map. These estimates describe areas; they do not establish any individual household’s income, and they are not measurements from either flood event.</p><h3>What remains to be measured</h3><p>A calibrated flood-depth raster and a documented population-allocation method are needed before estimating who was exposed or comparing flood burden across income groups.</p><div class="note-box">The blue corridor and sidebar overlap count are illustrative. Combining income and corridor layers does not turn them into a measured disparity or a count of affected residents.</div><p><a href="./data/census-provenance.json" target="_blank">Census sources, table and uncertainty notes ↗</a></p>`;
    el.querySelectorAll('[data-income-geoid]').forEach(button=>button.addEventListener('click',()=>{const feature=incomeFeatures.find(item=>item.properties.GEOID===button.dataset.incomeGeoid);$('infoDialog').close();setLayerMode('income');showIncome(feature.properties);const ring=feature.geometry.type==='MultiPolygon'?feature.geometry.coordinates[0][0]:feature.geometry.coordinates[0];const [lon,lat]=centroid(ring);flyTo(lon,lat,15000,-25,-55,2);$('selectionCard').focus({preventScroll:true});}));
  }
  $('assetsButton')?.addEventListener('click',()=>openDialog('assets'));
  $('predictionFile')?.addEventListener('change',importPrediction);
  $('activateModel')?.addEventListener('click',activateModel);
  if(kind==='buildings'){
    renderBuildingList();$('buildingSearch').addEventListener('input',event=>renderBuildingList(event.target.value));
    $('buildingSearchResults').addEventListener('click',event=>{const button=event.target.closest('[data-building-index]');if(button){$('infoDialog').close();inspectBuilding(Number(button.dataset.buildingIndex));}});
    $('buildingSearch').focus();
  }
  if(kind==='assets')setTimeout(showAsset,50);
}
async function importPrediction(event){const file=event.target.files[0];if(!file)return;try{if(file.size>4_000_000)throw new Error('Use a JSON file smaller than 4 MB.');const data=validatePrediction(JSON.parse(await file.text()),currentEvent());state.predictions[state.eventId]=data;activateModel();toast(`Loaded ${data.label}. Spatial overlay remains illustrative.`);}catch(e){const status=$('importStatus');if(status)status.textContent=e.message;else toast(e.message);}}
function activateModel(){if(!state.predictions[state.eventId])return;stopPlayback();state.source='model';state.progress=50;$('timeSlider').value=50;$('scenarioMode').classList.remove('active');$('modelMode').classList.add('active');$('scenarioMode').setAttribute('aria-pressed','false');$('modelMode').setAttribute('aria-pressed','true');$('modelMode').textContent='Model';$('infoDialog').close();updateChart();updateTime(true);}
async function showAsset(){if(!C||!$('assetCanvas')||!$('infoDialog').open)return;try{assetViewer=new C.Viewer('assetCanvas',{globe:false,skyBox:false,skyAtmosphere:false,baseLayer:false,animation:false,timeline:false,baseLayerPicker:false,geocoder:false,homeButton:false,sceneModePicker:false,navigationHelpButton:false,fullscreenButton:false,infoBox:false,selectionIndicator:false,requestRenderMode:true});assetViewer.scene.backgroundColor=C.Color.fromCssColorString('#e5ecde');if(assetViewer.scene.sun)assetViewer.scene.sun.show=false;if(assetViewer.scene.moon)assetViewer.scene.moon.show=false;const targetViewer=assetViewer;const model=await C.Model.fromGltfAsync({url:'./assets/nature/rock_09_1k.gltf',modelMatrix:C.Matrix4.IDENTITY,minimumPixelSize:160,imageBasedLighting:new C.ImageBasedLighting({imageBasedLightingFactor:new C.Cartesian2(1,0)})});if(assetViewer!==targetViewer||targetViewer.isDestroyed()){model.destroy();return;}assetViewer.scene.primitives.add(model);const fit=()=>{if(assetViewer!==targetViewer||targetViewer.isDestroyed())return;const radius=model.boundingSphere.radius;assetViewer.scene.light=new C.DirectionalLight({direction:new C.Cartesian3(-.4,-.6,-1),intensity:2.5});assetViewer.camera.lookAtTransform(C.Matrix4.fromTranslation(model.boundingSphere.center),new C.HeadingPitchRange(.5,-.5,radius*2.6));assetViewer.scene.requestRender();};model.readyEvent.addEventListener(fit);assetViewer.scene.requestRender();}catch(e){console.error('Asset preview:',e);const preview=document.querySelector('.asset-preview');if(preview)preview.textContent='The 3D asset could not load: '+e.message;}}

function setupExplorerControls(){
  corridorLegend=document.querySelector('.legend').innerHTML;
  document.querySelector('.map-heading').insertAdjacentHTML('afterend','<div class="map-layer-modes" role="group" aria-label="Map layer view"><button data-layer-mode="flood" class="active" aria-pressed="true">Flood</button><button data-layer-mode="income" aria-pressed="false" disabled>Income</button><button data-layer-mode="combined" aria-pressed="false" disabled>Combined</button></div>');
  document.querySelectorAll('[data-layer-mode]').forEach(button=>button.addEventListener('click',()=>setLayerMode(button.dataset.layerMode)));
  document.querySelector('.timeline-top').insertAdjacentHTML('beforeend','<div class="playback-tools"><button id="peakBtn" title="Jump to the recorded USGS peak">Jump to peak <span>↗</span></button><label class="speed-control" for="playbackSpeed"><span>Speed</span><select id="playbackSpeed" aria-label="Playback speed"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="4">4×</option></select></label></div>');
  $('timelineDate').insertAdjacentHTML('afterend','<span class="gauge-reading" id="currentStage">Gauge stage loading</span>');
  document.querySelector('.timeline-controls').insertAdjacentHTML('beforebegin','<div id="comparisonSummary" class="comparison-summary" hidden></div>');
  document.querySelector('.timeline-track').insertAdjacentHTML('afterbegin','<div class="chart-legend" hidden><span class="observed-key">Observed</span><span class="model-key">Imported model</span></div>');
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.id='modelHydrograph';path.setAttribute('fill','none');path.setAttribute('stroke','#b59bff');path.setAttribute('stroke-width','1.8');path.setAttribute('stroke-dasharray','4 2');document.querySelector('.hydrograph>svg').append(path);
  document.querySelector('.hydrograph').insertAdjacentHTML('beforeend','<div id="peakMarker" class="peak-marker" title="Recorded observed peak"><span>PEAK</span></div>');
  document.querySelector('.community-section').insertAdjacentHTML('beforeend','<button class="building-browser" id="browseBuildings">Inspect mapped buildings <span>↗</span></button>');
  $('selectionCard').tabIndex=-1;$('selectionCard').setAttribute('aria-label','Selected map feature details');
  $('selectionCard').insertAdjacentHTML('beforeend','<div class="selection-navigation" id="selectionNavigation"><button id="previousBuilding" aria-label="Inspect previous building">← Previous</button><button id="nextBuilding" aria-label="Inspect next building">Next →</button></div>');
  $('peakBtn').addEventListener('click',jumpToPeak);
  $('playbackSpeed').addEventListener('change',event=>{state.speed=Number(event.target.value);});
  $('browseBuildings').addEventListener('click',()=>openDialog('buildings'));
  $('previousBuilding').addEventListener('click',()=>inspectBuilding(buildingItems.indexOf(selection)-1));
  $('nextBuilding').addEventListener('click',()=>inspectBuilding(buildingItems.indexOf(selection)+1));
}
setupExplorerControls();

function getExplorerState(){const event=currentEvent(),sample=sampleAtProgress(currentSamples(),state.progress);return {eventId:state.eventId,eventName:event?.name||null,progress:state.progress,source:state.source,playing:state.playing,speed:state.speed,layerMode:state.layerMode,incomeReady:!!incomeData,sample,peak:event?.peak||null,mappedBuildings:buildingItems.length,previewBuildings:buildingItems.filter(item=>item.inCorridor).length,ready:!!viewer&&buildingItems.length>0};}
window.aquaticExplorer={
  getState:getExplorerState,selectEvent:updateEvent,flyHome:homeView,flyTo,openDialog,jumpToPeak,
  setProgress:progress=>{if(!events||!Number.isFinite(progress))return;stopPlayback();state.progress=Math.max(0,Math.min(100,progress));$('timeSlider').value=state.progress;updateTime(true);},
  play:()=>{if(!state.playing)togglePlayback();},pause:stopPlayback,
  setSpeed:speed=>{if([.5,1,2,4].includes(speed)){state.speed=speed;$('playbackSpeed').value=String(speed);}},
  inspectBuilding,setLayerMode,
};

document.querySelectorAll('[data-dialog]').forEach(b=>b.addEventListener('click',()=>openDialog(b.dataset.dialog)));
$('closeDialog').addEventListener('click',()=>$('infoDialog').close());$('infoDialog').addEventListener('close',()=>{if(assetViewer){assetViewer.destroy();assetViewer=null;}});
$('infoDialog').addEventListener('click',e=>{if(e.target===$('infoDialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
$('reloadMap').addEventListener('click',()=>location.reload());$('closeSelection').addEventListener('click',clearSelection);
$('exploreBtn').addEventListener('click',homeView);$('homeView').addEventListener('click',()=>{stopTour();homeView();});$('tourBtn').addEventListener('click',startTour);
$('zoomIn').addEventListener('click',()=>{if(viewer){viewer.camera.zoomIn(viewer.camera.positionCartographic.height*.25);requestRender();}});$('zoomOut').addEventListener('click',()=>{if(viewer){viewer.camera.zoomOut(viewer.camera.positionCartographic.height*.35);requestRender();}});
$('viewMode').addEventListener('click',()=>{state.topDown=!state.topDown;$('viewMode').textContent=state.topDown?'3D':'2D';$('viewMode').setAttribute('aria-label',state.topDown?'Switch to 3D valley view':'Switch to overhead view');flyTo(-82.84,35.435,state.topDown?11000:8500,-25,state.topDown?-89:-43);});
$('timeSlider').addEventListener('input',e=>{stopPlayback();state.progress=Number(e.target.value);updateTime();});$('playBtn').addEventListener('click',togglePlayback);
document.querySelectorAll('[data-event]').forEach(b=>b.addEventListener('click',()=>{if(events)updateEvent(b.dataset.event);}));
for(const [id,getData]of [['floodToggle',()=>floodData],['buildingsToggle',()=>buildingData],['riverToggle',()=>riverData]])$(id).addEventListener('change',e=>{if(getData())getData().show=e.target.checked;if(id==='floodToggle')setLayerMode(state.layerMode);requestRender();});
document.querySelectorAll('[data-exaggeration]').forEach(b=>b.addEventListener('click',()=>{state.exaggeration=Number(b.dataset.exaggeration);if(viewer)viewer.scene.verticalExaggeration=state.exaggeration;document.querySelectorAll('[data-exaggeration]').forEach(el=>{const on=el===b;el.classList.toggle('active',on);el.setAttribute('aria-pressed',on);});requestRender();}));
$('scenarioMode').addEventListener('click',()=>{if(!events)return;stopPlayback();state.source='observed';$('scenarioMode').classList.add('active');$('modelMode').classList.remove('active');$('scenarioMode').setAttribute('aria-pressed','true');$('modelMode').setAttribute('aria-pressed','false');updateChart();updateTime(true);});$('modelMode').addEventListener('click',()=>{if(events)openDialog('model');});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopPlayback();stopTour();}});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!$('infoDialog').open){clearSelection();stopTour();}
  if(event.target!==viewer?.scene.canvas||$('infoDialog').open||event.altKey||event.ctrlKey||event.metaKey)return;
  if(event.code==='Space'){event.preventDefault();togglePlayback();}
  else if(event.key.toLowerCase()==='p'){event.preventDefault();jumpToPeak();}
  else if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();window.aquaticExplorer.setProgress(state.progress+(event.key==='ArrowRight'?1:-1));}
});

async function init(){
  try{const loaded=await readJSON('./data/observed-events.json');if(!Array.isArray(loaded.events)||!loaded.events.some(event=>event.id==='fred')||loaded.events.some(event=>!event.peak||!Array.isArray(event.samples)||event.samples.length<2))throw new Error('The observed event records are incomplete. Please reload the page.');events=loaded;updateEvent('fred');}catch(e){showError(e.message);return;}
  if(!C){showError('The Cesium 3D library could not load. Check your connection and reload.');return;}
  try{
    C.Ion.defaultAccessToken='';
    viewer=new C.Viewer('cesiumContainer',{baseLayer:false,animation:false,timeline:false,baseLayerPicker:false,geocoder:false,homeButton:false,sceneModePicker:false,navigationHelpButton:false,fullscreenButton:false,infoBox:false,selectionIndicator:false,requestRenderMode:true,maximumRenderTimeChange:Infinity,contextOptions:{webgl:{alpha:false}}});
    viewer.scene.canvas.tabIndex=0;viewer.scene.canvas.setAttribute('aria-label','Interactive 3D valley. Drag to orbit and scroll to zoom. Space plays or pauses, arrow keys move through time, P jumps to the measured peak. Buildings can also be inspected using the Inspect mapped buildings button.');
    viewer.scene.backgroundColor=C.Color.fromCssColorString('#203b31');viewer.scene.globe.baseColor=C.Color.fromCssColorString('#425441');viewer.scene.globe.depthTestAgainstTerrain=false;viewer.scene.verticalExaggeration=3;viewer.scene.verticalExaggerationRelativeHeight=800;
    viewer.scene.globe.maximumScreenSpaceError=2;viewer.scene.fog.enabled=true;viewer.scene.skyAtmosphere.show=false;
    viewer.scene.screenSpaceCameraController.minimumZoomDistance=35;viewer.scene.screenSpaceCameraController.maximumZoomDistance=300000;
    const imagery=new C.UrlTemplateImageryProvider({url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',credit:'Imagery © Esri, Vantor, Earthstar Geographics, and the GIS User Community',maximumLevel:19});
    const layer=viewer.imageryLayers.addImageryProvider(imagery);layer.saturation=.75;layer.brightness=.86;layer.contrast=1.12;
    imagery.errorEvent.addEventListener(()=>{$('terrainStatus').textContent='Imagery connection limited';});
    viewer.cesiumWidget.creditDisplay.addStaticCredit(new C.Credit('Buildings © Microsoft / Esri · <a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap contributors</a>',true));
    homeView();
    const terrainPromise=C.ArcGISTiledElevationTerrainProvider.fromUrl('https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer').then(terrain=>{viewer.terrainProvider=terrain;$('terrainStatus').textContent='3D terrain · Esri';return terrain;}).catch(()=>{$('terrainStatus').textContent='Terrain unavailable · flat fallback';toast('Terrain service unavailable. The map is using a flat globe.');});
    const [buildings,rivers,roads,places]=await Promise.all(['buildings','rivers','roads','places'].map(f=>readJSON(`./data/${f}.geojson`)));geography={buildings,rivers,roads,places};await addGeography();updateTime();addIncomeLayer();
    await Promise.race([terrainPromise,new Promise(resolve=>setTimeout(resolve,12000))]);$('mapLoading').hidden=true;requestRender();
    document.querySelector('.map-heading>div').innerHTML='Cruso valley <span>/ 35.42° N, 82.81° W</span>';
    window.dispatchEvent(new CustomEvent('aquatic:ready',{detail:getExplorerState()}));
  }catch(e){showError(`The map could not initialize: ${e.message}`);console.error(e);}
}
init();
