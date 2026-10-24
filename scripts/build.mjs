import * as esbuild from "esbuild";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const args = new Set(process.argv.slice(2));
const watching = args.has("--watch");

// spicetify pastes index.js into a webpack module and uses the top-level `render`
// as the page. react has to be spotify's own copy, so it points at the shims.
const app = {
  absWorkingDir: root,
  entryPoints: ["src/index.tsx"],
  outfile: "dist/index.js",
  bundle: true,
  format: "iife",
  globalName: "AfterglowViz",
  footer: { js: "var render = AfterglowViz.render;" },
  target: "es2020",
  jsx: "transform",
  jsxFactory: "React.createElement",
  jsxFragment: "React.Fragment",
  loader: { ".css": "text" },
  alias: {
    react: "./src/shims/react.cjs",
    "react-dom": "./src/shims/react-dom.cjs",
  },
  sourcemap: watching ? "inline" : false,
  logLevel: "info",
};

if (watching) {
  const ctx = await esbuild.context(app);
  await ctx.watch();
} else {
  await esbuild.build(app);
}
