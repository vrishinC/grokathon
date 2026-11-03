import * as THREE from './node_modules/three/build/three.module.js';

// All spatial geometry is procedural illustration, never measured inundation.
// The camera, water, lights and captions are functions of timeline time.
const query = new URLSearchParams(location.search);
const landscape = query.get('mode') === 'hero';
const W = landscape ? 1920 : 1080, H = landscape ? 1080 : 1920;
const film = document.querySelector('#film'); film.width = W; film.height = H;
const ctx = film.getContext('2d');
const renderer = new THREE.WebGLRenderer({canvas:document.querySelector('#scene'), antialias:true, preserveDrawingBuffer:true, alpha:false});
renderer.setSize(W,H); renderer.setPixelRatio(1); renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.3;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(); scene.background=new THREE.Color('#172f3c');
scene.fog = new THREE.FogExp2('#243e4a', .00125);
const camera = new THREE.PerspectiveCamera(49,W/H,.5,8000);
const hemi = new THREE.HemisphereLight('#a8d8e6','#263b2a',2.2); scene.add(hemi);
const sun = new THREE.DirectionalLight('#f1e9cf',3.2);sun.position.set(-500,900,300);scene.add(sun);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-750,right:750,top:750,bottom:-750,near:20,far:2200});sun.shadow.bias=-.0005;
const rim = new THREE.DirectionalLight('#51cce8',1.4);rim.position.set(500,300,-900);scene.add(rim);
const world = new THREE.Group();scene.add(world);
let seed=8917; function rand(){seed=(1664525*seed+1013904223)>>>0;return seed/4294967296}
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
const mix=(a,b,t)=>a+(b-a)*t;
const riverX=z=>42*Math.sin(z*.0044)+24*Math.sin(z*.009+1.5);
const bed=z=>4+(z+1050)*.002;
function height(x,z){const d=Math.abs(x-riverX(z));const ridge=Math.max(0,d-64);return bed(z)-1.4+Math.pow(d,1.24)*.045+Math.pow(ridge,1.28)*.13*(.73+.17*Math.sin(z*.005+x*.004)+.18*Math.cos(z*.013-x*.009)) + Math.max(0,d-80)*.04*Math.sin(z*.04+x*.027);}
const terrainG=new THREE.PlaneGeometry(2400,6500,280,600);terrainG.rotateX(-Math.PI/2);
const pa=terrainG.attributes.position; const colors=[];
for(let i=0;i<pa.count;i++){const x=pa.getX(i),z=pa.getZ(i),y=height(x,z);pa.setY(i,y);const d=Math.abs(x-riverX(z));const col=new THREE.Color();col.setRGB(.13+y*.00038,.22+y*.00026,.19+y*.00024);const grain=.91+.09*Math.sin(x*1.91+z*3.1);col.multiplyScalar(grain);if(d<30)col.lerp(new THREE.Color('#686957'),.28);colors.push(col.r,col.g,col.b);}
terrainG.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));terrainG.computeVertexNormals();
const terrainTextureCanvas=document.createElement('canvas');terrainTextureCanvas.width=terrainTextureCanvas.height=512;const textureContext=terrainTextureCanvas.getContext('2d');const textureImage=textureContext.createImageData(512,512);for(let i=0;i<512*512;i++){const v=145+rand()*70;textureImage.data.set([v,v,v,255],i*4)}textureContext.putImageData(textureImage,0,0);const terrainTexture=new THREE.CanvasTexture(terrainTextureCanvas);terrainTexture.wrapS=terrainTexture.wrapT=THREE.RepeatWrapping;terrainTexture.repeat.set(70,170);
const terrain=new THREE.Mesh(terrainG,new THREE.MeshStandardMaterial({vertexColors:true,map:terrainTexture,roughness:.98,metalness:0}));terrain.receiveShadow=true;world.add(terrain);

