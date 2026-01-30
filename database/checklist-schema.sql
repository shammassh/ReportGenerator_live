/*
 * Checklist Management Database Schema
 * 
 * Purpose: Track version history of checklist questions across all 13 master sections
 * 
 * Tables:
 *   - ChecklistVersions: Audit trail for all checklist changes
 */

USE FoodSafetyDB;
GO

-- ============================================
-- Table: ChecklistVersions
-- Description: Tracks all changes to checklist questions
-- ============================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ChecklistVersions')
BEGIN
    CREATE TABLE ChecklistVersions (
        id INT PRIMARY KEY IDENTITY(1,1),
        section_name NVARCHAR(255) NOT NULL,           -- e.g., "Food Storage & Dry Storage"
        question_id NVARCHAR(50),                      -- SharePoint item ID or unique identifier
        action VARCHAR(50) NOT NULL,                   -- ADD, UPDATE, DEACTIVATE, ACTIVATE, DELETE
        before_state NVARCHAR(MAX),                    -- JSON of question before change
        after_state NVARCHAR(MAX),                     -- JSON of question after change
        changed_by_user_id INT,                        -- FK to Users table
        changed_by_email NVARCHAR(255),                -- Email for quick reference
        changed_at DATETIME2 DEFAULT GETDATE(),        -- Timestamp of change
        reason NVARCHAR(MAX),                          -- Optional reason for change
        ip_address NVARCHAR(50),                       -- IP address of user
        
        CONSTRAINT FK_ChecklistVersions_User 
            FOREIGN KEY (changed_by_user_id) 
            REFERENCES Users(id)
            ON DELETE SET NULL
    );
    
    PRINT '✅ Table ChecklistVersions created successfully';
END
ELSE
BEGIN
    PRINT '⚠️  Table ChecklistVersions already exists';
END
GO

-- ============================================
-- Indexes for Performance
-- ============================================

-- Index on section_name for fast filtering by section
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_checklist_section')
BEGIN
    CREATE INDEX idx_checklist_section 
    ON ChecklistVersions(section_name);
    PRINT '✅ Index idx_checklist_section created';
END
GO

-- Index on question_id for tracking specific question history
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_checklist_question')
BEGIN
    CREATE INDEX idx_checklist_question 
    ON ChecklistVersions(question_id);
    PRINT '✅ Index idx_checklist_question created';
END
GO

-- Index on changed_at for chronological queries
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_checklist_timestamp')
BEGIN
    CREATE INDEX idx_checklist_timestamp 
    ON ChecklistVersions(changed_at DESC);
    PRINT '✅ Index idx_checklist_timestamp created';
END
GO

-- Index on changed_by_user_id for user activity tracking
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_checklist_user')
BEGIN
    CREATE INDEX idx_checklist_user 
    ON ChecklistVersions(changed_by_user_id);
    PRINT '✅ Index idx_checklist_user created';
END
GO

-- Index on action for filtering by change type
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_checklist_action')
BEGIN
    CREATE INDEX idx_checklist_action 
    ON ChecklistVersions(action);
    PRINT '✅ Index idx_checklist_action created';
END
GO

-- ============================================
-- Views for Common Queries
-- ============================================

-- View: Recent Changes (Last 100)
IF OBJECT_ID('vw_RecentChecklistChanges', 'V') IS NOT NULL
    DROP VIEW vw_RecentChecklistChanges;
GO

CREATE VIEW vw_RecentChecklistChanges AS
SELECT TOP 100
    cv.id,
    cv.section_name,
    cv.question_id,
    cv.action,
    cv.changed_by_email,
    u.display_name AS changed_by_name,
    u.role AS user_role,
    cv.changed_at,
    cv.reason,
    CASE 
        WHEN cv.action = 'ADD' THEN '➕ Added'
        WHEN cv.action = 'UPDATE' THEN '✏️ Updated'
        WHEN cv.action = 'DEACTIVATE' THEN '⏸️ Deactivated'
        WHEN cv.action = 'ACTIVATE' THEN '▶️ Activated'
        WHEN cv.action = 'DELETE' THEN '🗑️ Deleted'
        ELSE cv.action
    END AS action_label
FROM ChecklistVersions cv
LEFT JOIN Users u ON cv.changed_by_user_id = u.id
ORDER BY cv.changed_at DESC;
GO

PRINT '✅ View vw_RecentChecklistChanges created';
GO

-- View: Changes by Section
IF OBJECT_ID('vw_ChecklistChangesBySection', 'V') IS NOT NULL
    DROP VIEW vw_ChecklistChangesBySection;
GO

