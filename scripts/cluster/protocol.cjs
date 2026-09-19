const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
function safePath(value) {
  return typeof value === 'string' && value.length < 512 && /^(hls|videos)\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_.-]+)?$/.test(value) &&
    value.split('/').every(p => p !== '.' && p !== '..' && !p.startsWith('.'));
}
function secret(value) {
  if (typeof value !== 'string' || value.length < 32) throw Error('Configure a unique secret of at least 32 characters');
  return value;
}
function sign(key, file, ttl = 90) {
  if (!safePath(file)) throw Error('Invalid media path');
  const data = Buffer.from(JSON.stringify({path:file, exp:Math.floor(Date.now()/1000)+ttl})).toString('base64url');
  return data+'.'+crypto.createHmac('sha256',secret(key)).update(data).digest('base64url');
}
function equal(a,b) {
  const aa=Buffer.from(String(a || '')), bb=Buffer.from(String(b || ''));
  return aa.length===bb.length && crypto.timingSafeEqual(aa,bb);
}
function verify(key,token,file) {
  try {
    if (typeof token!=='string' || token.length>2048 || !safePath(file)) return false;
    const [data,sig,...extra]=token.split('.');
    if(extra.length || !equal(sig,crypto.createHmac('sha256',secret(key)).update(data).digest('base64url')))return false;
    const payload=JSON.parse(Buffer.from(data,'base64url').toString());
    return payload.path===file && Number.isSafeInteger(payload.exp) && payload.exp> Date.now()/1000 && payload.exp<=Date.now()/1000+120;
  } catch { return false; }
}
function resolveFile(root,file) {
  if(!safePath(file))throw Error('Invalid path');
  const base=fs.realpathSync(root), target=fs.realpathSync(path.join(base,file));
  if(!target.startsWith(base+path.sep)||!fs.statSync(target).isFile())throw Error('Invalid file');
  return target;
}
async function digest(file) {
  const hash=crypto.createHash('sha256');
  for await(const chunk of fs.createReadStream(file))hash.update(chunk);
  return hash.digest('hex');
}
module.exports={safePath,secret,sign,verify,equal,resolveFile,digest};
