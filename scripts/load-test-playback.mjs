// Run from a separate machine. Credentials stay in environment variables.
import { performance } from 'node:perf_hooks';

const target = process.env.LOAD_TEST_PLAYLIST;
const cookie = process.env.LOAD_TEST_COOKIE;
if (!target) throw new Error('Set LOAD_TEST_PLAYLIST to a media/quality .m3u8 URL.');
const origin = new URL(target).origin;
const levels = (process.env.LOAD_TEST_LEVELS || '25,50,100').split(',').map(Number)
  .filter((value) => Number.isInteger(value) && value > 0 && value <= 1000);
const controller = new AbortController();
process.on('SIGINT', () => controller.abort());
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
let bytes = 0;
const byteLimit = 2 * 1024 ** 3;

async function request(url) {
  if (new URL(url).origin !== origin) throw new Error('Cross-origin media is not supported; credentials were not sent.');
  const response = await fetch(url, {
    ...(cookie ? { headers: { Cookie: cookie } } : {}), redirect: 'error',
    signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
  });
  if (!response.ok) { await response.body?.cancel(); throw new Error(`HTTP ${response.status}`); }
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    size += chunk.length;
    if (bytes > byteLimit || size > 32 * 1024 ** 2) {
      controller.abort();
      throw new Error('Transfer limit reached');
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function main() {
  const playlist = (await request(target)).toString('utf8');
  if (!playlist.startsWith('#EXTM3U') || playlist.includes('#EXT-X-STREAM-INF')) {
    throw new Error('Use a quality playlist such as 720p.m3u8, not the master playlist.');
  }
  if (/#EXT-X-(KEY|MAP|BYTERANGE)/.test(playlist)) throw new Error('This test supports plain MPEG-TS HLS only.');
  const segments = [];
  let duration = 0;
  for (const line of playlist.split(/\r?\n/).map(line => line.trim())) {
    if (line.startsWith('#EXTINF:')) duration = Number(line.slice(8).split(',')[0]);
    else if (line && !line.startsWith('#')) {
      if (!(duration > 0)) throw new Error('Invalid segment duration');
      segments.push({ url: new URL(line, target).href, duration });
      duration = 0;
    }
  }
  if (!segments.length) throw new Error('No segments in playlist');
  // Validate access and media before starting concurrent traffic.
  await request(segments[0].url);
  for (const viewers of levels) {
    const samples = [];
    let failures = 0, late = 0;
    const failureReasons = {};
    const before = bytes;
    const start = performance.now();
    const deadline = start + 60000;
    await Promise.all(Array.from({ length: viewers }, async (_, viewer) => {
      await sleep((viewer / viewers) * 2000);
      let index = Math.floor(viewer * segments.length / viewers);
      while (!controller.signal.aborted && performance.now() < deadline) {
        const segment = segments[index++ % segments.length];
        const began = performance.now();
        try {
          await request(segment.url);
          const elapsed = performance.now() - began;
          samples.push(elapsed);
          if (elapsed > segment.duration * 1000) late++;
        } catch (error) {
          failures++;
          const reason = error instanceof Error ? error.message : String(error);
          failureReasons[reason] = (failureReasons[reason] || 0) + 1;
          if (failures >= 5) controller.abort();
        }
        const wait = Math.min(segment.duration * 1000 - (performance.now() - began), deadline - performance.now());
        if (wait > 0 && !controller.signal.aborted) await sleep(wait);
      }
    }));
    samples.sort((a, b) => a - b);
    const elapsed = (performance.now() - start) / 1000;
    const result = { viewers, seconds: Math.round(elapsed), successfulSegments: samples.length, failures,
      lateSegments: late, p95SegmentDownloadMs: Math.round(samples[Math.max(0, Math.ceil(samples.length * .95) - 1)] || 0),
      averageMbps: Number(((bytes - before) * 8 / elapsed / 1e6).toFixed(2)), failureReasons };
    console.log(JSON.stringify(result));
    if (controller.signal.aborted || failures || late / Math.max(1, samples.length) > .05) {
      console.log('Stopped before increasing load: errors, slow segments, or transfer limit.');
      process.exitCode = 1;
      return;
    }
    if (viewers !== levels.at(-1)) await sleep(10000);
  }
}
main().catch(() => {
  console.error('Test could not complete. Check the playlist, active login/access, and network. Credentials are not logged.');
  process.exitCode = 1;
});
