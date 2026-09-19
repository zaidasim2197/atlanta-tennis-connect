import "dotenv/config";
import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);
import mongoose from "mongoose";
import { Player } from "../src/models/Player";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const demoUsers = [
    {
      slug: "p-demo-player",
      firstName: "Alex",
      lastName: "Mercer",
      email: "player@baselineatl.com",
      phone: "(404) 555-0100",
      ntrp: "3.5",
      city: "Atlanta",
      zipCode: "30305",
      rating: 3.55,
      profileBio: "Demo player for Atlanta Tennis Platform",
      preferredSide: "both",
    },
    {
      slug: "p-demo-organizer",
      firstName: "Dana",
      lastName: "Whitfield",
      email: "organizer@baselineatl.com",
      phone: "(404) 555-0101",
      ntrp: "4.0",
      city: "Atlanta",
      zipCode: "30309",
      rating: 4.1,
      profileBio: "League Organizer for Atlanta Tennis Platform",
      preferredSide: "both",
    },
  ];

  for (const u of demoUsers) {
    const res = await Player.findOneAndUpdate(
      { email: u.email },
      { $set: u },
      { upsert: true, new: true }
    );
    console.log("Upserted:", res.email, res.slug);
  }

  const total = await Player.countDocuments();
  console.log("Total players in DB now:", total);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
