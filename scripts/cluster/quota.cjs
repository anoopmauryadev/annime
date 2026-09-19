const fs=require('fs'),path=require('path'),os=require('os');
const {spawn}=require('child_process');
async function createQuota(initial){
 if(process.platform==='linux'){
  const group=fs.readFileSync('/proc/self/cgroup','utf8').split('\n').find(s=>s.startsWith('0::'))?.slice(3);
  if(!group)throw Error('cgroup v2 required');
  const base=path.join('/sys/fs/cgroup',group),leaf=path.join(base,'annime-encode');
  fs.mkdirSync(leaf,{recursive:true});fs.writeFileSync(path.join(leaf,'cgroup.procs'),String(process.pid));
  fs.writeFileSync(path.join(base,'cgroup.subtree_control'),'+cpu');
  const update=value=>fs.writeFileSync(path.join(leaf,'cpu.max'),`${Math.round(value*1000)} 100000`);
  update(initial);return {update,close(){}};
 }
 if(process.platform==='win32'){
  const rate=value=>Math.max(1,Math.min(10000,Math.round(value*100/os.cpus().length)));
  const helper=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'windows-quota.ps1'),'-WorkerPid',String(process.pid),'-InitialRate',String(rate(initial))],{stdio:['pipe','pipe','pipe'],windowsHide:true});
  await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>{helper.kill();reject(Error('Windows CPU quota setup timed out'));},15000);helper.stdout.on('data',b=>{output+=b;if(output.includes('READY')){clearTimeout(timer);resolve();}});helper.once('error',e=>{clearTimeout(timer);reject(e);});helper.once('exit',()=>{clearTimeout(timer);reject(Error('Windows CPU quota setup failed'));});});
  helper.once('exit',()=>process.kill(process.pid,'SIGTERM'));
  return {update(value){helper.stdin.write(rate(value)+'\n');},close(){helper.stdin.end();}};
 }
 throw Error('Distributed transcoding requires Linux cgroup v2 or Windows Job Objects');
}
module.exports={createQuota};
