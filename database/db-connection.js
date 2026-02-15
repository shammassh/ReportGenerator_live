/**
 * Database Connection Pool Module
 * Provides a shared SQL Server connection pool
 */

const sql = require('mssql');
require('dotenv').config();

let pool = null;
let connecting = false;

const config = {
    server: process.env.SQL_SERVER || process.env.DB_SERVER || 'localhost',
    database: process.env.SQL_DATABASE || process.env.DB_NAME || 'FoodSafetyDB_Live',
    user: process.env.SQL_USER || process.env.DB_USER,
    password: process.env.SQL_PASSWORD || process.env.DB_PASSWORD,
    options: {
        encrypt: process.env.SQL_ENCRYPT === 'true' || false,
        trustServerCertificate: process.env.SQL_TRUST_CERT === 'true' || true,
        requestTimeout: 120000    // 2 minutes for queries
    },
    connectionTimeout: 30000  // 30 seconds to connect
};

/**
 * Get or create the database connection pool
 * @returns {Promise<sql.ConnectionPool>}
 */
async function getPool() {
    // If pool exists and is connected, return it
    if (pool && pool.connected) {
        return pool;
    }
    
    // If currently connecting, wait for it
    if (connecting) {
        await new Promise(resolve => setTimeout(resolve, 100));
        return getPool();
    }
    
    // Create new connection
    connecting = true;
    try {
        // Close existing pool if it exists but is disconnected
        if (pool) {
            try {
                await pool.close();
            } catch (e) {
                // Ignore close errors
            }
            pool = null;
        }
        
        pool = await sql.connect(config);
        console.log('✅ [DB] Connected to database:', config.database);
        
        // Handle pool errors
        pool.on('error', err => {
            console.error('❌ [DB] Pool error:', err.message);
            pool = null;
        });
        
        return pool;
    } catch (error) {
        console.error('❌ [DB] Connection failed:', error.message);
        throw error;
    } finally {
        connecting = false;
    }
}

/**
 * Close the connection pool
 */
async function closePool() {
    if (pool) {
        try {
            await pool.close();
            pool = null;
            console.log('✅ [DB] Connection pool closed');
        } catch (error) {
            console.error('❌ [DB] Error closing pool:', error.message);
        }
    }
}

module.exports = {
    getPool,
    closePool,
    sql
};
