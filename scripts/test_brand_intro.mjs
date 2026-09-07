// Run against `npm run dev`. Set PLAYWRIGHT_MODULE if Playwright is installed elsewhere.
// The temporary route exercises the real player; media and auth are browser-only mocks.
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const routeDir = new URL('../src/app/brand-intro-check/', import.meta.url);
await mkdir(routeDir); // Refuse to overwrite an existing route.
let browser;
try {
  await writeFile(new URL('page.tsx', routeDir), `"use client";
import { useState } from "react";
import VideoPlayer from "@/components/VideoPlayer";
export default function Check() {
 const [episode, setEpisode] = useState(901);
 const [embed, setEmbed] = useState(false);
 return <main style={{width:"100%",maxWidth:960,margin:"40px auto"}}>
 <button onClick={()=>setEpisode(x=>x+1)}>Next test episode</button>
 <button onClick={()=>{setEmbed(true);setEpisode(x=>x+1)}}>Test embed</button>
 <VideoPlayer episodeId={episode} servers={[{id:1,server_name:"Test",server_type:embed?"embed":"direct",stream_url:embed?"https://embed.test/player":"/uploads/videos/intro-test.mp4"}]} />
 </main>;
}`);
  browser = await chromium.launch({headless:true, channel:"chrome"});
  const page = await browser.newPage({viewport:{width:1200,height:820}});
  await page.addInitScript(() => {
    localStorage.setItem('user_token','intro-test');
    localStorage.setItem('user_data',JSON.stringify({id:999,username:'Test'}));
    window.testPlayCalls = 0;
    HTMLMediaElement.prototype.play = function() {
      window.testPlayCalls++;
      if (window.rejectTestPlay) return Promise.reject(new DOMException('Gesture required','NotAllowedError'));
      this.dispatchEvent(new Event('play'));
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function() {};
  });
  await page.route('**/api/auth/me', r=>r.fulfill({json:{user:{id:999,username:'Test'}}}));
  await page.route('**/api/keys/status', r=>r.fulfill({json:{active:true,is_vip:true}}));
  await page.route('**/api/history**', r=>r.fulfill({json:{}}));
  await page.route('**/api/admin/brand-intro', r=>r.fulfill({json:{enabled:true,url:'/brand/anime-zone-intro-4k.mp4'}}));
  await page.route('**/uploads/videos/intro-test.mp4', r=>r.fulfill({status:204}));
  let embedRequests = 0;
  await page.route('https://embed.test/**', r=>{embedRequests++; return r.fulfill({body:'<h1>Embed player</h1>',contentType:'text/html'});});
  await page.goto('http://localhost:3000/brand-intro-check');
  const play = page.getByRole('button',{name:'Play episode',exact:true});
  await play.waitFor();
  assert.equal(await page.evaluate(()=>window.testPlayCalls),0);
  await play.click();
  await page.locator('.az-intro-playing').waitFor();
  await page.waitForTimeout(1200);
  assert.equal(await page.evaluate(()=>window.testPlayCalls),0,'No playback during intro');
  await page.screenshot({path:'/private/tmp/anime-zone-intro-desktop.png'});
  await page.locator('.az-intro').waitFor({state:'detached'});
  assert.equal(await page.evaluate(()=>window.testPlayCalls),1,'Playback starts after intro');
  await page.locator('video').evaluate(v=>v.play());
  assert.equal(await page.locator('.az-intro').count(),0,'Pause/resume does not repeat intro');
  await page.getByText('Next test episode',{exact:true}).click();
  await play.waitFor();
  await page.evaluate(()=>window.rejectTestPlay=true);
  await play.click();
  await page.getByRole('button',{name:'Tap to play video'}).waitFor();
  await page.evaluate(()=>window.rejectTestPlay=false);
  await page.getByRole('button',{name:'Tap to play video'}).click();
  await page.getByRole('button',{name:'Tap to play video'}).waitFor({state:'detached'});
  await page.getByText('Test embed',{exact:true}).click();
  await play.waitFor();
  assert.equal(embedRequests,0,'Embed not loaded before intro');
  await play.click();
  await page.waitForTimeout(1000);
  assert.equal(embedRequests,0,'Embed not loaded during intro');
  await page.locator('iframe[src="https://embed.test/player"]').waitFor();
  await page.waitForFunction(()=>!!document.querySelector('iframe')?.contentWindow);
  assert.equal(embedRequests,1);
  await page.getByText('Next test episode',{exact:true}).click();
  await page.setViewportSize({width:375,height:740});
  await play.waitFor();
  await page.screenshot({path:'/private/tmp/anime-zone-intro-mobile.png'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),true,'Mobile fits viewport');
  await page.emulateMedia({reducedMotion:'reduce'});
  await play.click();
  assert.equal(await page.locator('.az-intro').evaluate(el=>getComputedStyle(el).animationName),'none');
  await page.locator('.az-intro').waitFor({state:'detached'});
  console.log('PASS: intro timing, playback handoff, resume, episode reset, autoplay fallback, embed gating, mobile layout, reduced motion.');

  // Decode real MP4 media: custom intros longer than the 2.8s CSS ident
  // must stay visible, with no second logo, until their own ended event.
  const real = await browser.newPage();
  await real.addInitScript(() => {
    localStorage.setItem('user_token','intro-test');
    localStorage.setItem('user_data',JSON.stringify({id:999,username:'Test'}));
  });
  let access = {active:true,is_vip:false};
  let config = {enabled:true,url:'/brand/anime-zone-intro-4k.mp4'};
  let customRequests = 0;
  const clip = await readFile(process.env.INTRO_TEST_CLIP || '/private/tmp/anime-zone-custom-test.mp4');
  await real.route('**/api/auth/me', r=>r.fulfill({json:{user:{id:999,username:'Test'}}}));
  await real.route('**/api/keys/status', r=>r.fulfill({json:access}));
  await real.route('**/api/history**', r=>r.fulfill({json:{}}));
  await real.route('**/api/admin/brand-intro', r=>r.fulfill({json:config}));
  await real.route('**/uploads/videos/intro-test.mp4', r=>r.fulfill({body:clip,contentType:'video/mp4'}));
  await real.route('**/uploads/brand/custom.mp4', r=>{customRequests++;return r.fulfill({body:clip,contentType:'video/mp4'});});
  await real.goto('http://localhost:3000/brand-intro-check');
  await real.getByRole('button',{name:'Play episode',exact:true}).waitFor();
  config = {enabled:true,url:'/uploads/brand/custom.mp4'}; // Admin uploads after watch page was opened.
  assert.equal(customRequests,0);
  await real.getByRole('button',{name:'Play episode',exact:true}).click();
  await real.locator('[data-custom-intro]').waitFor();
  const tap = real.getByRole('button',{name:'Tap to play intro'});
  if (await tap.isVisible()) await tap.click();
  await real.waitForFunction(()=>document.querySelector('[data-custom-intro] video')?.currentTime > 3.1);
  assert.equal(await real.locator('[data-custom-intro]').evaluate(el=>getComputedStyle(el).opacity),'1');
  assert.equal(await real.locator('[data-custom-intro] .az-brand').count(),0);
  assert.equal(await real.locator('video[controlslist]').evaluate(v=>v.paused && v.currentTime === 0),true);
  await real.locator('[data-custom-intro]').waitFor({state:'detached'});
  await real.waitForFunction(()=>document.querySelector('video[controlslist]')?.currentTime > 0);
  await real.locator('video[controlslist]').evaluate(async v=>{v.pause();await v.play();});
  assert.equal(await real.locator('[data-custom-intro]').count(),0);

  config.enabled = false;
  await real.getByText('Next test episode',{exact:true}).click();
  await real.getByRole('button',{name:'Play episode',exact:true}).click();
  await real.waitForFunction(()=>document.querySelector('video[controlslist]')?.currentTime > 0);
  assert.equal(await real.locator('[data-custom-intro],.az-intro-playing').count(),0);

  access = {active:false,is_vip:false};
  await real.reload();
  await real.getByRole('button',{name:'Get 48-Hour Key',exact:false}).waitFor();
  assert.equal(await real.locator('video,.az-intro').count(),0,'Key gate comes before media');
  await real.route('**/api/auth/me', r=>r.fulfill({status:401,json:{}}));
  await real.reload();
  await real.getByRole('link',{name:'Sign In to Watch'}).waitFor();
  assert.equal(await real.locator('video,.az-intro').count(),0,'Login gate comes before media');
  console.log('PASS: real custom MP4 playback past 2.8s, fresh uploaded selection, no logo overlap, full duration handoff, OFF toggle, login/key gates.');
} finally {
  await browser?.close();
  await rm(routeDir,{recursive:true,force:true});
}
