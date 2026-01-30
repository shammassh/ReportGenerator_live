-- =============================================
-- Email Notifications System Database Schema
-- Food Safety Audit System
-- =============================================
-- Run this script on FoodSafetyDB database
-- Creates: Notifications table for tracking email notifications

USE FoodSafetyDB;
GO

-- =============================================
-- Table: Notifications
-- Stores email notification history
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Notifications')
BEGIN
    CREATE TABLE Notifications (
        id INT PRIMARY KEY IDENTITY(1,1),
        
        -- Report reference
        document_number NVARCHAR(50) NOT NULL,
        report_id INT,
        
        -- Recipient information
        recipient_user_id INT,
        recipient_email NVARCHAR(255) NOT NULL,
        recipient_name NVARCHAR(255),
        recipient_role NVARCHAR(50),
        
        -- Notification details
        notification_type NVARCHAR(50) NOT NULL, -- 'ReportGenerated', 'ActionPlanCreated', etc.
        email_subject NVARCHAR(500),
        email_body NVARCHAR(MAX),
        
        -- Sender information
        sent_by_user_id INT,
        sent_by_email NVARCHAR(255),
        sent_by_name NVARCHAR(255),
        
        -- Status tracking
        status NVARCHAR(50) DEFAULT 'Sent', -- 'Sent', 'Failed', 'Pending'
        error_message NVARCHAR(MAX),
        
        -- Timestamps
        sent_at DATETIME DEFAULT GETDATE(),
        read_at DATETIME,
        
        -- Foreign keys
        FOREIGN KEY (recipient_user_id) REFERENCES Users(id),
        FOREIGN KEY (sent_by_user_id) REFERENCES Users(id),
        
        -- Indexes for performance
        INDEX idx_document_number (document_number),
        INDEX idx_recipient_email (recipient_email),
        INDEX idx_sent_at (sent_at),
        INDEX idx_status (status),
        INDEX idx_notification_type (notification_type)
    );
    
    PRINT '✅ Table Notifications created successfully';
END
ELSE
BEGIN
    PRINT '✓ Table Notifications already exists';
END
GO

-- =============================================
-- Add email notification preferences to Users table
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'email_notifications_enabled')
BEGIN
    ALTER TABLE Users ADD email_notifications_enabled BIT DEFAULT 1;
    PRINT '✅ Added email_notifications_enabled column to Users table';
END
ELSE
BEGIN
    PRINT '✓ Column email_notifications_enabled already exists';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'notification_preferences')
BEGIN
    ALTER TABLE Users ADD notification_preferences NVARCHAR(MAX);
    PRINT '✅ Added notification_preferences column to Users table';
END
ELSE
BEGIN
    PRINT '✓ Column notification_preferences already exists';
END
GO

-- =============================================
-- Sample notification preferences JSON structure:
-- {
--   "reportGenerated": true,
--   "actionPlanCreated": true,
--   "reportUpdated": false,
--   "weeklyDigest": true
-- }
-- =============================================

PRINT '✅ Notifications schema setup complete';
GO