// Distant ridgelines make foreground camera movement readable through parallax.
for(let k=0;k<4;k++){const g=new THREE.PlaneGeometry(4200,1400,70,40);g.rotateX(-Math.PI/2);const p=g.attributes.position;for(let i=0;i<p.count;i++){let x=p.getX(i),z=p.getZ(i);p.setY(i,70+Math.pow(Math.max(0,Math.sin(x*.0027+k)+.52*Math.cos(z*.006-x*.0018)),2)*130);}g.computeVertexNormals();const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:new THREE.Color().setHSL(.47,.11,.17+k*.015),roughness:1}));m.position.set(0,-10,-3900-k*650);world.add(m);}

function strip(offset,width,material){const vertices=[],indices=[];for(let i=0;i<=420;i++){const z=-3200+i/420*6400;for(const side of [-1,1]){const x=riverX(z)+offset+side*width;vertices.push(x,height(x,z)+.36,z);}if(i<420){let n=i*2;indices.push(n,n+2,n+1,n+1,n+2,n+3);}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();const m=new THREE.Mesh(g,material);world.add(m);return m;}
strip(56,5.2,new THREE.MeshStandardMaterial({color:'#7d8077',roughness:.9}));
strip(56,.17,new THREE.MeshBasicMaterial({color:'#bcbba0'}));
strip(-66,3.5,new THREE.MeshStandardMaterial({color:'#686f67',roughness:.9}));

const trees=new THREE.Group();world.add(trees);
const trunkG=new THREE.CylinderGeometry(.5,.85,5,5),crownG=new THREE.IcosahedronGeometry(6.5,1);
const count=8500;
const trunks=new THREE.InstancedMesh(trunkG,new THREE.MeshStandardMaterial({color:'#423f33',roughness:1}),count);
const crowns=new THREE.InstancedMesh(crownG,new THREE.MeshStandardMaterial({color:'#24483b',roughness:1,flatShading:true}),count);
const obj=new THREE.Object3D();let n=0;
while(n<count){let x=(rand()-.5)*2200,z=(rand()-.5)*6100;let d=Math.abs(x-riverX(z));if(d<34 || (d<100&&rand()<.95))continue;let h=height(x,z),s=.65+rand()*.7;obj.position.set(x,h+2*s,z);obj.scale.set(s,s,s);obj.rotation.set(0,rand()*6.28,0);obj.updateMatrix();trunks.setMatrixAt(n,obj.matrix);obj.position.y=h+9*s;obj.scale.set(s,s*1.25,s);obj.updateMatrix();crowns.setMatrixAt(n,obj.matrix);crowns.setColorAt(n,new THREE.Color().setHSL(.37+rand()*.08,.18+rand()*.16,.18+rand()*.08));n++;}
crowns.castShadow=true;trees.add(trunks,crowns);

const houses=[];const roofG=new THREE.BufferGeometry();roofG.setAttribute('position',new THREE.Float32BufferAttribute([-.5,0,-.5,.5,0,-.5,0,1,-.5, -.5,0,.5,0,1,.5,.5,0,.5, -.5,0,-.5,0,1,-.5,0,1,.5, -.5,0,-.5,0,1,.5,-.5,0,.5, .5,0,-.5,.5,0,.5,0,1,.5, .5,0,-.5,0,1,.5,0,1,-.5],3));roofG.computeVertexNormals();
const cube=new THREE.BoxGeometry(1,1,1);
for(let i=0;i<118;i++){
 const z=-920+(i%59)*31+rand()*13,side=i<59?1:-1,x=riverX(z)+side*(30+rand()*76);
 if(Math.abs(Math.abs(x-riverX(z))-56)<10)continue;
 const y=height(x,z),group=new THREE.Group();group.position.set(x,y,z);group.rotation.y=.12*Math.sin(z*.012);
 const wide=9+rand()*6,deep=10+rand()*7,h=5+rand()*3;
 const wallMat=new THREE.MeshStandardMaterial({color:new THREE.Color().setHSL(.11,.08,.52+rand()*.2),roughness:.88,emissive:'#0f6a71',emissiveIntensity:0});
 const base=new THREE.Mesh(cube,wallMat);base.scale.set(wide,h,deep);base.position.y=h/2;base.castShadow=true;base.receiveShadow=true;group.add(base);
 const roof=new THREE.Mesh(roofG,new THREE.MeshStandardMaterial({color:i%4===0?'#6b5146':'#37484c',roughness:.8,side:THREE.DoubleSide}));roof.scale.set(wide*1.15,3.4,deep*1.15);roof.position.y=h;roof.castShadow=true;group.add(roof);
 const windows=new THREE.Mesh(cube,new THREE.MeshBasicMaterial({color:'#e3cda1'}));windows.scale.set(wide*.6,1.2,.13);windows.position.set(0,h*.58,deep/2+.1);group.add(windows);
 const porch=new THREE.Mesh(cube,new THREE.MeshStandardMaterial({color:'#929284'}));porch.scale.set(wide*.55,.6,3.5);porch.position.set(0,.3,deep/2+1.5);group.add(porch);
 world.add(group);houses.push({group,wallMat,x,z});
}

const waterG=new THREE.PlaneGeometry(230,6450,70,600);waterG.rotateX(-Math.PI/2);
const wp=waterG.attributes.position;for(let i=0;i<wp.count;i++){const z=wp.getZ(i);wp.setX(i,wp.getX(i)+riverX(z));wp.setY(i,bed(z)+.3)}waterG.computeVertexNormals();
const waterMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{time:{value:0},level:{value:0},opacity:{value:.92},purple:{value:0}},vertexShader:`varying vec3 vWorld; uniform float time; uniform float level; void main(){vec3 p=position;p.y+=level*5.6+.07*sin(p.z*.28+time*2.1)+.05*cos(p.x*.41-time);vWorld=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}`,fragmentShader:`varying vec3 vWorld;uniform float time;uniform float level;uniform float opacity;uniform float purple;void main(){float rip=sin(vWorld.z*.65+vWorld.x*.17-time*2.8)*sin(vWorld.x*.47-time*1.1+vWorld.z*.1);float flow=.5+.5*sin(vWorld.x*.13+vWorld.z*.31-time*1.6);vec3 deep=mix(vec3(.015,.19,.24),vec3(.18,.12,.38),purple);vec3 light=mix(vec3(.22,.69,.71),vec3(.51,.39,.82),purple);vec3 c=mix(deep,light,.3+flow*.22+pow(max(0.,rip),15.)*.65);float glint=pow(max(0.,sin(vWorld.z*1.8+vWorld.x*.3-time*3.)),36.);c+=vec3(.09,.14,.16)*glint;gl_FragColor=vec4(c,opacity);}`});
const water=new THREE.Mesh(waterG,waterMaterial);world.add(water);

