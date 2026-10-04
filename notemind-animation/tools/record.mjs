// Frame-accurate recorder: seeks the GSAP timeline frame by frame in headless
// Chromium and encodes the frames with ffmpeg.
//
//   node tools/record.mjs                      -> notemind-motion.mp4 (60 fps)
//   node tools/record.mjs --fps 30 --out a.mp4
//   node tools/record.mjs --stills 1,4.5,12    -> PNG stills only
//
// Needs Playwright (with Chromium) and ffmpeg on PATH.
import { chromium } from "playwright";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const fps = Number(opt("--fps", 60));
const out = resolve(opt("--out", join(root, "notemind-motion.mp4")));
const stills = opt("--stills", null);
const stillsDir = resolve(opt("--stills-dir", join(root, "stills")));

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(join(root, "index.html")).href + "?record");
await page.waitForFunction(() => window.__motionReady === true);
const duration = await page.evaluate(() => window.__motion.duration);

const shoot = async (t, path) => {
  await page.evaluate((t) => window.__motion.seek(t), t);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.screenshot({ path });
};

if (stills) {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(stillsDir, { recursive: true });
  for (const t of stills.split(",").map(Number)) {
    const p = join(stillsDir, `t${t.toFixed(2)}.png`);
    await shoot(t, p);
    console.log(p);
  }
} else {
  const dir = await mkdtemp(join(tmpdir(), "notemind-"));
  const n = Math.round(duration * fps);
  for (let i = 0; i <= n; i++) {
    await shoot(i / fps, join(dir, `f${String(i).padStart(5, "0")}.png`));
    if (i % fps === 0) process.stdout.write(`\r${(i / fps).toFixed(0)}s / ${duration.toFixed(1)}s`);
  }
  process.stdout.write("\n");
  const r = spawnSync("ffmpeg", ["-y", "-v", "error", "-framerate", String(fps), "-i", join(dir, "f%05d.png"),
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out],
    { stdio: "inherit" });
  await rm(dir, { recursive: true, force: true });
  if (r.status !== 0) process.exitCode = 1;
  else console.log(out);
}

await browser.close();
