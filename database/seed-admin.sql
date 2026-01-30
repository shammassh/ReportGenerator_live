-- =============================================
-- Seed Admin Account
-- Pre-configure admin user
-- =============================================
-- Run this AFTER auth-schema.sql

USE FoodSafetyDB;
GO

-- =============================================
-- Pre-configure Admin Account
-- Email: muhammad.shammas@gmrlgroup.com
-- =============================================

-- Check if admin already exists
IF NOT EXISTS (SELECT * FROM Users WHERE email = 'muhammad.shammas@gmrlgroup.com')
BEGIN
    INSERT INTO Users (
        azure_user_id,
        email,
        display_name,
        role,
        is_active,
        is_approved,
        created_at,
        created_by
    ) VALUES (
        'PLACEHOLDER_AZURE_ID',                 -- Will be updated on first login
        'muhammad.shammas@gmrlgroup.com',
        'Muhammad Shammas',
        'Admin',
        1,                                      -- Active
        1,                                      -- Approved
        GETDATE(),
        'SYSTEM'
    );
    
    PRINT '✅ Admin account created: muhammad.shammas@gmrlgroup.com';
    PRINT '   • Role: Admin';
    PRINT '   • Status: Active & Approved';
    PRINT '   • Azure ID will be updated on first login';
END
ELSE
BEGIN
    PRINT '✓ Admin account already exists: muhammad.shammas@gmrlgroup.com';
    
    -- Update to ensure admin role and active status
    UPDATE Users 
    SET 
        role = 'Admin',
        is_active = 1,
        is_approved = 1,
        updated_at = GETDATE()
    WHERE email = 'muhammad.shammas@gmrlgroup.com';
    
    PRINT '✅ Admin account updated with Admin role';
END
GO

-- =============================================
-- Display Admin Account Info
-- =============================================
SELECT 
    id,
    email,
    display_name,
    role,
    is_active,
    is_approved,
    created_at
FROM Users 
WHERE email = 'muhammad.shammas@gmrlgroup.com';

PRINT '';
PRINT '╔════════════════════════════════════════════════════════════╗';
PRINT '║   Admin Account Setup Complete                             ║';
PRINT '╚════════════════════════════════════════════════════════════╝';
PRINT '';
PRINT '👑 Admin user configured:';
PRINT '   Email: muhammad.shammas@gmrlgroup.com';
PRINT '   Role: Admin (Full System Access)';
PRINT '';
PRINT '📝 When this user logs in for the first time:';
PRINT '   • Azure User ID will be captured from Microsoft Graph';
PRINT '   • Full name and photo will be updated';
PRINT '   • User will have immediate admin access';
PRINT '';
