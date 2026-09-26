const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env' });

async function restore() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB Atlas");

  // 1. Ensure Player record exists for organizer
  await mongoose.connection.collection("players").updateOne(
    { slug: "p-demo-organizer" },
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
        rating: 4.0,
        accountStatus: "active",
        profileStatus: "complete",
        profileBio: "Tournament & League Director",
        preferredSide: "both",
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );

  // 2. Clear any rate-limiting attempts for organizer
  const resAttempts = await mongoose.connection.collection("authattempts").deleteMany({
    key: { $regex: /organizer@baselineatl\.com/i },
  });
  console.log("Cleared auth attempts:", resAttempts.deletedCount);

  // 3. Test login API directly
  try {
    const fetchRes = await fetch("http://localhost:3001/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "organizer@baselineatl.com",
        password: "organizer123",
        expectedRole: "organizer",
      }),
    });
    const json = await fetchRes.json();
    console.log("HTTP Login response status:", fetchRes.status, json);
  } catch (err) {
    console.log("API test error:", err.message);
  }

  await mongoose.disconnect();
}
restore().catch(console.error);
