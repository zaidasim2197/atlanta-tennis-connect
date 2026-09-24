const { describe, it } = require("node:test");
const assert = require("node:assert");
const { z } = require("zod");

describe("Gender Schema Additions", () => {
  const SkillLevel = z.enum(["2.5", "3.0", "3.5", "4.0", "4.5", "5.0"]);
  
  const credentials = z.object({
    email: z.string().trim().email().max(254).transform(s => s.toLowerCase()),
    password: z.string().min(1).max(128)
  });

  const signup = credentials.extend({
    password: z.string().min(6).max(128),
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    phone: z.string().max(40).optional(),
    city: z.string().max(100).optional(),
    ntrp: SkillLevel,
    dateOfBirth: z.string().optional(),
    parentName: z.string().optional(),
    parentPhone: z.string().optional(),
    isJunior: z.boolean().optional(),
    zipCode: z.string().optional(),
    preferredCourt: z.string().optional(),
    gender: z.enum(["male", "female", "prefer-not-to-say"]).optional(),
  }).strict();

  it("accepts valid gender values", () => {
    for (const g of ["male", "female", "prefer-not-to-say"]) {
      const res = signup.safeParse({
        email: "test@example.com",
        password: "password123",
        firstName: "Alex",
        lastName: "Test",
        ntrp: "3.5",
        gender: g
      });
      assert.strictEqual(res.success, true);
    }
  });

  it("accepts signup when gender is omitted (backward compatibility)", () => {
    const res = signup.safeParse({
      email: "test@example.com",
      password: "password123",
      firstName: "Alex",
      lastName: "Test",
      ntrp: "3.5"
    });
    assert.strictEqual(res.success, true);
  });

  it("rejects unknown gender strings", () => {
    const res = signup.safeParse({
      email: "test@example.com",
      password: "password123",
      firstName: "Alex",
      lastName: "Test",
      ntrp: "3.5",
      gender: "other-invalid"
    });
    assert.strictEqual(res.success, false);
  });
});
