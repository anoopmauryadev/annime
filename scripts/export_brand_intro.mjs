// Export the website ident as a 4K MP4. Run while `npm run dev` is available.
import { mkdir, rename } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
await mkdir("public/brand", { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
let ffmpeg;
try {
  // Render the desktop composition at 4× pixel density, so CSS sizes stay
  // proportional while SVG paths and text are rasterized at native 4K.
  const context = await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 4, reducedMotion: "no-preference" });
  const source = await context.newPage();
  await source.goto("http://localhost:3000/brand-preview");
  await source.locator(".az-intro").waitFor();
  await source.waitForFunction(() => getComputedStyle(document.querySelector(".az-intro")).display === "flex");
  // Use the actual component markup and loaded styles in a script-free page.
  // Next.js navigation/error overlays must never become part of the clip.
  const snapshot = await source.evaluate(() => ({
    styles: [...document.styleSheets].map(sheet => [...sheet.cssRules].map(rule => rule.cssText).join("\n")
      .replace(/url\((['"]?)(.*?)\1\)/g, (_, quote, url) => `url("${new URL(url, sheet.href || location.href).href}")`)).join("\n"),
    htmlClass: document.documentElement.className,
    bodyClass: document.body.className,
    font: getComputedStyle(document.querySelector(".az-name")).font,
    markup: document.querySelector(".az-intro").outerHTML,
  }));
  const page = await context.newPage();
  await page.route("http://localhost:3000/__brand-export", route => route.fulfill({
    contentType: "text/html",
    body: `<html class="${snapshot.htmlClass}"><head><base href="http://localhost:3000/"><style>${snapshot.styles}</style></head><body class="${snapshot.bodyClass}">${snapshot.markup}</body></html>`,
  }));
  await page.goto("http://localhost:3000/__brand-export");
  await page.evaluate(font => document.fonts.load(font), snapshot.font);
  await source.close();
  await page.evaluate(async () => {
    await document.fonts.ready;
    const intro = document.querySelector(".az-intro").cloneNode(true);
    Object.assign(intro.style, { position: "fixed", inset: "0", width: "960px", height: "540px", zIndex: "99999" });
    intro.querySelector(".az-intro-play")?.remove();
    intro.className = "az-intro az-intro-playing";
    intro.querySelector(".az-intro-caption").textContent = "HINDI ANIME ZONE PRESENTS";
    document.body.replaceChildren(intro);
    document.body.style.background = "#000";
    document.body.style.overflow = "hidden";
    // Hold every animation, including delayed text reveals, at the same
    // deterministic timestamp. Screenshot/encoding speed must not affect it.
    window.introAnimations = intro.getAnimations({ subtree: true });
    if (window.introAnimations.length < 8) throw new Error("Website animation styles did not load");
    window.introAnimations.forEach(animation => animation.pause());
    await Promise.all(window.introAnimations.map(animation => animation.ready));
    window.introAnimations.forEach(animation => { animation.currentTime = 0; });
  });
  const capture = await page.context().newCDPSession(page);
  ffmpeg = spawn("ffmpeg", ["-y", "-v", "error", "-f", "image2pipe", "-framerate", "30", "-i", "pipe:0", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-t", "2.8", "-movflags", "+faststart", "public/brand/anime-zone-intro-4k.partial.mp4"], { stdio: ["pipe", "inherit", "inherit"] });
  const done = once(ffmpeg, "close");
  for (let frame = 0; frame < 84; frame++) {
    await page.evaluate((time) => window.introAnimations.forEach((animation) => { animation.currentTime = time; }), frame * 1000 / 30);
    const { data } = await capture.send("Page.captureScreenshot", {
      format: "png", captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: 960, height: 540, scale: 4 },
    });
    const png = Buffer.from(data, "base64");
    if (png.readUInt32BE(16) !== 3840 || png.readUInt32BE(20) !== 2160) {
      throw new Error("Browser did not render the requested native 4K frame");
    }
    if (!ffmpeg.stdin.write(png)) await once(ffmpeg.stdin, "drain");
    if (frame % 30 === 0) console.log(`Rendered ${frame + 1}/84 frames`);
  }
  ffmpeg.stdin.end();
  const [code] = await done;
  if (code !== 0) throw new Error(`FFmpeg exited with ${code}`);
  await rename("public/brand/anime-zone-intro-4k.partial.mp4", "public/brand/anime-zone-intro-4k.mp4");
  console.log("Created public/brand/anime-zone-intro-4k.mp4 (3840x2160, 2.8 seconds)");
} finally {
  if (ffmpeg && ffmpeg.exitCode === null) ffmpeg.kill();
  await browser.close();
}