const fineGrid=new THREE.Group();world.add(fineGrid);
const gridPts=[];for(let x=-280;x<=280;x+=16){for(let z=-650;z<650;z+=16){gridPts.push(x,height(x,z)+.75,z,x,height(x,z+16)+.75,z+16,z===-650?x:x,height(x,z)+.75,z,x+16,height(x+16,z)+.75,z);}}
const gridM=new THREE.LineBasicMaterial({color:'#70e7df',transparent:true,opacity:.42});const grid=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(gridPts,3)),gridM);fineGrid.add(grid);
const coarseGrid=new THREE.GridHelper(1600,4,'#a8eee1','#a8eee1');coarseGrid.position.y=180;coarseGrid.material.transparent=true;coarseGrid.material.opacity=.65;world.add(coarseGrid);

const rainN=1600,rainP=new Float32Array(rainN*6);for(let i=0;i<rainN;i++){const x=(rand()-.5)*700,y=rand()*300,z=(rand()-.5)*1500;rainP.set([x,y,z,x-1,y-10,z+1],i*6)}
const rain=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(rainP,3)),new THREE.LineBasicMaterial({color:'#bdd7db',transparent:true,opacity:.24}));scene.add(rain);
const impact=new THREE.Group();world.add(impact);
for(let i=0;i<8;i++){const z=-390+i*110,x=riverX(z)+((i%2)*2-1)*61;const g=new THREE.RingGeometry(18,18.5,64);g.rotateX(-Math.PI/2);const ring=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:i%2?'#dfb985':'#5ce0d4',transparent:true,opacity:.6,side:THREE.DoubleSide,depthTest:false}));ring.position.set(x,height(x,z)+1,z);impact.add(ring);}
const events=await fetch('../dist/data/observed-events.json').then(r=>r.json());
const fred=events.events.find(e=>e.id==='fred'), helene=events.events.find(e=>e.id==='helene');

