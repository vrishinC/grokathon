import {chromium} from 'playwright-core';
import {createServer} from 'node:http';
import {readFile, mkdir, writeFile, copyFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url)),root=path.dirname(here);
const mode=process.argv.includes('--hero')?'hero':'story';
const sample=process.argv.includes('--sample');
const duration=mode==='hero'?10:34, fps=30;
const output=path.join(root,'public/videos',mode==='hero'?'aquatic-hero-loop.mp4':'aquatic-sustainability-story.mp4');
const mime={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.json':'application/json'};
const server=createServer(async(req,res)=>{try{let p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!p.startsWith(root+path.sep))throw new Error('outside root');const buf=await readFile(p);res.setHeader('Content-Type',mime[path.extname(p)]||'application/octet-stream');res.end(buf)}catch{res.statusCode=404;res.end('Not found')}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
const chrome=process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=metal','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
try{
 const page=await browser.newPage({viewport:mode==='hero'?{width:1920,height:1080}:{width:1080,height:1920},deviceScaleFactor:1});
 page.on('pageerror',e=>console.error('Page error:',e.message));
 await page.goto(`http://127.0.0.1:${port}/video/scene.html?mode=${mode}`);await page.waitForFunction(()=>window.rendererReady,{timeout:60000});
 await mkdir(path.dirname(output),{recursive:true});await mkdir(path.join(root,'dist/videos'),{recursive:true});
 if(sample){for(const t of mode==='hero'?[0,5]:[0.8,3.5,6.8,9.5,13,17,20.5,23.5,25.5,28.5,32.5]){const data=await page.evaluate(t=>window.renderFrame(t),t);await writeFile(path.join(here,`sample-${mode}-${t}.jpg`),Buffer.from(data.split(',')[1],'base64'));}console.log('Sample frames written.');}
 else{
  const withAudio=mode==='story';
  const args=['-y','-hide_banner','-loglevel','error','-f','image2pipe','-vcodec','mjpeg','-framerate',String(fps),'-i','pipe:0'];
  if(withAudio)args.push('-i',path.join(here,'audio.wav'));
  args.push('-c:v','libx264','-preset','fast','-crf',mode==='hero'?'24':'19','-pix_fmt','yuv420p','-r',String(fps));
  if(withAudio)args.push('-c:a','aac','-b:a','192k','-shortest');
  else args.push('-an');
  args.push('-movflags','+faststart','-metadata','title=Aquatic Sustainability — See who it reaches','-metadata','comment=Procedural illustrative spatial scene. Recorded USGS peak flow and gauge stage. Research demonstration, not a warning product.',output);
  const ff=spawn('ffmpeg',args,{stdio:['pipe','inherit','inherit']});
  let early;ff.on('exit',code=>{if(code!==0)early=new Error(`ffmpeg exited ${code}`)});
  for(let frame=0;frame<duration*fps;frame++){
   if(early)throw early;
   const data=await page.evaluate(t=>window.renderFrame(t),frame/fps);
   const bytes=Buffer.from(data.split(',')[1],'base64');
   if(!ff.stdin.write(bytes))await once(ff.stdin,'drain');
   if(frame===Math.round((mode==='hero'?1:9.5)*fps))await writeFile(path.join(root,'public/videos',mode==='hero'?'aquatic-hero-poster.jpg':'aquatic-story-poster.jpg'),bytes);
   if(frame%90===0)console.log(`${mode}: ${frame}/${duration*fps} frames`);
  }
  ff.stdin.end();const [code]=await once(ff,'exit');if(code!==0)throw new Error(`ffmpeg failed ${code}`);
  await copyFile(output,path.join(root,'dist/videos',path.basename(output)));
  const poster=mode==='hero'?'aquatic-hero-poster.jpg':'aquatic-story-poster.jpg';await copyFile(path.join(root,'public/videos',poster),path.join(root,'dist/videos',poster));
  console.log(`Rendered ${output}`);
 }
}finally{await browser.close();server.close();}
