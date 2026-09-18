/**
 * Phase 3 – Database Size Measurement & Capacity Metrics
 */
import "dotenv/config";
import dns from "node:dns";
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1", "1.0.0.1"]);

import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";

async function measureDb() {
  await connectDB();
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database handle not available");

  const stats = await db.command({ dbStats: 1 });
  const collections = ["players", "tournamenthistories", "reservations", "leagues", "seasons", "auditlogs"];

  console.log("==================================================");
  console.log("📊 MONGODB DATABASE STATS (Measured via dbStats):");
  console.log(`- Database Name:    ${stats.db}`);
  console.log(`- Collections:      ${stats.collections}`);
  console.log(`- Objects / Docs:   ${stats.objects}`);
  console.log(`- Data Size:        ${stats.dataSize} bytes (${(stats.dataSize / 1024).toFixed(2)} KB)`);
  console.log(`- Storage Size:     ${stats.storageSize} bytes (${(stats.storageSize / (1024 * 1024)).toFixed(2)} MB)`);
  console.log(`- Index Size:       ${stats.indexSize} bytes (${(stats.indexSize / 1024).toFixed(2)} KB)`);
  console.log(`- Total Size:       ${stats.totalSize} bytes (${(stats.totalSize / (1024 * 1024)).toFixed(2)} MB)`);
  console.log(`- Avg Obj Size:     ${stats.avgObjSize ? stats.avgObjSize.toFixed(1) : "N/A"} bytes`);
  console.log("--------------------------------------------------");
  console.log("📁 PER-COLLECTION STATS (collStats):");

  for (const name of collections) {
    try {
      const cStats = await db.command({ collStats: name });
      console.log(`  • ${name.padEnd(20)}: ${String(cStats.count).padEnd(5)} docs | Data: ${(cStats.size / 1024).toFixed(2)} KB | Storage: ${(cStats.storageSize / 1024).toFixed(2)} KB | Avg Doc: ${cStats.avgObjSize ? cStats.avgObjSize.toFixed(1) : 0} bytes | Total Index: ${(cStats.totalIndexSize / 1024).toFixed(2)} KB`);
    } catch (e) {
      console.log(`  • ${name.padEnd(20)}: collStats error: ${(e as Error).message}`);
    }
  }
  console.log("==================================================");

  await mongoose.disconnect();
}

measureDb().catch((e) => {
  console.error("Measurement failed:", e);
  process.exit(1);
});
