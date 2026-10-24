// with npm run dev running: NODE_PATH=$(npm root -g) node dev/checks/color-modes.cjs [url]
const path = require("path");
const esbuild = require("esbuild");
const { chromium } = require("playwright");

const url = process.argv[2] || "http://127.0.0.1:5173/dev.html";
const root = path.join(__dirname, "../..");
const shots = process.env.SHOTS || "";

async function main() {
  // the app bundle keeps its modules private, so bundle the color code on its own and add it to the page
  const bundle = await esbuild.build({
    stdin: {
      contents: `export * from "./src/color/getColor"; export * from "./src/color/palette"; export { DEFAULT_SETTINGS, COLOR_MODES } from "./src/settings";`,
      resolveDir: root,
      loader: "ts",
    },
    bundle: true,
    format: "iife",
    globalName: "AGVColor",
    write: false,
  });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.locator(".harness-play").click();

  let failed = 0;
  const seen = [];
  for (let n = 0; n < 4; n++) {
    await page.waitForTimeout(600);
    const result = await page.evaluate(checkTrack);
    if (shots) await page.screenshot({ path: path.join(shots, `track-${n}.png`) });
    console.log(`${result.title}: ${result.palette.map((c) => `rgb(${c})`).join(" ")}`);
    for (const p of result.problems) console.log(`  FAIL ${p}`);
    for (const w of result.warnings) console.log(`  note ${w}`);
    failed += result.problems.length;
    seen.push(result.palette.join("|"));
    await page.locator(".harness button", { hasText: /^Next$/ }).click();
  }
  if (new Set(seen).size !== seen.length) {
    console.log("FAIL two tracks gave the same palette");
    failed++;
  }
  for (const e of errors) console.log(`FAIL page error: ${e}`);
  failed += errors.length;
  await browser.close();
  console.log(failed ? `${failed} problem(s)` : "ok");
  process.exit(failed ? 1 : 0);
}

// runs in the page, against the real art the mock player is showing
async function checkTrack() {
  const C = window.AGVColor;
  const item = window.Spicetify.Player.data.item;
  const src = item.metadata.image_url;
  const img = new Image();
  img.src = src;
  await img.decode();
  const problems = [];
  const warnings = [];
  const palette = C.extractPalette(img);
  if (!palette || palette.length < 2) return { title: item.metadata.title, palette: palette || [], problems: ["no usable palette"], warnings };

  // a second palette for the centerpiece image, made from the art turned upside down in hue
  const center = palette.map(([r, g, b]) => [255 - r, 255 - g, 255 - b]);
  const track = { artPalette: palette, centerPalette: center };
  const ts = Array.from({ length: 12 }, (_, i) => i / 12 + 0.01);
  const settings = (mode) => ({ ...C.DEFAULT_SETTINGS, color: { ...C.DEFAULT_SETTINGS.color, mode } });
  const strip = (mode, tr = track) => ts.map((t) => C.getColor(settings(mode), tr, t).map((v) => v.toFixed(3)).join(",")).join(" ");

  const order = ["album", "single", "rainbow", "centerpiece", "album", "centerpiece", "rainbow", "single", "album"];
  const first = {};
  let prev = null;
  for (const mode of order) {
    const s = strip(mode);
    if (prev !== null && s === prev) problems.push(`colors did not change switching to ${mode}`);
    if (first[mode] === undefined) first[mode] = s;
    else if (first[mode] !== s) problems.push(`${mode} differs from its first run`);
    prev = s;
  }
  if (strip("centerpiece", { artPalette: palette, centerPalette: null }) !== first.album) problems.push("centerpiece without image did not fall back to album");
  if (strip("centerpiece", { artPalette: null, centerPalette: null }) !== first.rainbow) problems.push("centerpiece without palettes did not fall back to rainbow");

  // the live canvas should be drawing in album colors (default mode)
  const canvas = document.querySelector("canvas.agv-canvas");
  const ctx = canvas && canvas.getContext("2d");
  if (ctx) {
    const { width, height } = canvas;
    const data = ctx.getImageData(0, 0, width, height).data;
    const size = Math.min(width, height);
    const ref = Array.from({ length: 400 }, (_, i) => C.getColor(settings("album"), track, i / 400));
    let colorful = 0;
    let matched = 0;
    for (let y = 0; y < height; y += 2)
      for (let x = 0; x < width; x += 2) {
        if (Math.hypot(x - width / 2, y - height / 2) < size * 0.17) continue;
        const o = (y * width + x) * 4;
        const r = data[o], g = data[o + 1], b = data[o + 2];
        if (Math.max(r, g, b) - Math.min(r, g, b) < 60) continue;
        colorful++;
        if (ref.some((c) => Math.abs(c[0] - r) + Math.abs(c[1] - g) + Math.abs(c[2] - b) < 40)) matched++;
      }
    if (!colorful) warnings.push("no colored pixels on the canvas outside the centerpiece");
    else if (matched / colorful < 0.5) warnings.push(`only ${Math.round((100 * matched) / colorful)}% of canvas colors are from the album palette`);
    else warnings.push(`${Math.round((100 * matched) / colorful)}% of canvas colors are from the album palette`);
  }
  return { title: item.metadata.title, palette, problems, warnings };
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
