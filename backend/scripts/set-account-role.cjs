// Operator-only role provisioning. No public endpoint can promote an account.
// Usage: node scripts/set-account-role.cjs email@example.com organizer|player
require("dotenv").config({ path: require("node:path").join(__dirname, "../.env"), quiet: true });
const mongoose = require("mongoose");
const { Account, AuthSession } = require("../dist/models/Auth");
async function main() {
  const [email, role] = process.argv.slice(2);
  if (!email || !["organizer", "player"].includes(role)) throw new Error("Provide an existing account email and organizer|player");
  await mongoose.connect(process.env.MONGODB_URI);
  const account = await Account.findOneAndUpdate({ email: email.trim().toLowerCase(), disabled: false }, { $set: { role } }, { new: true });
  if (!account) throw new Error("Account does not exist. The person must sign up first; verify their identity before granting a role.");
  await AuthSession.deleteMany({ accountId: account._id });
  console.log(`Role set to ${role}; existing sessions revoked. Account must sign in again.`);
}
main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
