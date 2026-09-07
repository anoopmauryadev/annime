import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const routeDir = new URL("../src/app/security-workflow-check/", import.meta.url);
let browser;
try {
  await mkdir(routeDir, { recursive: true });
  await writeFile(new URL("page.tsx", routeDir), `import VideoPlayer from "@/components/VideoPlayer";
export default function Check(){return <VideoPlayer servers={[]} animeId={1} episodeId={999999}/>;}`);
  browser = await chromium.launch({ headless: true, channel: "chrome" });

  const loggedOut = await browser.newPage();
  await loggedOut.route("**/api/auth/me", (route) => route.fulfill({ status: 401, json: { error: "Unauthorized" } }));
  await loggedOut.goto("http://localhost:3000/security-workflow-check");
  await loggedOut.getByText("Sign In to Stream Episode").waitFor();

  const keyless = await browser.newPage();
  await keyless.route("**/api/auth/me", (route) => route.fulfill({ json: { user: { id: 700, username: "member", email: "member@example.invalid" } } }));
  await keyless.route("**/api/keys/status", (route) => route.fulfill({ json: { active: false, is_vip: false, remaining_hours: 0 } }));
  await keyless.goto("http://localhost:3000/security-workflow-check");
  await keyless.getByText("Unlock 48 Hours of Unlimited Anime").waitFor();

  const credentials = Object.fromEntries((await readFile(new URL("../data/admin-bootstrap.txt", import.meta.url), "utf8"))
    .split("\n").filter((line) => line.includes("=")).map((line) => line.split("=", 2)));
  const adminPage = await browser.newPage();
  const login = await adminPage.request.post("http://localhost:3000/api/admin/login", { data: { username: credentials.username, password: credentials.password } });
  assert.equal(login.status(), 200, "rotated admin login works");
  const adminCookie = (await adminPage.context().cookies()).find((item) => item.name === "admin_token");
  assert.equal(adminCookie?.httpOnly, true, "admin token stays inaccessible to scripts");
  assert.equal((await adminPage.request.get("http://localhost:3000/api/admin/session")).status(), 200);
  assert.equal((await adminPage.request.get("http://localhost:3000/api/admin/episodes?anime_id=1")).status(), 200);
  await adminPage.request.delete("http://localhost:3000/api/admin/session");

  console.log("PASS: login gate, key gate, rotated HttpOnly admin login, admin API workflow.");
} finally {
  await browser?.close();
  await rm(routeDir, { recursive: true, force: true });
}
