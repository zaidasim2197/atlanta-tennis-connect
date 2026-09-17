/**
 * MongoDB connection with caching for Vercel serverless.
 * On a cold start a new connection is opened; on warm invocations the cached
 * promise is reused so we never open more connections than necessary.
 */
import mongoose from "mongoose";

declare global {
  // eslint-disable-next-line no-var
  var __mongooseConn: Promise<typeof mongoose> | undefined;
}

export async function connectDB(): Promise<typeof mongoose> {
  if (global.__mongooseConn) return global.__mongooseConn;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");

  global.__mongooseConn = mongoose.connect(uri, {
    // Keep the pool small – Vercel spins up many concurrent functions
    maxPoolSize: 5,
    minPoolSize: 1,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 10000,
  });

  return global.__mongooseConn;
}
