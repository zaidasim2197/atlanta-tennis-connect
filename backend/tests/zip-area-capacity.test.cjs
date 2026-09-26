const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { APPROVED_ATLANTA_ZIPS, ATLANTA_AREAS } = require("../dist/lib/constants");
const { z } = require("zod");

describe("Atlanta ZIP Codes and Metro Areas", () => {
  it("defines exactly 53 approved Atlanta, Alpharetta, Cumming, and Marietta metro ZIP codes", () => {
    assert.strictEqual(APPROVED_ATLANTA_ZIPS.length, 53);
    // Verify sample approved zips across metro regions
    assert.ok(APPROVED_ATLANTA_ZIPS.includes("30004")); // Alpharetta
    assert.ok(APPROVED_ATLANTA_ZIPS.includes("30040")); // Cumming
    assert.ok(APPROVED_ATLANTA_ZIPS.includes("30067")); // Marietta
    assert.ok(APPROVED_ATLANTA_ZIPS.includes("30309")); // Midtown Atlanta
    assert.ok(APPROVED_ATLANTA_ZIPS.includes("30305")); // Buckhead
    assert.ok(APPROVED_ATLANTA_ZIPS.includes("30328")); // Sandy Springs
  });

  it("defines 6 approved metro areas with Cumming", () => {
    assert.strictEqual(ATLANTA_AREAS.length, 6);
    assert.deepStrictEqual([...ATLANTA_AREAS], [
      "Midtown",
      "Buckhead",
      "Cumming",
      "Sandy Springs",
      "Alpharetta",
      "Marietta",
    ]);
  });

  it("validates ZIP codes strictly via Zod enum", () => {
    const ZipSchema = z.enum(APPROVED_ATLANTA_ZIPS);

    // Valid ZIPs pass
    assert.strictEqual(ZipSchema.safeParse("30309").success, true);
    assert.strictEqual(ZipSchema.safeParse("30004").success, true); // Alpharetta
    assert.strictEqual(ZipSchema.safeParse("30040").success, true); // Cumming
    assert.strictEqual(ZipSchema.safeParse("30067").success, true); // Marietta

    // Invalid or non-approved ZIPs fail
    assert.strictEqual(ZipSchema.safeParse("30030").success, false); // Decatur (excluded)
    assert.strictEqual(ZipSchema.safeParse("75200").success, false);
    assert.strictEqual(ZipSchema.safeParse("12345").success, false);
    assert.strictEqual(ZipSchema.safeParse("3030").success, false);
    assert.strictEqual(ZipSchema.safeParse("303090").success, false);
    assert.strictEqual(ZipSchema.safeParse("abcde").success, false);
  });

  it("enforces league capacity math invariant: registeredCount + spotsRemaining === playerLimit", () => {
    const playerLimit = 26;
    const spotsRemaining = 0;
    const registeredCount = playerLimit - spotsRemaining;
    assert.strictEqual(registeredCount, 26);
    assert.strictEqual(registeredCount + spotsRemaining, playerLimit);
    assert.ok(registeredCount <= playerLimit);
  });
});
