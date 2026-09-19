const assert=require('assert/strict'),fs=require('fs'),fsp=require('fs/promises'),os=require('os'),path=require('path');
const {execFile}=require('child_process'),{promisify}=require('util');
const exec=promisify(execFile),{processMedia}=require('./transcode-engine.cjs');
(async()=>{
 const root=await fsp.mkdtemp(path.join(os.tmpdir(),'cluster-encoding-'));
 try{
  const input=path.join(root,'source');
  await exec('ffmpeg',['-v','error','-y','-f','lavfi','-i','testsrc2=size=854x480:rate=12','-t','8','-c:v','libx264','-pix_fmt','yuv420p','-f','matroska',input]);
  for(const quality of ['360p','480p','original']){
   const output=path.join(root,quality);await fsp.mkdir(output);const commands=[];
   await processMedia({input,output,threads:1,onlyQuality:quality,progress:()=>{},publish:()=>{},run:args=>{commands.push(args);return exec('ffmpeg',['-v','error',...args]);}});
   const files=fs.readdirSync(output);
   assert(files.includes(quality==='original'?'original.mp4':quality+'.m3u8'));
   if(quality!=='original')assert(!files.includes('original.mp4'));
   if(quality==='480p')assert.equal(commands[0][commands[0].indexOf('-c:v')+1],'copy','matching source should remux');
   if(quality==='original')assert(!files.some(f=>f.endsWith('.m3u8')));
  }
  const output=path.join(root,'partial');await fsp.mkdir(output);
  await assert.rejects(processMedia({input,output,threads:1,onlyQuality:'360p',progress:()=>{},publish:()=>{throw Error('must not publish');},run:args=>exec('ffmpeg',['-v','error',...args.slice(0,-1),'-t','1',args.at(-1)])}),/Incomplete rendition/);
  assert(!fs.existsSync(path.join(output,'360p.m3u8')));
  console.log('PASS: independent 360p/480p/Original jobs, source remux, incomplete-duration publication rejected');
 }finally{await fsp.rm(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