function path(a,b,u,targetA,targetB){u=smooth(u);camera.position.set(...a.map((v,i)=>mix(v,b[i],u)));camera.lookAt(new THREE.Vector3(...targetA.map((v,i)=>mix(v,targetB[i],u))));}
function font(size,weight=800){ctx.font=`${weight} ${size}px Arial, Helvetica, sans-serif`;}
function label(s,x,y,size=24,color='#a8d2d5',spacing=3){ctx.fillStyle=color;font(size,600);ctx.letterSpacing=`${spacing}px`;ctx.fillText(s,x,y);ctx.letterSpacing='0px';}
function lines(words,y,size=90,{color='#f0f1e8',align='left',x=82,leading=1.02,alpha=1}={}){ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.textAlign=align;font(size,900);for(let i=0;i<words.length;i++)ctx.fillText(words[i],x,y+size*leading*i);ctx.restore();}
function tag(text,y=280,color='#74e3db'){ctx.fillStyle=color;ctx.fillRect(82,y-21,38,3);label(text,136,y-12,21,color,2.2)}
function metric(value,unit,y){lines([value],y,148);label(unit,86,y+45,24,'#b9d4d3',2.4);}
function fade(t,a,b,d=.2){return smooth((t-a)/d)*smooth((b-t)/d)}

