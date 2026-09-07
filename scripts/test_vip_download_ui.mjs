// Run against `npm run dev`. Browser-only fixtures; no production account/settings changes.
import { mkdir, writeFile, rm } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const routeDir = new URL('../src/app/vip-download-check/', import.meta.url);
await mkdir(routeDir);
let browser;
try {
  await writeFile(new URL('page.tsx',routeDir), `import EpisodeDownloads from "@/components/EpisodeDownloads";
export default function Check(){return <EpisodeDownloads downloads={[{id:1,quality:"Test download",download_url:"/uploads/videos/fixture.webm"}]} />;}`);
  await mkdir(new URL('file/',routeDir));
  await writeFile(new URL('file/route.ts',routeDir), `import { readFile } from "fs/promises";
export async function GET(){return new Response(await readFile("public/brand/anime-zone-intro-4k.mp4"),{headers:{"Content-Type":"video/mp4","Content-Disposition":"attachment; filename=verified-intro.mp4"}});}`);
  browser = await chromium.launch({headless:true,channel:'chrome'});
  const page = await browser.newPage({acceptDownloads:true});
  page.on('requestfailed',request=>console.log('Request failure:',request.url(),request.failure()));
  page.on('response',response=>{if(response.url().includes('with-intro')||response.url().endsWith('/file')) console.log('Download response:',response.status(),response.headers()['content-type']);});
  await page.addInitScript(()=>{
    localStorage.setItem('user_token','old-non-vip-token');
    localStorage.setItem('user_data',JSON.stringify({id:999,username:'Test',is_vip:0}));
    // Chrome's native attachment request bypasses route mocks. Use a real HTTP
    // fixture for that transport; signed-token/API behavior is tested separately.
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function() {
      if (this.href.includes('/api/downloads/with-intro')) this.href='/vip-download-check/file';
      originalClick.call(this);
    };
  });
  await page.route('**/api/auth/me',r=>r.fulfill({json:{user:{id:999,username:'Test',is_vip:0}}}));
  await page.route('**/api/keys/status',r=>r.fulfill({json:{is_vip:true}}));
  let prepared = false, error = false;
  await page.context().route('**/api/downloads/with-intro?**', r=>{
    if(error) return r.fulfill({status:404,json:{error:'The video file is missing.'}});
    if(r.request().method()==='POST') return r.fulfill({status:202,json:{status:'processing'}});
    if(r.request().url().includes('status=1')) {prepared=true;return r.fulfill({json:{status:'ready'}});}
    assert.ok(prepared,'Browser only downloads after preparation');
    assert.equal(r.request().headers().authorization, 'Bearer cookie-session');
    return r.continue({url:'http://localhost:3000/vip-download-check/file'});
  });
  await page.goto('http://localhost:3000/vip-download-check');
  await page.waitForFunction(() => localStorage.getItem('user_token') === null);
  assert.equal(await page.evaluate(() => localStorage.getItem('user_token')), null, 'Legacy readable token is removed');
  const link=page.getByRole('link',{name:'Test download'});
  await link.waitFor();
  const saved=page.waitForEvent('download');
  await link.click();
  await page.getByRole('status').filter({hasText:'Adding the intro'}).waitFor();
  const download = await saved;
  assert.equal(await download.failure(),null);
  assert.equal(download.suggestedFilename(),'verified-intro.mp4');
  await page.getByRole('link',{name:'Download ready file'}).waitFor();
  error = true;
  await link.click();
  await page.getByRole('alert').filter({hasText:'The video file is missing.'}).waitFor();
  assert.equal(await page.locator('.animate-spin').count(),0);
  console.log('PASS: fresh VIP status, preparing indicator, native file download succeeds, retry link, missing-file error displayed without fake success.');
} finally {
  await browser?.close();
  await rm(routeDir,{recursive:true,force:true});
}
