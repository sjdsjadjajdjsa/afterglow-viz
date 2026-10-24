// set SPICETIFY_CUSTOM_APPS to use a different CustomApps folder
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const APP = "afterglow-viz";
const root = fileURLToPath(new URL("..", import.meta.url));
const onWindows = process.platform === "win32";

function fail(message) {
  console.error(`install-local: ${message}`);
  process.exit(1);
}

function spicetify(args, capture = false) {
  const result = spawnSync("spicetify", args, {
    encoding: "utf8",
    shell: onWindows,
    stdio: capture ? "pipe" : "inherit",
  });
  if (result.error) {
    fail(`could not run spicetify (${result.error.message}). Install it from https://spicetify.app and make sure it's on your PATH.`);
  }
  return result;
}

function lastLine(text) {
  const lines = (text ?? "").replace(/\x1b\[[0-9;]*m/g, "").split(/\r?\n/).map((l) => l.trim());
  return lines.filter(Boolean).pop() ?? "";
}

function findCustomAppsDir() {
  if (process.env.SPICETIFY_CUSTOM_APPS) return process.env.SPICETIFY_CUSTOM_APPS;

  const userData = lastLine(spicetify(["path", "userdata"], true).stdout);
  if (userData && existsSync(userData)) return join(userData, "CustomApps");

  const configFile = lastLine(spicetify(["-c"], true).stdout);
  if (configFile && existsSync(configFile)) return join(dirname(configFile), "CustomApps");

  const guesses = onWindows
    ? [join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "spicetify")]
    : [join(homedir(), ".config", "spicetify"), join(homedir(), "spicetify_data")];
  const found = guesses.find((dir) => existsSync(dir));
  if (found) return join(found, "CustomApps");

  fail("could not find the Spicetify folder. Set SPICETIFY_CUSTOM_APPS to your CustomApps folder and try again.");
}

const build = spawnSync(process.execPath, [join(root, "scripts", "build.mjs")], { stdio: "inherit" });
if (build.status !== 0) fail("build failed");

const target = join(findCustomAppsDir(), APP);
mkdirSync(target, { recursive: true });
copyFileSync(join(root, "manifest.json"), join(target, "manifest.json"));
copyFileSync(join(root, "dist", "index.js"), join(target, "index.js"));
console.log(`Copied ${APP} to ${target}`);

const current = spicetify(["config", "custom_apps"], true).stdout ?? "";
if (!current.split(/[\s|]+/).includes(APP)) {
  spicetify(["config", "custom_apps", APP]);
}

process.exit(spicetify(["apply"]).status ?? 1);
