const fs=require('fs');
const {Readable}=require('stream');
// A per-transfer cap keeps background source/replica traffic below serving capacity.
function limitedFile(file,mbps=20){
 const bytesPerSecond=Math.max(1,Math.min(100,Number(mbps)||20))*1e6/8;
 return Readable.from((async function*(){const start=Date.now();let sent=0;for await(const chunk of fs.createReadStream(file,{highWaterMark:64*1024})){sent+=chunk.length;const delay=sent/bytesPerSecond*1000-(Date.now()-start);if(delay>0)await new Promise(r=>setTimeout(r,delay));yield chunk;}})());
}
module.exports={limitedFile};