function overlays(t){
 ctx.save();
 // Persistent safe-area scientific provenance, visible in the master.
 const shade=ctx.createLinearGradient(0,0,0,H);shade.addColorStop(0,'rgba(3,13,22,.72)');shade.addColorStop(.30,'rgba(3,13,22,0)');shade.addColorStop(.54,'rgba(3,13,22,0)');shade.addColorStop(1,'rgba(3,13,22,.94)');ctx.fillStyle=shade;ctx.fillRect(0,0,W,H);
 label('AQUATIC / FIELD NOTES',82,120,22,'#e0ebe4',3.2);
 ctx.fillStyle='#70e6d7';ctx.beginPath();ctx.arc(84,166,4,0,Math.PI*2);ctx.fill();label('EAST FORK PIGEON RIVER',102,174,17,'#9bbfc5',2.2);
 ctx.fillStyle='rgba(202,231,226,.18)';ctx.fillRect(82,1743,916,1);label('ILLUSTRATIVE 3D SCENE · RESEARCH PREVIEW',82,1785,18,'#a0b7bd',1.2);
 label('USGS 03456500 / OBSERVED EVENT PEAKS',82,1817,16,'#7f9aa4',1.2);
 ctx.fillStyle='rgba(193,224,223,.2)';ctx.fillRect(82,1866,916,3);ctx.fillStyle='#70e6d7';ctx.fillRect(82,1866,916*clamp(t/34),3);
 label(`${String(Math.floor(t)).padStart(2,'0')} / 34`,882,1724,18,'#a4bcc2',1);
 if(t<2){const a=fade(t,0,2,.16);ctx.globalAlpha=a;tag('01 / THE BLIND SPOT');lines(['THIS MAP','CAN’T SEE','YOUR HOUSE.'],1270,103);label('~110 KM REGIONAL CELL',86,1635,26,'#70e6d7',2.4);}
 else if(t<5){ctx.globalAlpha=fade(t,2,5);tag('RISK IS LOCAL');lines(['BUT FLOODS','HAPPEN STREET','BY STREET.'],1320,89);label('ROADS. HOMES. PEOPLE.',86,1642,23,'#70e6d7',2.4);}
 else if(t<8){ctx.globalAlpha=fade(t,5,8);tag('02 / CHANGE THE SCALE');let p=smooth((t-5.5)/1.3);lines([p<.5?'110 KM':'~10 M'],1315,p<.5?140:163);label(p<.5?'REGIONAL PROBABILITY':'RESEARCH RESOLUTION TARGET',86,1390,22,'#70e6d7',2);lines(['A BETTER VIEW.'],1570,69);}
 else if(t<11){ctx.globalAlpha=fade(t,8,11);tag('03 / THE STUDY VALLEY');lines(['WESTERN','NORTH CAROLINA.'],1350,83);label('EAST FORK PIGEON RIVER',86,1605,25,'#70e6d7',2);label('NEAR CANTON / HAYWOOD COUNTY',86,1650,19,'#a7c3c8',2);}
 else if(t<15){ctx.globalAlpha=fade(t,11,15);tag('AUG 17, 2021');lines(['TROPICAL','STORM FRED'],1150,91);metric(fred.peak.flow_cfs.toLocaleString('en-US'),'CFS / RECORDED PEAK FLOW',1500);label(`${fred.peak.stage_ft.toFixed(2)} FT GAUGE STAGE`,86,1635,25,'#70e6d7',2);label('GAUGE STAGE IS NOT BUILDING WATER DEPTH',86,1685,17,'#a7c3c8',1);}
 else if(t<19){ctx.globalAlpha=fade(t,15,19);tag('04 / FROM FLOW TO DEPTH');const steps=['NEURALHYDROLOGY','RIVER FLOW','RIVER HEIGHT','HAND TERRAIN','FLOOD DEPTH'];const act=Math.min(4,Math.floor((t-15)*1.4));for(let i=0;i<steps.length;i++){const y=1190+i*93;ctx.fillStyle=i===act?'#70e6d7':'#9baeb4';font(i===act?46:36,700);ctx.fillText(steps[i],132,y);ctx.fillStyle=i===act?'#70e6d7':'#56717b';ctx.beginPath();ctx.arc(91,y-14,i===act?7:4,0,7);ctx.fill();if(i<4){ctx.fillRect(90,y+5,2,44)}}label('METHOD CONCEPT · CALIBRATION REQUIRED',86,1680,18,'#9fb8bf',1);}
 else if(t<22){ctx.globalAlpha=fade(t,19,22);tag('05 / TEST AGAINST HISTORY');ctx.fillStyle='rgba(219,239,236,.6)';ctx.fillRect(W/2,300,1,745);label('MEASURED',82,360,22,'#79e3d9',1.8);label('PREDICTED',600,360,22,'#b4adf1',1.8);lines(['COMPARE WITH','REAL FLOODS.'],1350,84);label('OBSERVED GAUGE DATA AVAILABLE',86,1595,22,'#70e6d7',1.4);label('PREDICTION + DEPTH LAYERS: RESEARCH TARGET',86,1640,17,'#b7b2e9',1);}
 else if(t<24.5){ctx.globalAlpha=fade(t,22,24.5);tag('06 / THE HUMAN QUESTION');lines(['DEPTH IS ONLY','HALF THE STORY.'],1390,83);}
 else if(t<27){ctx.globalAlpha=fade(t,24.5,27);tag('PEOPLE & PLACE');lines(['WHO WAS','IN THE WATER?'],1370,99);label('CONNECT FLOOD RISK + COMMUNITY DATA',86,1650,20,'#70e6d7',1.7);}
 else if(t<30){ctx.globalAlpha=fade(t,27,30);tag('07 / MORE THAN ONE STORM');lines(['HURRICANE','HELENE'],1130,87);label('SEP 27, 2024',86,1355,27,'#a9c7ce',2);metric(helene.peak.flow_cfs.toLocaleString('en-US'),'CFS / RECORDED PEAK FLOW',1530);label(`${helene.peak.stage_ft.toFixed(2)} FT GAUGE STAGE`,86,1662,24,'#70e6d7',2);}
 else {ctx.globalAlpha=fade(t,30,34,.45);tag('MAKE RISK VISIBLE');lines(['AQUATIC'],1240,119);lines(['SUSTAINABILITY'],1330,62);lines(['SEE THE WATER.','SEE WHO IT REACHES.'],1530,51,{color:'#8de4dc',leading:1.25});label('REAL EVENTS. A MORE HUMAN VIEW.',86,1680,19,'#b5cbd0',1.5);}
 ctx.restore();
}

