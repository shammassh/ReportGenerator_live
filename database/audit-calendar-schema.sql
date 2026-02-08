-- =============================================
-- Audit Calendar & Scheduling System
-- Created: February 8, 2026
-- =============================================

-- Scheduled Audits Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ScheduledAudits')
CREATE TABLE ScheduledAudits (
    id INT IDENTITY(1,1) PRIMARY KEY,
    store_id INT NOT NULL,                          -- FK to Stores
    store_name NVARCHAR(255) NULL,                  -- Denormalized for easy display
    checklist_schema_id INT NULL,                   -- FK to ChecklistSchemas
    checklist_name NVARCHAR(255) NULL,              -- Denormalized
    auditor_user_id INT NULL,                       -- FK to Users (assigned auditor)
    auditor_name NVARCHAR(255) NULL,                -- Denormalized
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NULL,                       -- Optional time
    priority NVARCHAR(20) DEFAULT 'Normal',         -- Normal, Urgent, Follow-up
    status NVARCHAR(20) DEFAULT 'Scheduled',        -- Scheduled, InProgress, Completed, Cancelled, Missed
    notes NVARCHAR(MAX) NULL,                       -- Instructions for auditor
    recurring_rule_id INT NULL,                     -- FK to RecurringAuditRules if auto-generated
    actual_audit_id INT NULL,                       -- FK to actual audit when completed
    completed_at DATETIME NULL,
    cancelled_at DATETIME NULL,
    cancelled_by INT NULL,
    cancellation_reason NVARCHAR(500) NULL,
    created_by INT NOT NULL,
    created_by_name NVARCHAR(255) NULL,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE()
);
GO

-- Recurring Audit Rules Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'RecurringAuditRules')
CREATE TABLE RecurringAuditRules (
    id INT IDENTITY(1,1) PRIMARY KEY,
    store_id INT NOT NULL,
    store_name NVARCHAR(255) NULL,
    checklist_schema_id INT NULL,
    checklist_name NVARCHAR(255) NULL,
    auditor_user_id INT NULL,                       -- NULL = rotate/assign later
    auditor_name NVARCHAR(255) NULL,
    frequency NVARCHAR(20) NOT NULL,                -- Weekly, BiWeekly, Monthly, Quarterly
    day_of_week INT NULL,                           -- 0=Sunday, 1=Monday, etc. (for Weekly/BiWeekly)
    day_of_month INT NULL,                          -- 1-31 (for Monthly)
    week_of_month INT NULL,                         -- 1-4 or -1 for last (for Monthly "First Monday" etc.)
    preferred_time TIME NULL,
    priority NVARCHAR(20) DEFAULT 'Normal',
    notes NVARCHAR(MAX) NULL,
    start_date DATE NOT NULL,
    end_date DATE NULL,                             -- NULL = no end
    is_active BIT DEFAULT 1,
    last_generated_date DATE NULL,                  -- Track last auto-generation
    created_by INT NOT NULL,
    created_by_name NVARCHAR(255) NULL,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE()
);
GO

-- Indexes for performance
CREATE INDEX IX_ScheduledAudits_Date ON ScheduledAudits(scheduled_date);
CREATE INDEX IX_ScheduledAudits_Store ON ScheduledAudits(store_id);
CREATE INDEX IX_ScheduledAudits_Auditor ON ScheduledAudits(auditor_user_id);
CREATE INDEX IX_ScheduledAudits_Status ON ScheduledAudits(status);
CREATE INDEX IX_RecurringAuditRules_Store ON RecurringAuditRules(store_id);
CREATE INDEX IX_RecurringAuditRules_Active ON RecurringAuditRules(is_active);
GO

-- View for calendar display
CREATE OR ALTER VIEW vw_CalendarAudits AS
SELECT 
    sa.id,
    sa.store_id,
    sa.store_name,
    sa.checklist_schema_id,
    sa.checklist_name,
    sa.auditor_user_id,
    sa.auditor_name,
    sa.scheduled_date,
    sa.scheduled_time,
    sa.priority,
    sa.status,
    sa.notes,
    sa.actual_audit_id,
    sa.created_by,
    sa.created_by_name,
    sa.created_at,
    -- Color coding for UI
    CASE 
        WHEN sa.status = 'Completed' THEN '#10b981'      -- Green
        WHEN sa.status = 'InProgress' THEN '#f59e0b'    -- Yellow/Orange
        WHEN sa.status = 'Cancelled' THEN '#6b7280'     -- Gray
        WHEN sa.status = 'Missed' THEN '#ef4444'        -- Red
        WHEN sa.scheduled_date < CAST(GETDATE() AS DATE) AND sa.status = 'Scheduled' THEN '#ef4444'  -- Overdue = Red
        WHEN sa.priority = 'Urgent' THEN '#f97316'      -- Urgent = Orange
        WHEN sa.priority = 'Follow-up' THEN '#8b5cf6'   -- Follow-up = Purple
        ELSE '#3b82f6'                                   -- Normal Scheduled = Blue
    END as color_code
FROM ScheduledAudits sa;
GO

PRINT 'Audit Calendar Schema created successfully!';
