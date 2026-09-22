require("dotenv").config({ path: require("node:path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const crypto = require("node:crypto");

const derive = (password, salt) =>
  new Promise((resolve, reject) =>
    crypto.scrypt(
      password,
      salt,
      64,
      { N: 131072, r: 8, p: 1, maxmem: 160 * 1024 * 1024 },
      (err, key) => (err ? reject(err) : resolve(key))
    )
  );

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB Atlas");

  // Ensure Player exists
  await mongoose.connection.collection("players").updateOne(
    { email: "organizer@baselineatl.com" },
    {
      $set: {
        slug: "p-demo-organizer",
        firstName: "Organizer",
        lastName: "",
        email: "organizer@baselineatl.com",
        phone: "(404) 555-0101",
        ntrp: "4.0",
        city: "Atlanta",
        zipCode: "30309",
        rating: 4.1,
        profileBio: "League Organizer for Atlanta Tennis Platform",
        preferredSide: "both",
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );

  // Hash password "organizer123"
  const salt = crypto.randomBytes(16).toString("hex");
  const key = await derive("organizer123", salt);
  const passwordHash = `scrypt$${salt}$${key.toString("hex")}`;

  const res = await mongoose.connection.collection("accounts").updateOne(
    { email: "organizer@baselineatl.com" },
    {
      $set: {
        email: "organizer@baselineatl.com",
        playerSlug: "p-demo-organizer",
        passwordHash,
        role: "organizer",
        disabled: false,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );

  console.log("Successfully seeded demo organizer account:", res);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("Failed to seed organizer:", e);
  process.exit(1);
});