window.renderFrame=(t)=>{
 let level=0;rain.visible=false;impact.visible=false;fineGrid.visible=false;coarseGrid.visible=false;world.position.y=0;waterMaterial.uniforms.purple.value=0;hemi.intensity=2.2;sun.intensity=3.2;scene.fog.density=.00125;
 if(landscape){const a=t/10*Math.PI*2;path([220+35*Math.sin(a),195+8*Math.cos(a),420+22*Math.cos(a)],[220+35*Math.sin(a),195+8*Math.cos(a),420+22*Math.cos(a)],0,[0,18,-95],[0,18,-95]);level=.56+.13*Math.sin(a);}
 else if(t<2){path([430,850,970],[260,500,600],t/2,[0,10,-150],[0,20,-80]);coarseGrid.visible=true;}
 else if(t<5){path([260,500,600],[68,110,195],(t-2)/3,[0,20,-80],[0,8,-120]);coarseGrid.visible=true;coarseGrid.position.y=180-100*smooth((t-2)/3);}
 else if(t<8){path([230,400,390],[100,255,205],(t-5)/3,[0,0,-30],[0,0,-130]);fineGrid.visible=true;gridM.opacity=.1+.55*smooth((t-5)/1.4);level=.10;}
 else if(t<11){path([190,150,460],[50,58,155],(t-8)/3,[0,20,0],[0,12,-170]);level=.12;}
 else if(t<15){path([55,70,175],[-50,52,5],(t-11)/4,[0,8,-130],[-25,10,-210]);level=.1+.85*smooth((t-11)/3.2);rain.visible=true;hemi.intensity=1.65;sun.intensity=1.9;}
 else if(t<19){path([160,215,230],[260,290,125],(t-15)/4,[0,0,-110],[0,0,-80]);level=.8;fineGrid.visible=true;gridM.opacity=.22+.14*Math.sin(t*3);}
 else if(t<22){path([110,175,220],[-60,170,135],(t-19)/3,[0,0,-120],[0,0,-100]);level=.77;}
 else if(t<24.5){path([-90,46,110],[-57,32,25],(t-22)/2.5,[-12,12,-80],[3,12,-70]);level=.86;impact.visible=true;}
 else if(t<27){path([-57,65,110],[150,240,230],(t-24.5)/2.5,[0,10,-80],[0,10,-85]);level=.84;impact.visible=true;}
 else if(t<30){path([145,150,290],[-95,135,115],(t-27)/3,[0,10,-120],[0,10,-160]);level=.7;rain.visible=true;sun.intensity=2;}
 else{path([-100,160,160],[320,590,780],(t-30)/4,[0,10,-140],[0,10,-220]);level=.8-.3*smooth((t-30)/4);hemi.intensity=1.75;sun.intensity=2.4;}
 waterMaterial.uniforms.time.value=t;waterMaterial.uniforms.level.value=level;
 for(const h of houses){const d=Math.abs(h.x-riverX(h.z));h.wallMat.emissiveIntensity=d<25+level*63 ? .3+.12*Math.sin(t*2+h.z):0;}
 rain.position.y=-(t*65%180);
 for(let i=0;i<impact.children.length;i++){const r=impact.children[i];const s=1+.08*Math.sin(t*2+i);r.scale.set(s,s,s);r.material.opacity=.4+.2*Math.sin(t*2+i);}
 renderer.setScissorTest(false);renderer.render(scene,camera);
 if(!landscape&&t>=19&&t<22){renderer.setScissorTest(true);renderer.setScissor(W/2,0,W/2,H);waterMaterial.uniforms.purple.value=1;renderer.render(scene,camera);renderer.setScissorTest(false);waterMaterial.uniforms.purple.value=0;}
 ctx.clearRect(0,0,W,H);ctx.drawImage(renderer.domElement,0,0);
 if(!landscape)overlays(t);
 else{const g=ctx.createLinearGradient(0,0,W,0);g.addColorStop(0,'rgba(3,13,20,.35)');g.addColorStop(1,'rgba(3,13,20,0)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);}
 return film.toDataURL('image/jpeg',.95);
};
window.rendererReady=true;window.renderFrame(landscape?0:10);
if(query.has('preview')){const began=performance.now();function tick(){window.renderFrame(((performance.now()-began)/1000)%(landscape?10:34));requestAnimationFrame(tick)}requestAnimationFrame(tick)}
