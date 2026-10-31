// with npm run dev running: NODE_PATH=$(npm root -g) node dev/checks/memory.cjs [url]
// CHROME=/usr/bin/chromium to use a system browser. prints one json line per run
const { execFileSync } = require("child_process");
const { chromium } = require("playwright-core");

const url = process.argv[2] || "http://127.0.0.1:5173/dev.html";
const SAMPLE_MS = Number(process.env.SAMPLE_MS) || 8000;

function treeRss(root) {
  const rows = execFileSync("ps", ["-eo", "pid=,ppid=,rss="]).toString().trim().split("\n");
  const kids = new Map();
  const rss = new Map();
  for (const row of rows) {
    const [pid, ppid, kb] = row.trim().split(/\s+/).map(Number);
    rss.set(pid, kb);
    if (!kids.has(ppid)) kids.set(ppid, []);
    kids.get(ppid).push(pid);
  }
  let total = 0;
  const walk = (pid) => {
    total += rss.get(pid) || 0;
    for (const k of kids.get(pid) || []) walk(k);
  };
  walk(root);
  return total * 1024;
}

// every canvas the page makes, in the dom or not, so offscreen buffers count too
function trackCanvases() {
  const made = [];
  const create = Document.prototype.createElement;
  Document.prototype.createElement = function (tag, opts) {
    const el = create.call(this, tag, opts);
    if (String(tag).toLowerCase() === "canvas") made.push(new WeakRef(el));
    return el;
  };
  window.__agvCanvasBytes = () => {
    let bytes = 0;
    let alive = 0;
    for (const ref of made) {
      const c = ref.deref();
      if (!c) continue;
      alive++;
      bytes += c.width * c.height * 4;
    }
    return { bytes, alive };
  };
}

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || undefined,
    args: ["--agv-memory-probe"],
  });
  const pid = Number(execFileSync("pgrep", ["-of", "agv-memory-probe"]).toString().trim());
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 2,
  });
  await context.addInitScript(trackCanvases);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  await cdp.send("HeapProfiler.enable");
  await page.goto(url);
  await page.locator(".harness-play").click();
  await page.waitForTimeout(3000);

  const heap = async () => {
    await cdp.send("HeapProfiler.collectGarbage");
    const { metrics } = await cdp.send("Performance.getMetrics");
    return metrics.find((m) => m.name === "JSHeapUsedSize").value;
  };

  await cdp.send("HeapProfiler.startSampling", {
    samplingInterval: 1024,
    includeObjectsCollectedByMajorGC: true,
    includeObjectsCollectedByMinorGC: true,
  });
  await page.waitForTimeout(SAMPLE_MS);
  const { profile } = await cdp.send("HeapProfiler.stopSampling");
  const byFn = new Map();
  let allocated = 0;
  const walk = (n, file) => {
    const f = n.callFrame;
    const here = f.url ? `${f.functionName || "(anon)"} ${f.url.split("/").pop()}:${f.lineNumber + 1}` : file;
    allocated += n.selfSize;
    if (n.selfSize) byFn.set(here || f.functionName, (byFn.get(here || f.functionName) || 0) + n.selfSize);
    for (const c of n.children) walk(c, here);
  };
  walk(profile.head, "");
  const top = [...byFn]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([k, v]) => [k, +(v / 1024 / (SAMPLE_MS / 1000)).toFixed(1)]);

  const heapStart = await heap();
  const canvases = await page.evaluate(() => window.__agvCanvasBytes());
  const rssStart = treeRss(pid);
  // a few track changes and a minute of play, to see what stays behind
  for (let n = 0; n < 8; n++) {
    await page.locator(".harness button", { hasText: /^Next$/ }).click();
    await page.waitForTimeout(1500);
  }
  const heapAfter = await heap();
  const canvasesAfter = await page.evaluate(() => window.__agvCanvasBytes());
  const rssAfter = treeRss(pid);
  await browser.close();

  const mb = (b) => +(b / 1048576).toFixed(2);
  console.log(
    JSON.stringify({
      heapMb: mb(heapStart),
      heapAfterTracksMb: mb(heapAfter),
      allocKbPerS: +(allocated / 1024 / (SAMPLE_MS / 1000)).toFixed(1),
      canvasMb: mb(canvases.bytes),
      canvases: canvases.alive,
      canvasAfterTracksMb: mb(canvasesAfter.bytes),
      canvasesAfterTracks: canvasesAfter.alive,
      rssMb: mb(rssStart),
      rssAfterTracksMb: mb(rssAfter),
      topAllocKbPerS: top,
      errors,
    }),
  );
  process.exit(errors.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
