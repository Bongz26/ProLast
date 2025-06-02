require('dotenv').config();
const { Pool } = require("pg");

// ✅ Railway Database Configuration
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// ✅ Log Database Connection Details
console.log("🔍 Attempting DB Connection...");
console.log("🔍 DATABASE_URL:", process.env.DATABASE_URL);

// ✅ Test Connection
pool.connect()
    .then(() => console.log("✅ Connected to PostgreSQL successfully!"))
    .catch((err) => {
        console.error("❌ Database Connection Error:", err.message);
        process.exit(1);
    });

module.exports = pool;