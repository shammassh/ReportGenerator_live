-- =============================================
-- Authentication System Database Schema
-- Food Safety Audit System
-- =============================================
-- Run this script on FoodSafetyDB database
-- Creates: Users, Sessions, AuditLog tables

USE FoodSafetyDB;
GO

-- =============================================
-- Table: Users
-- Stores user information and role assignments
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
BEGIN
    CREATE TABLE Users (
        id INT PRIMARY KEY IDENTITY(1,1),
        
        -- From Microsoft Graph API
        azure_user_id NVARCHAR(255) UNIQUE,
        email NVARCHAR(255) NOT NULL UNIQUE,
        display_name NVARCHAR(255),
        photo_url NVARCHAR(500),
        job_title NVARCHAR(255),
        department NVARCHAR(255),
        
        -- Role & Assignment
        role NVARCHAR(50) DEFAULT 'Pending',
        -- Roles: 'Admin', 'Auditor', 'StoreManager', 'CleaningHead', 'ProcurementHead', 'MaintenanceHead', 'Pending'
        
        assigned_stores NVARCHAR(MAX),          -- JSON array: ["GMRL", "AJMAN"] for StoreManagers
        assigned_department NVARCHAR(50),       -- For dept heads: 'Cleaning', 'Procurement', 'Maintenance'
        
        -- Status
        is_active BIT DEFAULT 1,
        is_approved BIT DEFAULT 0,
        
        -- Tracking
        last_login DATETIME,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE(),
        created_by NVARCHAR(255)                -- Admin who assigned role
    );
    
    PRINT '✅ Table Users created successfully';
END
ELSE
BEGIN
    PRINT '✓ Table Users already exists';
END
GO

-- =============================================
-- Table: Sessions
-- Manages user sessions (24-hour expiration)
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Sessions')
BEGIN
    CREATE TABLE Sessions (
        id INT PRIMARY KEY IDENTITY(1,1),
        session_token NVARCHAR(500) UNIQUE NOT NULL,
        user_id INT FOREIGN KEY REFERENCES Users(id),
        
        -- Microsoft tokens (encrypted)
        azure_access_token NVARCHAR(MAX),
        azure_refresh_token NVARCHAR(MAX),
        
        -- Expiration (24 hours)
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT GETDATE(),
        last_activity DATETIME DEFAULT GETDATE()
    );
    
    PRINT '✅ Table Sessions created successfully';
END
ELSE
BEGIN
    PRINT '✓ Table Sessions already exists';
END
GO

-- =============================================
-- Table: Stores
-- Manages store/branch locations
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Stores')
BEGIN
    CREATE TABLE Stores (
        id INT PRIMARY KEY IDENTITY(1,1),
        store_code NVARCHAR(50) UNIQUE NOT NULL,    -- e.g., 'GMRL-ABD', 'GMRL-DXB'
        store_name NVARCHAR(255) NOT NULL,          -- e.g., 'GMRL Abu Dhabi'
        location NVARCHAR(255),                     -- City/Address
        is_active BIT DEFAULT 1,
        
        -- Tracking
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE(),
        created_by NVARCHAR(255)                    -- Admin who created
    );
    
    PRINT '✅ Table Stores created successfully';
END
ELSE
BEGIN
    PRINT '✓ Table Stores already exists';
END
GO

-- =============================================
-- Table: AuditLog
-- Tracks all user actions for security audit
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AuditLog')
BEGIN
    CREATE TABLE AuditLog (
        id INT PRIMARY KEY IDENTITY(1,1),
        user_id INT FOREIGN KEY REFERENCES Users(id),
        user_email NVARCHAR(255),
        
        action NVARCHAR(100),
        -- Actions: 'LOGIN', 'LOGOUT', 'ASSIGN_ROLE', 'GENERATE_REPORT', 
        --          'VIEW_REPORT', 'EDIT_CHECKLIST', 'ASSIGN_DEPARTMENT_HEAD'
        
        target_type NVARCHAR(50),               -- 'User', 'Report', 'Document', 'Checklist'
        target_id NVARCHAR(255),                -- Document Number, User ID, etc.
        details NVARCHAR(MAX),                  -- JSON with additional info
        
        ip_address NVARCHAR(50),
        user_agent NVARCHAR(500),
        timestamp DATETIME DEFAULT GETDATE()
    );
    
    PRINT '✅ Table AuditLog created successfully';
