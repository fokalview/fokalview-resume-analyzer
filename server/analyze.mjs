// Compatibility entry point: the former independent API diverged from production.
// Use the same Pages Functions for every local API route.
import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const local = resolve(root, ".wrangler/local");
mkdirSync(local, { recursive: true });
// Keep Pages' temporary worker/config discovery inside the local project.
writeFileSync(resolve(local, "package.json"), JSON.stringify({ private: true, type: "module" }));
// Pages requires a standard config filename and ./functions under its cwd.
// A directory link keeps edits live without changing the deployment config.
const functions = resolve(local, "functions");
if (!existsSync(functions)) symlinkSync(resolve(root, "functions"), functions, process.platform === "win32" ? "junction" : "dir");
const config = readFileSync(resolve(root, "wrangler.local.toml"), "utf8")
  .replace('pages_build_output_dir = "dist"', `pages_build_output_dir = ${JSON.stringify(resolve(root, "dist").replaceAll("\\", "/"))}`);
writeFileSync(resolve(local, "wrangler.toml"), config);
const vars = resolve(local, ".dev.vars");
if (existsSync(resolve(root, ".dev.vars"))) copyFileSync(resolve(root, ".dev.vars"), vars);
else if (existsSync(vars)) unlinkSync(vars);
const cli = resolve(root, "node_modules/wrangler/bin/wrangler.js");
const child = spawn(process.execPath, [cli, "pages", "dev", "--port", "8788", "--persist-to", resolve(root, ".wrangler/state"), ...process.argv.slice(2)], { cwd: local, stdio: "inherit" });
child.on("error", error => { console.error(error.message); process.exitCode = 1; });
child.on("exit", code => { process.exitCode = code ?? 1; });
