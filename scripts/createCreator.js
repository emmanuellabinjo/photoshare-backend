/**
 * scripts/createCreator.js
 * Run once to provision a creator account.
 * Usage: node scripts/createCreator.js
 * 
 * Set CREATOR_EMAIL, CREATOR_PASSWORD, CREATOR_NAME as env vars
 * or edit the defaults below.
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { createUser, findUserByEmail } = require("../services/cosmosService");

const EMAIL = process.env.CREATOR_EMAIL || "creator@photoshare.dev";
const PASSWORD = process.env.CREATOR_PASSWORD || "Creator@2024!";
const DISPLAY_NAME = process.env.CREATOR_NAME || "PhotoShare Creator";

async function main() {
  console.log(`\nProvisioning creator account: ${EMAIL}`);

  const existing = await findUserByEmail(EMAIL);
  if (existing) {
    console.log("✓ Creator account already exists. No action taken.");
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const user = {
    id: uuidv4(),
    email: EMAIL,
    displayName: DISPLAY_NAME,
    passwordHash,
    role: "creator",
    createdAt: new Date().toISOString(),
  };

  await createUser(user);

  console.log("\n✅ Creator account created successfully:");
  console.log(`   Email:    ${EMAIL}`);
  console.log(`   Password: ${PASSWORD}`);
  console.log(`   Role:     creator`);
  console.log("\n⚠️  Change the password after first login in production.\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Failed to create creator:", err.message);
  process.exit(1);
});
