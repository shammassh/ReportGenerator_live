/**
 * SQL Server Connector for Food Safety Action Plan
 * Handles database connections and operations
 */

const sql = require('mssql');
require('dotenv').config();

class SQLConnector {
    constructor() {
        this.pool = null;
        
        // Build config based on authentication type
        const useWindowsAuth = !process.env.SQL_USER || !process.env.SQL_PASSWORD;
        
        this.config = {
            server: process.env.SQL_SERVER,
            database: process.env.SQL_DATABASE,
            connectionTimeout: 30000, // 30 seconds
            requestTimeout: 30000,
            options: {
                encrypt: process.env.SQL_ENCRYPT === 'true', // Azure requires encryption
                trustServerCertificate: process.env.SQL_TRUST_CERT === 'true', // For local dev
                enableArithAbort: true,
                instanceName: process.env.SQL_INSTANCE || undefined, // For named instances
                useUTC: false
            },
            pool: {
                max: 10,
                min: 0,
                idleTimeoutMillis: 30000
            }
        };
        
        // Add authentication based on type
        if (useWindowsAuth) {
            // Windows Authentication - use default authentication
            this.config.authentication = {
                type: 'default'
            };
            console.log('🔐 Using Windows Authentication (Default)');
        } else {
            // SQL Server Authentication
            this.config.user = process.env.SQL_USER;
            this.config.password = process.env.SQL_PASSWORD;
            console.log('🔐 Using SQL Server Authentication');
        }
    }

    /**
     * Connect to SQL Server
     */
    async connect() {
        try {
            if (this.pool && this.pool.connected) {
                return this.pool;
            }

            console.log('🔌 Connecting to SQL Server...');
            console.log(`   Server: ${this.config.server}`);
            console.log(`   Database: ${this.config.database}`);
            
            this.pool = await sql.connect(this.config);
            console.log('✅ Connected to SQL Server successfully');
            
            return this.pool;
        } catch (error) {
            console.error('❌ SQL Server connection failed:', error.message);
            throw new Error(`Failed to connect to SQL Server: ${error.message}`);
        }
    }

    /**
     * Disconnect from SQL Server
     */
    async disconnect() {
        try {
            if (this.pool) {
                await this.pool.close();
                this.pool = null;
                console.log('🔌 Disconnected from SQL Server');
            }
        } catch (error) {
            console.error('❌ Error disconnecting from SQL Server:', error.message);
        }
    }

    /**
     * Test database connection
     */
    async testConnection() {
        try {
            const pool = await this.connect();
            const result = await pool.request().query('SELECT @@VERSION AS Version');
            
            return {
                success: true,
                message: 'Database connection successful',
                version: result.recordset[0].Version
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }

    /**
     * Execute a query
     */
    async query(queryString, params = {}) {
        try {
            const pool = await this.connect();
            const request = pool.request();

            // Add parameters
            for (const [key, value] of Object.entries(params)) {
                request.input(key, value);
            }

            const result = await request.query(queryString);
            return result.recordset;
        } catch (error) {
            console.error('❌ Query execution failed:', error.message);
            throw error;
        }
    }

    /**
     * Execute a stored procedure
     */
    async executeProcedure(procedureName, params = {}) {
        try {
            const pool = await this.connect();
            const request = pool.request();

            // Add parameters
            for (const [key, value] of Object.entries(params)) {
                request.input(key, value);
            }

            const result = await request.execute(procedureName);
            return result.recordset;
        } catch (error) {
            console.error(`❌ Stored procedure ${procedureName} execution failed:`, error.message);
            throw error;
        }
    }

    /**
     * Get connection pool
     */
    getPool() {
        return this.pool;
    }
}

module.exports = SQLConnector;
