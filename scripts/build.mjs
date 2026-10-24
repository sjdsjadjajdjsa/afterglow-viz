import * as esbuild from "esbuild";
import { fileURLToPath } from "node:url";
import { serve } from "./serve.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const args = new Set(process.argv.slice(2));
const watching = args.has("--watch") || args.has("--serve");

const shared = {
  absWorkingDir: root,
  bundle: true,
  format: "iife",
  target: "es2020",
  jsx: "transform",
  jsxFactory: "React.createElement",
  jsxFragment: "React.Fragment",
  loader: { ".css": "text" },
  sourcemap: watching ? "inline" : false,
  logLevel: "info",
};

// spicetify pastes index.js into a webpack module and uses the top-level `render`
// as the page. react has to be spotify's own copy, so it points at the shims.
const app = {
  ...shared,
  entryPoints: ["src/index.tsx"],
  outfile: "dist/index.js",
  globalName: "AfterglowViz",
  footer: { js: "var render = AfterglowViz.render;" },
  alias: {
    react: "./src/shims/react.cjs",
    "react-dom": "./src/shims/react-dom.cjs",
  },
};

const harness = {
  ...shared,
  entryPoints: ["dev/harness.tsx"],
  outfile: "dist/dev-harness.js",
  define: { "process.env.NODE_ENV": '"development"' },
};

if (watching) {
  for (const options of [app, harness]) {
    const ctx = await esbuild.context(options);
    await ctx.watch();
  }
  if (args.has("--serve")) serve(root);
} else {
  await Promise.all([esbuild.build(app), esbuild.build(harness)]);
}
