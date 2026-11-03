import {sampleAtProgress,sampleProgress,previewWidth,centroid,distanceToLines,validatePrediction,escapeHtml} from './hydrology.js';

const $=id=>document.getElementById(id);
const C=window.Cesium;
const state={eventId:'fred',progress:50,source:'observed',playing:false,topDown:false,exaggeration:3,predictions:{},tourTimer:null};
let viewer,assetViewer,events,geography,buildingData,riverData,floodData,roadsData,placesData,mainLines=[],buildingItems=[],selection=null,animationId,lastFrame=0,toastTimer;
const formatNum=n=>Number(n).toLocaleString('en-US',{maximumFractionDigits:0});
const dateLong=t=>new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'long',day:'numeric',year:'numeric'}).format(new Date(t));
const timeShort=t=>new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(t));
const currentEvent=()=>events.events.find(e=>e.id===state.eventId);
const currentSamples=()=>state.source==='model' ? state.predictions[state.eventId].samples : currentEvent().samples;
const icon=name=>`<svg><use href="#i-${name}"/></svg>`;

function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4800);}
function requestRender(){viewer?.scene.requestRender();}
async function readJSON(path){const r=await fetch(path);if(!r.ok)throw new Error(`Could not load ${path} (${r.status}).`);return r.json();}
function showError(message){$('mapLoading').hidden=true;$('mapError').hidden=false;$('mapErrorText').textContent=message;}

