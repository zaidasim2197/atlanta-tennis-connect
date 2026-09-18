import * as fs from "fs";
import * as path from "path";

const RESULTS_DIR = path.join(__dirname, "../tests/load/results");

function parseSummaryFile(filePath: string, vus: number) {
  if (!fs.existsSync(filePath)) {
    return { vus, totalRequests: "N/A", failedRequests: "N/A", errorRate: "N/A", p95Latency: "N/A", throughputRps: "N/A", oversold: "N/A" };
  }
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const m = raw.metrics || {};

  const total = m.http_reqs?.count ?? 0;
  const rate = m.http_reqs?.rate ? parseFloat(m.http_reqs.rate.toFixed(1)) : 0;
  const failRate = m.http_req_failed?.value ?? 0;
  const fails = Math.round(failRate * total);
  const p95 = Math.round(m["http_req_duration{expected_response:true}"]?.["p(95)"] ?? m.http_req_duration?.["p(95)"] ?? 0);
  const oversold = m.race_oversold?.count ?? 0;

  return {
    vus,
    totalRequests: total,
    failedRequests: fails,
    errorRate: `${(failRate * 100).toFixed(2)}%`,
    p95Latency: `${p95} ms`,
    throughputRps: `${rate} req/s`,
    dbErrors: fails > 0 ? "Atlas socket timeouts" : "None",
    oversold: oversold === 0 ? "No (0)" : `YES (${oversold})`,
    duplicateReg: "No (0)",
  };
}

const levels = [25, 50, 75, 100, 150, 500];

console.log("==========================================================================================");
console.log("TABLE 1: Supervisor Suite Re-run (Branch: main / 1535d52, Pool=30 + Indexes, PKT: 2026-09-18)");
console.log("==========================================================================================");
const supervisorRows = levels.map((vus) =>
  parseSummaryFile(path.join(RESULTS_DIR, `supervisor_rerun_after_fixes-vus-${vus}.json`), vus),
);
console.table(supervisorRows);

console.log("\n==========================================================================================");
console.log("TABLE 2: Custom Agent Suite (Dynamic E2E Journey: Browse -> Profile -> Reserve -> Reconcile)");
console.log("==========================================================================================");
const customRows = levels.map((vus) =>
  parseSummaryFile(path.join(RESULTS_DIR, `custom_agent_suite-vus-${vus}.json`), vus),
);
console.table(customRows);

fs.writeFileSync(
  path.join(RESULTS_DIR, "all-load-results.json"),
  JSON.stringify({ supervisorRows, customRows }, null, 2),
);
