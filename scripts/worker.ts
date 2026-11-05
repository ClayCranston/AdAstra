import { runScheduled } from "../src/lib/service";
function tick() {
  try {
    runScheduled();
  } catch (error) {
    console.error("Local scheduler failed:", error);
  }
}
tick();
const timer = setInterval(tick, 60_000);
console.log("Local accountability scheduler is running (60-second interval).");
process.on("SIGTERM", () => {
  clearInterval(timer);
  process.exit(0);
});
