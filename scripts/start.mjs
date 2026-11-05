import { spawn, spawnSync } from "node:child_process";
const initialized = spawnSync(
  process.execPath,
  ["--import", "tsx", "scripts/init.ts"],
  { stdio: "inherit" },
);
if (initialized.status !== 0) process.exit(initialized.status || 1);
const children = [
  spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0"],
    { stdio: "inherit" },
  ),
  spawn(process.execPath, ["--import", "tsx", "scripts/worker.ts"], {
    stdio: "inherit",
  }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 1000).unref();
}
for (const child of children) {
  child.on("error", () => stop(1));
  child.on("exit", (code) => stop(code || 0));
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