CREATE VIEW vw_ChecklistChangesBySection AS
SELECT 
    section_name,
    COUNT(*) AS total_changes,
    SUM(CASE WHEN action = 'ADD' THEN 1 ELSE 0 END) AS additions,
    SUM(CASE WHEN action = 'UPDATE' THEN 1 ELSE 0 END) AS updates,
    SUM(CASE WHEN action = 'DEACTIVATE' THEN 1 ELSE 0 END) AS deactivations,
    SUM(CASE WHEN action = 'ACTIVATE' THEN 1 ELSE 0 END) AS activations,
    SUM(CASE WHEN action = 'DELETE' THEN 1 ELSE 0 END) AS deletions,
    MAX(changed_at) AS last_modified
FROM ChecklistVersions
GROUP BY section_name;
GO

PRINT '✅ View vw_ChecklistChangesBySection created';
GO

-- ============================================
-- Stored Procedures
-- ============================================

-- Procedure: Log checklist change
IF OBJECT_ID('sp_LogChecklistChange', 'P') IS NOT NULL
    DROP PROCEDURE sp_LogChecklistChange;
GO

CREATE PROCEDURE sp_LogChecklistChange
    @section_name NVARCHAR(255),
    @question_id NVARCHAR(50),
    @action VARCHAR(50),
    @before_state NVARCHAR(MAX),
    @after_state NVARCHAR(MAX),
    @changed_by_user_id INT,
    @changed_by_email NVARCHAR(255),
    @reason NVARCHAR(MAX) = NULL,
    @ip_address NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    INSERT INTO ChecklistVersions (
        section_name,
        question_id,
        action,
        before_state,
        after_state,
        changed_by_user_id,
        changed_by_email,
        reason,
        ip_address
    )
    VALUES (
        @section_name,
        @question_id,
        @action,
        @before_state,
        @after_state,
        @changed_by_user_id,
        @changed_by_email,
        @reason,
        @ip_address
    );
    
    SELECT SCOPE_IDENTITY() AS version_id;
END
GO

PRINT '✅ Stored procedure sp_LogChecklistChange created';
GO

-- Procedure: Get question history
IF OBJECT_ID('sp_GetQuestionHistory', 'P') IS NOT NULL
    DROP PROCEDURE sp_GetQuestionHistory;
GO

CREATE PROCEDURE sp_GetQuestionHistory
    @section_name NVARCHAR(255),
    @question_id NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        cv.*,
        u.display_name AS changed_by_name,
        u.role AS user_role
    FROM ChecklistVersions cv
    LEFT JOIN Users u ON cv.changed_by_user_id = u.id
    WHERE cv.section_name = @section_name
      AND cv.question_id = @question_id
    ORDER BY cv.changed_at DESC;
END
GO

PRINT '✅ Stored procedure sp_GetQuestionHistory created';
GO

-- Procedure: Get changes by date range
IF OBJECT_ID('sp_GetChangesByDateRange', 'P') IS NOT NULL
    DROP PROCEDURE sp_GetChangesByDateRange;
GO

CREATE PROCEDURE sp_GetChangesByDateRange
    @start_date DATETIME2,
    @end_date DATETIME2,
    @section_name NVARCHAR(255) = NULL,
    @user_id INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        cv.*,
        u.display_name AS changed_by_name,
        u.role AS user_role
    FROM ChecklistVersions cv
    LEFT JOIN Users u ON cv.changed_by_user_id = u.id
    WHERE cv.changed_at BETWEEN @start_date AND @end_date
      AND (@section_name IS NULL OR cv.section_name = @section_name)
      AND (@user_id IS NULL OR cv.changed_by_user_id = @user_id)
    ORDER BY cv.changed_at DESC;
END
GO

PRINT '✅ Stored procedure sp_GetChangesByDateRange created';
GO

-- ============================================
-- Summary Report
-- ============================================

PRINT '';
PRINT '┌────────────────────────────────────────────────────────────┐';
PRINT '│   Checklist Management Schema Setup Complete              │';
PRINT '└────────────────────────────────────────────────────────────┘';
PRINT '';
PRINT '✅ Tables created:';
PRINT '   • ChecklistVersions (with version history tracking)';
PRINT '';
PRINT '✅ Indexes created for performance:';
PRINT '   • idx_checklist_section (section filtering)';
PRINT '   • idx_checklist_question (question tracking)';
PRINT '   • idx_checklist_timestamp (chronological queries)';
PRINT '   • idx_checklist_user (user activity)';
PRINT '   • idx_checklist_action (action filtering)';
PRINT '';
PRINT '✅ Views created:';
PRINT '   • vw_RecentChecklistChanges';
PRINT '   • vw_ChecklistChangesBySection';
PRINT '';
PRINT '✅ Stored procedures created:';
PRINT '   • sp_LogChecklistChange';
PRINT '   • sp_GetQuestionHistory';
PRINT '   • sp_GetChangesByDateRange';
PRINT '';
PRINT '🎯 Next step: Build checklist-service.js';
PRINT '';

GO