END
ELSE
BEGIN
    PRINT '✓ Table AuditLog already exists';
END
GO

-- =============================================
-- Indexes for Performance
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_users_email' AND object_id = OBJECT_ID('Users'))
BEGIN
    CREATE INDEX idx_users_email ON Users(email);
    PRINT '✅ Index idx_users_email created';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_users_azure_id' AND object_id = OBJECT_ID('Users'))
BEGIN
    CREATE INDEX idx_users_azure_id ON Users(azure_user_id);
    PRINT '✅ Index idx_users_azure_id created';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_users_role' AND object_id = OBJECT_ID('Users'))
BEGIN
    CREATE INDEX idx_users_role ON Users(role);
    PRINT '✅ Index idx_users_role created';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_sessions_token' AND object_id = OBJECT_ID('Sessions'))
BEGIN
    CREATE INDEX idx_sessions_token ON Sessions(session_token);
    PRINT '✅ Index idx_sessions_token created';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_sessions_expires' AND object_id = OBJECT_ID('Sessions'))
BEGIN
    CREATE INDEX idx_sessions_expires ON Sessions(expires_at);
    PRINT '✅ Index idx_sessions_expires created';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_audit_user' AND object_id = OBJECT_ID('AuditLog'))
BEGIN
    CREATE INDEX idx_audit_user ON AuditLog(user_id);
    PRINT '✅ Index idx_audit_user created';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_audit_timestamp' AND object_id = OBJECT_ID('AuditLog'))
BEGIN
    CREATE INDEX idx_audit_timestamp ON AuditLog(timestamp);
    PRINT '✅ Index idx_audit_timestamp created';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_audit_action' AND object_id = OBJECT_ID('AuditLog'))
BEGIN
    CREATE INDEX idx_audit_action ON AuditLog(action);
    PRINT '✅ Index idx_audit_action created';
END
GO

-- =============================================
-- Stored Procedure: Cleanup Expired Sessions
-- Run this periodically to remove old sessions
-- =============================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_CleanupExpiredSessions')
BEGIN
    DROP PROCEDURE sp_CleanupExpiredSessions;
END
GO

CREATE PROCEDURE sp_CleanupExpiredSessions
AS
BEGIN
    DELETE FROM Sessions WHERE expires_at < GETDATE();
    PRINT CAST(@@ROWCOUNT AS VARCHAR) + ' expired sessions cleaned up';
END
GO

PRINT '✅ Stored procedure sp_CleanupExpiredSessions created';
GO

-- =============================================
-- Seed Data: Default Stores
-- =============================================
IF NOT EXISTS (SELECT * FROM Stores)
BEGIN
    INSERT INTO Stores (store_code, store_name, location, is_active, created_by)
    VALUES 
        ('GMRL-ABD', 'GMRL Abu Dhabi', 'Abu Dhabi, UAE', 1, 'SYSTEM'),
        ('GMRL-DXB', 'GMRL Dubai Marina', 'Dubai Marina, UAE', 1, 'SYSTEM'),
        ('GMRL-SHJ', 'GMRL Sharjah', 'Sharjah, UAE', 1, 'SYSTEM'),
        ('GMRL-AAN', 'GMRL Al Ain', 'Al Ain, UAE', 1, 'SYSTEM'),
        ('GMRL-FUJ', 'GMRL Fujairah', 'Fujairah, UAE', 1, 'SYSTEM'),
        ('GMRL-RAK', 'GMRL Ras Al Khaimah', 'Ras Al Khaimah, UAE', 1, 'SYSTEM');
    
    PRINT '✅ Default stores seeded successfully';
END
GO

-- =============================================
-- Summary
-- =============================================
PRINT '';
PRINT '╔════════════════════════════════════════════════════════════╗';
PRINT '║   Authentication System Schema Setup Complete              ║';
PRINT '╚════════════════════════════════════════════════════════════╝';
PRINT '';
PRINT '✅ Tables created:';
PRINT '   • Users (with roles and assignments)';
PRINT '   • Sessions (24-hour expiration)';
PRINT '   • Stores (branch locations)';
PRINT '   • AuditLog (security tracking)';
PRINT '';
PRINT '✅ Indexes created for performance';
PRINT '✅ Stored procedures created';
PRINT '✅ Default stores seeded';
PRINT '';
PRINT '📝 Next step: Run seed-admin.sql to pre-configure admin account';
PRINT '';
