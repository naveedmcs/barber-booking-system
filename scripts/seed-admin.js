#!/usr/bin/env node

/**
 * Idempotent Database Seed CLI Script for Primary Super Admin
 * Initializes 'admin@barberapp.sa' with BCrypt hashed credentials if none exists.
 */

const { execSync } = require("child_process");

const ADMIN_EMAIL = "admin@barberapp.sa";
const ADMIN_NAME = "Super Administrator";
const ADMIN_PHONE = "0500000000";
// BCrypt hash of "Admin123!"
const ADMIN_BCRYPT = "$2a$10$ehdBzoabfflfMR11zP44c.yP72vQoD019tGjTff0gWn4q00Z6j5sS";

console.log("=================================================");
console.log("  Barber SaaS: Primary Super Admin Seed Engine   ");
console.log("=================================================");

function runMysqlQuery(sql) {
  try {
    const cmd = `docker exec barber_mysql mysql -ubarber_user -pbarber_password barber_saas -e "${sql}"`;
    return execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  } catch (err) {
    throw new Error(`MySQL execution failed: ${err.message}`);
  }
}

try {
  console.log(`Checking database for existing Super Admin (${ADMIN_EMAIL})...`);
  const checkSql = `SELECT id, email, role, active FROM users WHERE email='${ADMIN_EMAIL}' OR role='SUPER_ADMIN' LIMIT 1;`;
  const result = runMysqlQuery(checkSql);

  if (result && result.includes(ADMIN_EMAIL)) {
    console.log(`✓ Idempotent: Super Admin (${ADMIN_EMAIL}) already exists in the database.`);
    console.log("  No modification required. System authority is secure.");
    process.exit(0);
  }

  console.log(`Creating primary Super Admin (${ADMIN_EMAIL}) with BCrypt password...`);
  const insertSql = `INSERT INTO users (email, password, full_name, role, phone, active, created_at, updated_at) VALUES ('${ADMIN_EMAIL}', '${ADMIN_BCRYPT}', '${ADMIN_NAME}', 'SUPER_ADMIN', '${ADMIN_PHONE}', 1, NOW(), NOW());`;
  runMysqlQuery(insertSql);

  console.log("✓ Super Admin initialized successfully!");
  console.log(`  Email: ${ADMIN_EMAIL}`);
  console.log("  Role:  SUPER_ADMIN");
  console.log("  Pass:  [Hashed with BCrypt]");
  process.exit(0);

} catch (err) {
  console.error("❌ Failed to seed Super Admin:", err.message);
  process.exit(1);
}