function updateChart(){
  const samples=currentSamples(),max=Math.max(...samples.map(s=>s.flow_cfs)),first=Date.parse(samples[0].time),span=Date.parse(samples.at(-1).time)-first;
  const points=samples.filter((_,i)=>i%Math.max(1,Math.floor(samples.length/220))===0||i===samples.length-1).map(s=>`${((Date.parse(s.time)-first)/span*800).toFixed(2)},${(38-s.flow_cfs/max*35).toFixed(2)}`);
  const line='M'+points.join('L');
  const paths=document.querySelectorAll('.hydrograph>svg>path');paths[0].setAttribute('d',line+'L800,40L0,40Z');paths[1].setAttribute('d',line);
  const tickTimes=[0,25,50,75,100].map(p=>sampleAtProgress(samples,p).time);
  document.querySelector('.time-ticks').innerHTML=tickTimes.map(t=>`<span>${new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric'}).format(new Date(t))}</span>`).join('');
}
function updateEvent(id){
  stopPlayback();state.eventId=id;state.source='observed';const e=currentEvent();state.progress=sampleProgress(e.samples,e.peak.time);
  document.querySelectorAll('[data-event]').forEach(b=>{const on=b.dataset.event===id;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',on);});
  $('peakFlow').innerHTML=`${formatNum(e.peak.flow_cfs)} <small>cfs</small>`;$('peakStage').innerHTML=`${e.peak.stage_ft.toFixed(2)} <small>ft</small>`;
  $('scenarioMode').textContent='Observed';$('scenarioMode').classList.add('active');$('modelMode').classList.remove('active');
  $('modelMode').innerHTML=state.predictions[id]?'Model':'Model <span>＋</span>';
  $('timeSlider').value=state.progress;updateChart();updateTime();
}
function updateTime(){
  if(!events)return;const e=currentEvent(),sample=sampleAtProgress(currentSamples(),state.progress);const width=previewWidth(sample.flow_cfs,e.peak.flow_cfs);
  $('chartCursor').style.left=`${state.progress}%`;
  $('timelineDate').textContent=timeShort(sample.time);
  $('phaseLabel').textContent=formatNum(sample.flow_cfs);
  document.querySelector('.phase-readout>span').textContent='FLOW · CFS';
  document.querySelector('.timeline-top .section-label').textContent=state.source==='model'?'IMPORTED MODEL SERIES':'OBSERVED GAUGE PLAYBACK';
  if(floodData)floodData.entities.values.forEach(entity=>{const next=Math.round(width/4)*4*entity._band;if(entity._lastWidth!==next){entity.corridor.width=next;entity._lastWidth=next;}});
  let count=0;
  buildingItems.forEach(item=>{const inCorridor=item.distance<=width/2;if(inCorridor)count++;if(item.inCorridor!==inCorridor){item.inCorridor=inCorridor;item.entity.polygon.material=C.Color.fromCssColorString(inCorridor?'#efd29c':'#e9eddb').withAlpha(.92);}});
  $('scenarioCount').textContent=formatNum(count);$('scenarioPercent').textContent=buildingItems.length?`${Math.round(count/buildingItems.length*100)}%`:'—';$('exposureBar').style.width=buildingItems.length?`${count/buildingItems.length*100}%`:'0';
  if(selection)showBuilding(selection);requestRender();
}
function stopPlayback(){state.playing=false;cancelAnimationFrame(animationId);$('playBtn').innerHTML=icon('play');$('playBtn').setAttribute('aria-label','Play observed hydrograph');}
function togglePlayback(){if(state.playing){stopPlayback();return;}state.playing=true;lastFrame=0;$('playBtn').textContent='Ⅱ';$('playBtn').setAttribute('aria-label','Pause playback');if(state.progress>=100)state.progress=0;
  const tick=t=>{if(!state.playing)return;if(!lastFrame)lastFrame=t;if(t-lastFrame<250){animationId=requestAnimationFrame(tick);return;}state.progress=Math.min(100,state.progress+(t-lastFrame)/650);lastFrame=t;$('timeSlider').value=state.progress;updateTime();if(state.progress>=100){stopPlayback();return;}animationId=requestAnimationFrame(tick);};animationId=requestAnimationFrame(tick);
}
function flyTo(lon,lat,range=6500,heading=-20,pitch=-43,duration=2){
  if(!viewer)return;
  viewer.camera.flyToBoundingSphere(new C.BoundingSphere(C.Cartesian3.fromDegrees(lon,lat,800),1),{duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:duration,offset:new C.HeadingPitchRange(C.Math.toRadians(heading),C.Math.toRadians(pitch),range)});
}
function homeView(){state.topDown=false;$('viewMode').textContent='2D';$('viewMode').setAttribute('aria-label','Switch to overhead view');flyTo(-82.84,35.435,8500,-25,-43);}
function stopTour(){clearTimeout(state.tourTimer);state.tourTimer=null;$('tourBtn').innerHTML=icon('play')+' Valley tour';}
function startTour(){
  if(state.tourTimer){stopTour();viewer.camera.cancelFlight();return;}
  const stops=[[-82.810686,35.417608,2700,10,-38,'Cruso · a community along the East Fork'],[-82.839,35.439,3800,-45,-35,'Follow the East Fork Pigeon River'],[-82.8697222,35.46166667,2700,-20,-40,'USGS 03456500 · the observed flow record']];let i=0;
  $('tourBtn').textContent='Stop tour';const next=()=>{if(i>=stops.length){stopTour();return;}const [lon,lat,r,h,p,label]=stops[i++];flyTo(lon,lat,r,h,p,3);toast(label);state.tourTimer=setTimeout(next,6500);};next();
}
function showBuilding(item){selection=item;$('selectionName').textContent=item.feature.properties.name||'Mapped building';const p=item.feature.properties;
  $('selectionDetails').innerHTML=`<dt>Map source</dt><dd>Microsoft / Esri</dd><dt>Type</dt><dd>${escapeHtml(p.building||'building')}</dd><dt>Preview overlap</dt><dd>${item.inCorridor?'Inside corridor':'Outside corridor'}</dd><dt>Rendered height</dt><dd>${item.height} m ${p.height_m?'':'(assumed)'}</dd><dt>View source</dt><dd><a href="${escapeHtml(p.source_url)}" target="_blank" rel="noreferrer">${escapeHtml(p.id||p.osm_id)} ↗</a></dd>`;
  $('selectionCard').hidden=false;
}

async function addGeography(){
  [buildingData,riverData,floodData,roadsData,placesData]=['Buildings','River network','Illustrative corridor','Roads','Places'].map(name=>new C.CustomDataSource(name));
  for(const data of [roadsData,floodData,riverData,buildingData,placesData])await viewer.dataSources.add(data);
  mainLines=geography.rivers.features.filter(f=>f.properties.main_river).map(f=>f.geometry.coordinates);
  const color=hex=>C.Color.fromCssColorString(hex);
  geography.roads.features.filter(f=>['primary','secondary','tertiary','residential','unclassified'].includes(f.properties.highway)).forEach((f,i)=>roadsData.entities.add({id:'road'+i,polyline:{positions:C.Cartesian3.fromDegreesArray(f.geometry.coordinates.flat()),clampToGround:true,width:f.properties.highway==='secondary'?2.2:1,material:color('#d5d9b3').withAlpha(.4)}}));
  geography.rivers.features.forEach((f,i)=>riverData.entities.add({id:'river'+i,polyline:{positions:C.Cartesian3.fromDegreesArray(f.geometry.coordinates.flat()),clampToGround:true,width:f.properties.main_river?2.3:1,material:color(f.properties.main_river?'#a6e2de':'#82b9b4').withAlpha(f.properties.main_river?.9:.45)}}));
  for(const [i,line]of mainLines.entries())for(const [band,hex,alpha]of [[1,'#8cd4d8',.42],[.64,'#32afb9',.44],[.29,'#287897',.62]]){
    const entity=floodData.entities.add({id:`flood-${i}-${band}`,corridor:{positions:C.Cartesian3.fromDegreesArray(line.flat()),width:180*band,material:color(hex).withAlpha(alpha),heightReference:C.HeightReference.CLAMP_TO_GROUND,cornerType:C.CornerType.ROUNDED,classificationType:C.ClassificationType.TERRAIN,zIndex:band===1?1:band===.64?2:3}});entity._band=band;
  }
  geography.buildings.features.forEach((f,i)=>{
    const ring=f.geometry.coordinates[0];const height=Number.isFinite(f.properties.height_m)?f.properties.height_m:6;
    const entity=buildingData.entities.add({id:'building'+i,polygon:{hierarchy:C.Cartesian3.fromDegreesArray(ring.flat()),height:0,heightReference:C.HeightReference.CLAMP_TO_GROUND,extrudedHeight:height,extrudedHeightReference:C.HeightReference.RELATIVE_TO_GROUND,material:color('#e9eddb').withAlpha(.92),outline:false}});
    const item={entity,feature:f,height,distance:distanceToLines(centroid(ring),mainLines),inCorridor:false};entity._building=item;buildingItems.push(item);
  });
  geography.places.features.forEach((f,i)=>{const [lon,lat]=f.geometry.coordinates;const gauge=f.properties.kind==='gauge';placesData.entities.add({id:'place'+i,position:C.Cartesian3.fromDegrees(lon,lat),point:{pixelSize:gauge?8:5,color:color(gauge?'#e6c782':'#eef3db'),outlineWidth:2,outlineColor:color('#375341'),heightReference:C.HeightReference.CLAMP_TO_GROUND,disableDepthTestDistance:Number.POSITIVE_INFINITY},label:{text:gauge?'USGS 03456500':'CRUSO',font:'12px sans-serif',fillColor:color('#f1f4e4'),outlineColor:color('#273e31'),outlineWidth:4,style:C.LabelStyle.FILL_AND_OUTLINE,pixelOffset:new C.Cartesian2(0,-23),heightReference:C.HeightReference.CLAMP_TO_GROUND,disableDepthTestDistance:Number.POSITIVE_INFINITY}});});
  $('buildingCount').textContent=formatNum(buildingItems.length);$('buildingLayerLabel').textContent=`${formatNum(buildingItems.length)} mapped · schematic heights`;
  const handler=new C.ScreenSpaceEventHandler(viewer.scene.canvas);handler.setInputAction(click=>{const picked=viewer.scene.pick(click.position);if(picked?.id?._building)showBuilding(picked.id._building);},C.ScreenSpaceEventType.LEFT_CLICK);
}

function openDialog(kind){
  if(assetViewer){assetViewer.destroy();assetViewer=null;}
  const el=$('dialogContent');
  if(kind==='equity')el.innerHTML=`<h2>Who is most exposed?</h2><p>Flood exposure is only half of the story. The next layer compares exposure across Census block groups using household income and population estimates.</p><div class="data-status"><b>Building footprints</b><span>${buildingItems.length} mapped in this window</span></div><div class="data-status"><b>ACS median household income</b><span class="data-tag">Not connected</span></div><div class="data-status"><b>Population exposure</b><span class="data-tag">Not estimated</span></div><div class="data-status"><b>Validated flood depths</b><span class="data-tag">Calibration required</span></div><h3>Before reporting disparities</h3><p>Join a calibrated depth raster to building footprints, then join buildings to Census block groups and ACS estimates for a documented vintage. Report sampling uncertainty and explain how population is allocated to buildings. A block group's income does not establish a specific household's income.</p><div class="note-box">The count in the sidebar is centroid overlap with an illustrative corridor. It does not measure historical inundation, affected residents, or income disparity.</div><p><a href="https://www.census.gov/programs-surveys/acs" target="_blank" rel="noreferrer">American Community Survey ↗</a></p>`;
  else if(kind==='model')el.innerHTML=`<h2>Bring in the model.</h2><p>NeuralHydrology predictions are not connected yet. Import a timestamped flow series to compare it with the observed hydrograph and drive the same illustrative corridor.</p><div class="note-box">Imported data stays in this browser tab. A series is labeled “Model”; importing it does not make it validated or turn the corridor into a hydraulic depth map.</div><h3>Prediction format</h3><p>A JSON object with <code>eventId</code> (${state.eventId}), <code>label</code>, <code>provenance</code>, and <code>samples</code> containing timezone-qualified <code>time</code> and numeric <code>flow_cfs</code>. Samples must be chronological and overlap this event.</p><div class="import-row"><label for="predictionFile">Import ${escapeHtml(currentEvent().name)} prediction</label><br><br><input id="predictionFile" type="file" accept="application/json,.json"><p id="importStatus" role="status"></p></div>${state.predictions[state.eventId]?`<h3>Loaded model</h3><p>${escapeHtml(state.predictions[state.eventId].label)} — ${escapeHtml(state.predictions[state.eventId].provenance)}</p><button class="download-link" id="activateModel">View model series</button>`:''}<p><a href="https://github.com/vrishinC/grokathon" target="_blank" rel="noreferrer">Integration instructions in the repository ↗</a></p>`;
  else if(kind==='assets'){
    el.innerHTML=`<h2>Built from open assets.</h2><p>This interactive rock model is <a href="https://polyhaven.com/a/rock_09" target="_blank" rel="noreferrer">Rock 09 by Jenelle van Heerden / Poly Haven</a>, released under <a href="https://polyhaven.com/license" target="_blank" rel="noreferrer">CC0</a>. Drag to inspect it.</p><div class="asset-preview"><div id="assetCanvas"></div></div><p>Illustrative scenery only. It is not a surveyed object in the Pigeon River basin. The map's buildings use Microsoft footprints, with a 6 m assumed height where height is unknown.</p>`;
  }else el.innerHTML=`<h2>Real records.<br>Transparent assumptions.</h2><p>This is the first working explorer for Aquatic Sustainability. It combines observed USGS hydrographs with a real geographic landscape, while keeping unvalidated spatial estimates visible as a preview.</p><div class="data-status"><b>Fred / 17 August 2021</b><span>19,800 cfs · 16.03 ft</span></div><div class="data-status"><b>Helene / 27 September 2024</b><span>15,900 cfs · 14.10 ft</span></div><div class="data-status"><b>Terrain & satellite imagery</b><span>Esri public services</span></div><div class="data-status"><b>Building footprints</b><span>Microsoft / Esri · ODbL</span></div><div class="data-status"><b>Rivers & roads</b><span>OpenStreetMap / ODbL</span></div><h3>How to read the water overlay</h3><p>The blue corridor is an illustrative buffer around the mapped East Fork. Its width follows the selected hydrograph, using 16 + 170 × √(flow / observed event peak) metres. The colors show nested buffer bands, not depth. They have not been calibrated with HAND, a rating curve or high-water marks.</p><h3>A gauge reading is not water depth</h3><p>Gauge stage uses a local vertical reference. The 16.03 ft and 14.10 ft readings cannot be subtracted from HAND directly. A calibrated conversion to reach-specific height above drainage is needed first. Terrain exaggeration is visual only.</p><h3>Scope of this first version</h3><p>The displayed area is a rectangular study window around Cruso and the gauge, not a delineated drainage basin. Microsoft building footprints are not event-specific and may differ from 2021/2024. Exposed-building counts use footprint centroids, and buildings are extruded 6 m unless a source height exists.</p><h3>Data you can inspect</h3><ul><li><a href="https://nwis.waterdata.usgs.gov/nwis/peak?site_no=03456500&agency_cd=USGS&format=rdb" target="_blank" rel="noreferrer">USGS annual peak-flow record</a> (Helene has discharge qualifier 9; see source notes).</li><li><a href="./data/observed-events.json" target="_blank">Bundled observed hydrographs and gauge metadata</a></li><li><a href="./data/provenance.json" target="_blank">Source links, collection window and limitations</a></li><li><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors / ODbL</a></li></ul><button class="download-link" id="assetsButton">Explore the Poly Haven 3D asset ↗</button><div class="note-box">Research prototype. No 10 m HAND raster, trained-model evaluation, high-water-mark validation, or Census disparity estimate has been completed in this version.</div>`;
  $('infoDialog').showModal();
  $('assetsButton')?.addEventListener('click',()=>openDialog('assets'));
  $('predictionFile')?.addEventListener('change',importPrediction);
  $('activateModel')?.addEventListener('click',activateModel);
  if(kind==='assets')setTimeout(showAsset,50);
}
async function importPrediction(event){const file=event.target.files[0];if(!file)return;try{if(file.size>4_000_000)throw new Error('Use a JSON file smaller than 4 MB.');const data=validatePrediction(JSON.parse(await file.text()),currentEvent());state.predictions[state.eventId]=data;activateModel();toast(`Loaded ${data.label}. Spatial overlay remains illustrative.`);}catch(e){$('importStatus').textContent=e.message;}}
function activateModel(){stopPlayback();state.source='model';state.progress=50;$('timeSlider').value=50;$('scenarioMode').classList.remove('active');$('modelMode').classList.add('active');$('modelMode').textContent='Model';$('infoDialog').close();updateChart();updateTime();}
async function showAsset(){try{assetViewer=new C.Viewer('assetCanvas',{globe:false,skyBox:false,skyAtmosphere:false,baseLayer:false,animation:false,timeline:false,baseLayerPicker:false,geocoder:false,homeButton:false,sceneModePicker:false,navigationHelpButton:false,fullscreenButton:false,infoBox:false,selectionIndicator:false,requestRenderMode:true});assetViewer.scene.backgroundColor=C.Color.fromCssColorString('#e5ecde');if(assetViewer.scene.sun)assetViewer.scene.sun.show=false;if(assetViewer.scene.moon)assetViewer.scene.moon.show=false;const model=await C.Model.fromGltfAsync({url:'./assets/nature/rock_09_1k.gltf',modelMatrix:C.Matrix4.IDENTITY,minimumPixelSize:160,imageBasedLighting:new C.ImageBasedLighting({imageBasedLightingFactor:new C.Cartesian2(1,0)})});if(!assetViewer||assetViewer.isDestroyed())return;assetViewer.scene.primitives.add(model);const fit=()=>{if(!assetViewer)return;const radius=model.boundingSphere.radius;assetViewer.scene.light=new C.DirectionalLight({direction:new C.Cartesian3(-.4,-.6,-1),intensity:2.5});assetViewer.camera.lookAtTransform(C.Matrix4.fromTranslation(model.boundingSphere.center),new C.HeadingPitchRange(.5,-.5,radius*2.6));assetViewer.scene.requestRender();};model.readyEvent.addEventListener(fit);assetViewer.scene.requestRender();}catch(e){console.error('Asset preview:',e);document.querySelector('.asset-preview').textContent='The 3D asset could not load: '+e.message;}}

document.querySelectorAll('[data-dialog]').forEach(b=>b.addEventListener('click',()=>openDialog(b.dataset.dialog)));
$('closeDialog').addEventListener('click',()=>$('infoDialog').close());$('infoDialog').addEventListener('close',()=>{if(assetViewer){assetViewer.destroy();assetViewer=null;}});
$('infoDialog').addEventListener('click',e=>{if(e.target===$('infoDialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
$('reloadMap').addEventListener('click',()=>location.reload());$('closeSelection').addEventListener('click',()=>{selection=null;$('selectionCard').hidden=true;});
$('exploreBtn').addEventListener('click',homeView);$('homeView').addEventListener('click',()=>{stopTour();homeView();});$('tourBtn').addEventListener('click',startTour);
$('zoomIn').addEventListener('click',()=>{if(viewer){viewer.camera.zoomIn(viewer.camera.positionCartographic.height*.25);requestRender();}});$('zoomOut').addEventListener('click',()=>{if(viewer){viewer.camera.zoomOut(viewer.camera.positionCartographic.height*.35);requestRender();}});
$('viewMode').addEventListener('click',()=>{state.topDown=!state.topDown;$('viewMode').textContent=state.topDown?'3D':'2D';$('viewMode').setAttribute('aria-label',state.topDown?'Switch to 3D valley view':'Switch to overhead view');flyTo(-82.84,35.435,state.topDown?11000:8500,-25,state.topDown?-89:-43);});
$('timeSlider').addEventListener('input',e=>{stopPlayback();state.progress=Number(e.target.value);updateTime();});$('playBtn').addEventListener('click',togglePlayback);
document.querySelectorAll('[data-event]').forEach(b=>b.addEventListener('click',()=>{if(events)updateEvent(b.dataset.event);}));
for(const [id,getData]of [['floodToggle',()=>floodData],['buildingsToggle',()=>buildingData],['riverToggle',()=>riverData]])$(id).addEventListener('change',e=>{if(getData())getData().show=e.target.checked;requestRender();});
document.querySelectorAll('[data-exaggeration]').forEach(b=>b.addEventListener('click',()=>{state.exaggeration=Number(b.dataset.exaggeration);if(viewer)viewer.scene.verticalExaggeration=state.exaggeration;document.querySelectorAll('[data-exaggeration]').forEach(el=>{const on=el===b;el.classList.toggle('active',on);el.setAttribute('aria-pressed',on);});requestRender();}));
$('scenarioMode').addEventListener('click',()=>{if(!events)return;state.source='observed';$('scenarioMode').classList.add('active');$('modelMode').classList.remove('active');updateChart();updateTime();});$('modelMode').addEventListener('click',()=>{if(events)openDialog('model');});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopPlayback();stopTour();}});

async function init(){
  try{events=await readJSON('./data/observed-events.json');updateEvent('fred');}catch(e){showError(e.message);return;}
  if(!C){showError('The Cesium 3D library could not load. Check your connection and reload.');return;}
  try{
    C.Ion.defaultAccessToken='';
    viewer=new C.Viewer('cesiumContainer',{baseLayer:false,animation:false,timeline:false,baseLayerPicker:false,geocoder:false,homeButton:false,sceneModePicker:false,navigationHelpButton:false,fullscreenButton:false,infoBox:false,selectionIndicator:false,requestRenderMode:true,maximumRenderTimeChange:Infinity,contextOptions:{webgl:{alpha:false}}});
    viewer.scene.backgroundColor=C.Color.fromCssColorString('#203b31');viewer.scene.globe.baseColor=C.Color.fromCssColorString('#425441');viewer.scene.globe.depthTestAgainstTerrain=false;viewer.scene.verticalExaggeration=3;viewer.scene.verticalExaggerationRelativeHeight=800;
    viewer.scene.globe.maximumScreenSpaceError=2;viewer.scene.fog.enabled=true;viewer.scene.skyAtmosphere.show=false;
    viewer.scene.screenSpaceCameraController.minimumZoomDistance=35;viewer.scene.screenSpaceCameraController.maximumZoomDistance=300000;
    const imagery=new C.UrlTemplateImageryProvider({url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',credit:'Imagery © Esri, Vantor, Earthstar Geographics, and the GIS User Community',maximumLevel:19});
    const layer=viewer.imageryLayers.addImageryProvider(imagery);layer.saturation=.75;layer.brightness=.86;layer.contrast=1.12;
    imagery.errorEvent.addEventListener(()=>{$('terrainStatus').textContent='Imagery connection limited';});
    viewer.cesiumWidget.creditDisplay.addStaticCredit(new C.Credit('Buildings © Microsoft / Esri · <a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap contributors</a>',true));
    homeView();
    const terrainPromise=C.ArcGISTiledElevationTerrainProvider.fromUrl('https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer').then(terrain=>{viewer.terrainProvider=terrain;$('terrainStatus').textContent='3D terrain · Esri';return terrain;}).catch(()=>{$('terrainStatus').textContent='Terrain unavailable · flat fallback';toast('Terrain service unavailable. The map is using a flat globe.');});
    const [buildings,rivers,roads,places]=await Promise.all(['buildings','rivers','roads','places'].map(f=>readJSON(`./data/${f}.geojson`)));geography={buildings,rivers,roads,places};await addGeography();updateTime();
    await Promise.race([terrainPromise,new Promise(resolve=>setTimeout(resolve,12000))]);$('mapLoading').hidden=true;requestRender();
    document.querySelector('.map-heading>div').innerHTML='Cruso valley <span>/ 35.42° N, 82.81° W</span>';
  }catch(e){showError(`The map could not initialize: ${e.message}`);console.error(e);}
}
init();
