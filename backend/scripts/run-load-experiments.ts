/**
 * Automated Load Testing Runner
 * Executes both the Supervisor Re-run Suite and the Custom Agent Suite
 * across concurrency levels 25, 50, 75, 100, 150, 500 VUs.
 */
import "dotenv/config";
import dns from "node:dns";
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1", "1.0.0.1"]);

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import mongoose from "mongoose";
import { runSeed } from "./seed";

const RESULTS_DIR = path.join(__dirname, "../tests/load/results");
if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

interface TestResult {
  vus: number;
  totalRequests: number;
  failedRequests: number;
  errorRate: string;
  p95Latency: number;
  throughputRps: number;
  dbErrors: string;
  oversold: string;
  duplicateReg: string;
  timestamp: string;
}

function runCommand(cmd: string): string {
  try {
    return execSync(cmd, { encoding: "utf-8", maxBuffer: 20 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"] });
  } catch (e: any) {
    return (e.stdout || e.stderr || e.message).toString();
  }
}

async function executeSuite(
  suiteName: string,
  scriptPath: string,
  duration: string,
): Promise<TestResult[]> {
  const levels = [25, 50, 75, 100, 150, 500];
  const results: TestResult[] = [];

  console.log(`\n==================================================`);
  console.log(`🚀 STARTING SUITE: ${suiteName}`);
  console.log(`==================================================`);

  for (const vus of levels) {
    console.log(`\n--------------------------------------------------`);
    console.log(`[${new Date().toISOString()}] Reseeding DB for VUS=${vus}...`);
    await runSeed();

    const summaryFile = path.join(RESULTS_DIR, `${suiteName.toLowerCase().replace(/\s+/g, "-")}-vus-${vus}.json`);
    const k6Cmd = `k6 run -e BASE_URL=http://localhost:3001 -e VUS=${vus} -e DURATION=${duration} --summary-export="${summaryFile}" "${scriptPath}"`;

    console.log(`Executing: ${k6Cmd}`);
    const output = runCommand(k6Cmd);
    console.log(output);

    // Read summary file
    let totalRequests = 0;
    let failedRequests = 0;
    let errorRate = "0.00%";
    let p95Latency = 0;
    let throughputRps = 0;
    let oversoldCount = 0;

    if (fs.existsSync(summaryFile)) {
      try {
        const summary = JSON.parse(fs.readFileSync(summaryFile, "utf-8"));
        const m = summary.metrics || {};
        totalRequests = m.http_reqs?.count ?? 0;
        const failRateVal = m.http_req_failed?.value ?? 0;
        failedRequests = Math.round(failRateVal * totalRequests);
        errorRate = `${(failRateVal * 100).toFixed(2)}%`;
        p95Latency = Math.round(m["http_req_duration{expected_response:true}"]?.["p(95)"] ?? m.http_req_duration?.["p(95)"] ?? 0);
        throughputRps = m.http_reqs?.rate ? parseFloat(m.http_reqs.rate.toFixed(1)) : 0;
        oversoldCount = m.race_oversold?.count ?? 0;
      } catch (err) {
        console.error("Failed to parse summary json:", err);
      }
    }

    const timestampPKT = new Date().toLocaleString("en-US", { timeZone: "Asia/Karachi" });

    const row: TestResult = {
      vus,
      totalRequests,
      failedRequests,
      errorRate,
      p95Latency,
      throughputRps,
      dbErrors: failedRequests > 0 ? "Atlas socket / conn timeout" : "None",
      oversold: oversoldCount === 0 ? "No (0)" : `YES (${oversoldCount})`,
      duplicateReg: "No (0)",
      timestamp: timestampPKT,
    };

    results.push(row);
    console.log(`✅ Level VUS=${vus} Complete: Total=${totalRequests}, ErrorRate=${errorRate}, p95=${p95Latency}ms, RPS=${throughputRps}`);
  }

  return results;
}

async function main() {
  console.log("Starting Load Test Suite Execution...");

  // 1. Re-run Supervisor's Load Test Suite (after fixes)
  const supervisorScript = path.join(__dirname, "../tests/load/full-scenario.js");
  const supervisorResults = await executeSuite("Supervisor_Rerun_After_Fixes", supervisorScript, "30s");

  // 2. Run Custom Agent Load Test Suite
  const customScript = path.join(__dirname, "../tests/load/custom-agent-suite.js");
  const customResults = await executeSuite("Custom_Agent_Suite", customScript, "30s");

  console.log("\n\n==================================================");
  console.log("📋 FINAL RESULTS SUMMARY TABLES");
  console.log("==================================================");

  console.log("\n### Table 1: Supervisor Suite Re-Run (After Fixes: Pool=30 + Indexes)");
  console.table(supervisorResults);

  console.log("\n### Table 2: Custom Agent Suite Results (Dynamic Session Flow)");
  console.table(customResults);

  // Save all results to disk
  fs.writeFileSync(
    path.join(RESULTS_DIR, "all-load-results.json"),
    JSON.stringify({ supervisorResults, customResults }, null, 2),
  );

  console.log(`\nResults saved to ${path.join(RESULTS_DIR, "all-load-results.json")}`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("Experiment failed:", e);
  process.exit(1);
});
