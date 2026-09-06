import fs from 'fs/promises';

async function test() {
  const url = "https://play.zephyrix.org/video/7496bfb74b0737a432d357c6de4b50d0";
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": "https://watchanimeworld.one/"
    }
  });
  console.log("Zephyrix status:", res.status);
  const text = await res.text();
  await fs.writeFile("scripts/zephyrix_output.html", text);
  console.log("Saved zephyrix_output.html, length:", text.length);

  // Look for video sources, jwplayer, m3u8, eval, etc.
  const evalMatch = text.match(/eval\(function\(p,a,c,k,e,d\)[\s\S]*?\)\)/);
  if (evalMatch) {
    console.log("Packed JS found! Length:", evalMatch[0].length);
  }
  const m3u8Match = text.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/gi);
  console.log("m3u8 directly found:", m3u8Match);
}
test().catch(console.error);
