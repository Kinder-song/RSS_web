import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000
});

// Test connection asynchronously — does not block server startup
async function testConnection(retries = 5, delayMs = 3000) {
    for (let i = 0; i < retries; i++) {
        try {
            const conn = await pool.getConnection();
            conn.release();
            console.log('Database connected successfully');
            return;
        } catch (err) {
            console.error(`DB connection attempt ${i + 1}/${retries} failed: ${err.message}`);
            if (i < retries - 1) {
                await new Promise(r => setTimeout(r, delayMs));
            }
        }
    }
    console.error('Database connection failed after all retries — will retry on next query');
}

testConnection();

export default pool;
