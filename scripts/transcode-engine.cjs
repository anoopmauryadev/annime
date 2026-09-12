const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const profiles = [
  { name:'360p', width:640, height:360, bitrate:'800k', audioBitrate:'64k' },
  { name:'480p', width:854, height:480, bitrate:'1200k', audioBitrate:'96k' },
];
const atomicWrite = (file,text) => { fs.writeFileSync(file+'.tmp',text); fs.renameSync(file+'.tmp',file); };
function renditionReady(file) {
  try {
    const text=fs.readFileSync(file,'utf8');
    const segments=text.split(/\r?\n/).map(line=>line.trim()).filter(line=>line&&!line.startsWith('#'));
    return text.startsWith('#EXTM3U')&&text.includes('#EXT-X-ENDLIST')&&segments.length>0&&segments.every(name=>
      /^[a-zA-Z0-9_-]+\.ts$/.test(name)&&fs.statSync(path.join(path.dirname(file),name)).size>0);
  }catch{return false;}
}
const probe = input => new Promise((resolve,reject) => execFile('ffprobe',['-v','error','-show_streams','-of','json',input],{maxBuffer:1024*1024,timeout:30000},(e,out)=> {
  if(e) return reject(e); try {resolve(JSON.parse(out).streams);} catch(e) {reject(e);}
}));
async function processMedia({input,output,threads,run,progress,publish,sourceQuality=0,inspect=()=>{}}) {
  const sourceStreams=await probe(input);
  const sourceVideo=sourceStreams.find(s=>s.codec_type==='video');
  if(!sourceVideo)throw new Error('No video stream');
  const warning=sourceQuality && sourceVideo.height!==sourceQuality ? `Selected ${sourceQuality}p; detected ${sourceVideo.height}p. Using actual resolution.` : '';
  inspect({height:sourceVideo.height,videoCodec:sourceVideo.codec_name,audioCodec:sourceStreams.find(s=>s.codec_type==='audio')?.codec_name || '',warning});
  if(sourceQuality) sourceQuality=sourceVideo.height;
  const safeVideo=sourceVideo.codec_name==='h264' && ['yuv420p','yuvj420p'].includes(sourceVideo.pix_fmt);
  const selectedHeight=sourceQuality || (safeVideo && [360,480].includes(sourceVideo.height) ? sourceVideo.height : 0);
  sourceQuality=selectedHeight;
  const selected=sourceQuality ? {name:`${sourceQuality}p`,width:sourceVideo.width,height:sourceVideo.height,bitrate:`${Math.ceil(Number(sourceVideo.bit_rate || 5000000)/1000)}k`,audioBitrate:'128k'} : null;
  const workProfiles=selected ? [selected,...profiles.filter(p=>p.height<sourceQuality)] : profiles.filter(p=>p.height<=sourceVideo.height);
  const completed=[];
  for(const p of workProfiles) {
    const playlist=path.join(output,`${p.name}.m3u8`);
    // Completed variants survive retries; never truncate a rendition being watched.
    if(!renditionReady(playlist)) {
      progress(selected && p.height===sourceQuality && safeVideo ? `Packaging ${p.name} without video re-encoding...` : `Transcoding ${p.name}...`);
      const temp=path.join(output,`.${p.name}-work`); fs.mkdirSync(temp,{recursive:true});
      const sameSource=selected && p.height===sourceQuality;
      const copyVideo=sameSource && safeVideo;
      const videoArgs=copyVideo ? ['-c:v','copy'] : sameSource ? ['-c:v','libx264','-pix_fmt','yuv420p','-preset','veryfast','-crf','20','-threads',String(threads)] : [
        '-vf',`scale=${p.width}:${p.height}:force_original_aspect_ratio=decrease,pad=${p.width}:${p.height}:(ow-iw)/2:(oh-ih)/2,setsar=1`,
        '-c:v','libx264','-pix_fmt','yuv420p','-preset','veryfast','-threads',String(threads),'-b:v',p.bitrate,'-maxrate',p.bitrate,'-bufsize',`${parseInt(p.bitrate)*2}k`];
      await run(['-y','-threads',String(threads),'-filter_threads','1','-i',input,'-map','0:v:0','-map','0:a:0?',...videoArgs,
        ...(copyVideo ? [] : ['-force_key_frames','expr:gte(t,n_forced*4)']),
        ...(sameSource && sourceStreams.find(s=>s.codec_type==='audio')?.codec_name==='aac' ? ['-c:a','copy'] : ['-c:a','aac','-b:a',p.audioBitrate,'-ac','2']),
        '-hls_time','4','-hls_playlist_type','vod',
        '-hls_segment_filename',path.join(temp,`${p.name}_%05d.ts`),path.join(temp,`${p.name}.m3u8`)]);
      for(const name of fs.readdirSync(temp).filter(n=>n.endsWith('.ts'))) fs.renameSync(path.join(temp,name),path.join(output,name));
      fs.renameSync(path.join(temp,`${p.name}.m3u8`),playlist);
      fs.rmdirSync(temp);
    }
    completed.push(p);
    atomicWrite(path.join(output,'master.m3u8'),'#EXTM3U\n#EXT-X-VERSION:3\n'+completed.map(v=>`#EXT-X-STREAM-INF:BANDWIDTH=${(parseInt(v.bitrate)+parseInt(v.audioBitrate))*1100},RESOLUTION=${v.width}x${v.height}\n${v.name}.m3u8\n`).join(''));
    publish();
  }
  // Preserve source resolution. Copy browser-safe video; encode unsupported codecs only.
  const original=path.join(output,'original.mp4');
  if(!fs.existsSync(original)) {
    progress('Preparing Original Quality (VIP)...');
    const originalInput=selected ? path.join(output,selected.name+'.m3u8') : input;
    const streams=selected ? await probe(originalInput) : sourceStreams;
    const video=streams.find(s=>s.codec_type==='video');
    const audio=streams.find(s=>s.codec_type==='audio');
    if(!video) throw new Error('No video stream');
    const copyVideo=video.codec_name==='h264' && ['yuv420p','yuvj420p'].includes(video.pix_fmt);
    const temp=path.join(output,'.original.partial.mp4');
    await run(['-y','-threads',String(threads),'-filter_threads','1','-i',originalInput,'-map','0:v:0','-map','0:a:0?',
      ...(copyVideo ? ['-c:v','copy'] : ['-vf','scale=trunc(iw/2)*2:trunc(ih/2)*2','-c:v','libx264','-pix_fmt','yuv420p','-preset','veryfast','-crf','20','-threads',String(threads)]),
      ...(audio?.codec_name==='aac' ? ['-c:a','copy'] : ['-c:a','aac','-b:a','128k','-ac','2']),
      '-movflags','+faststart',temp]);
    fs.renameSync(temp,original);
  }
  return completed.map(p=>p.name);
}
module.exports={processMedia,profiles};
