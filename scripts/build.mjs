import { execFileSync } from "node:child_process";
import { cp, mkdir, rm, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const relighting = resolve(root, "apps/relighting");
const output = resolve(root, "dist");

execFileSync(process.execPath, [resolve(relighting, "scripts/build-standalone.mjs")], {
  cwd: relighting,
  stdio: "inherit",
});

await rm(output, { recursive: true, force: true });
await cp(resolve(root, "public"), output, { recursive: true });
await mkdir(resolve(output, "relighting"), { recursive: true });
await copyFile(
  resolve(relighting, "public/AI_Relighting_Prompt_Generator.html"),
  resolve(output, "relighting/index.html"),
);

console.log(`Built tools.otato.art in ${output}`);
