import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { transformSync } from "esbuild";

// Minifies snippet/p.js into public/p.js. The snippet runs on other people's pages, so it must stay
// under 1 KB; this stops the build if it grows past that.
const LIMIT = 1024;
const source = readFileSync(new URL("../snippet/p.js", import.meta.url), "utf8");
const { code } = transformSync(source, { minify: true, target: "es2020", legalComments: "none" });
mkdirSync(new URL("../public/", import.meta.url), { recursive: true });
writeFileSync(new URL("../public/p.js", import.meta.url), code);

const size = statSync(new URL("../public/p.js", import.meta.url)).size;
console.log(`snippet: public/p.js is ${size} bytes (limit ${LIMIT})`);
if (size >= LIMIT) {
  console.error("The snippet is too big. Keep it under 1 KB.");
  process.exit(1);
}
