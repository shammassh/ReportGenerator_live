-- =============================================
-- Action Plan Escalation Settings Table
-- Stores configuration for automatic escalation workflow
-- =============================================

USE FoodSafetyDB_Live;
GO

-- =============================================
-- Table: ActionPlanEscalationSettings
-- Single row table for global escalation settings
-- =============================================
IF OBJECT_ID('dbo.ActionPlanEscalationSettings', 'U') IS NULL
BEGIN
    CREATE TABLE ActionPlanEscalationSettings (
        SettingID INT IDENTITY(1,1) PRIMARY KEY,
        DeadlineDays INT NOT NULL DEFAULT 7,                    -- Days to complete action plan
        ReminderDaysBefore NVARCHAR(100) DEFAULT '3,1',         -- Comma-separated days before deadline
        AutoEscalationEnabled BIT DEFAULT 1,                    -- Enable auto-escalation to Area Manager
        EmailNotificationsEnabled BIT DEFAULT 1,                -- Send email notifications
        EscalationRecipients NVARCHAR(500) DEFAULT 'AreaManager', -- Who receives escalation (AreaManager, Admin, etc.)
        GracePeriodHours INT DEFAULT 24,                        -- Grace period after deadline before escalation
        MaxReminders INT DEFAULT 3,                             -- Maximum number of reminders to send
        CreatedAt DATETIME DEFAULT GETDATE(),
        ModifiedAt DATETIME DEFAULT GETDATE(),
        ModifiedBy NVARCHAR(200)
    );

    -- Insert default settings
    INSERT INTO ActionPlanEscalationSettings (
        DeadlineDays, 
        ReminderDaysBefore, 
        AutoEscalationEnabled, 
        EmailNotificationsEnabled,
        EscalationRecipients,
        GracePeriodHours,
        MaxReminders
    ) VALUES (
        7,
        '3,1',
        1,
        1,
        'AreaManager',
        24,
        3
    );

    PRINT 'Created table: ActionPlanEscalationSettings with default values';
END
ELSE
BEGIN
    PRINT 'Table ActionPlanEscalationSettings already exists';
END
GO

-- =============================================
-- Table: ActionPlanEscalationLog
-- Tracks escalation events for auditing
-- =============================================
IF OBJECT_ID('dbo.ActionPlanEscalationLog', 'U') IS NULL
BEGIN
    CREATE TABLE ActionPlanEscalationLog (
        LogID INT IDENTITY(1,1) PRIMARY KEY,
        AuditID INT NOT NULL,
        DocumentNumber NVARCHAR(50),
        EventType NVARCHAR(50) NOT NULL,        -- 'Reminder', 'Escalation', 'Deadline'
        EventDate DATETIME DEFAULT GETDATE(),
        RecipientEmail NVARCHAR(200),
        RecipientName NVARCHAR(200),
        DaysOverdue INT,
        Status NVARCHAR(50),                    -- 'Sent', 'Failed', 'Pending'
        ErrorMessage NVARCHAR(1000),
        CreatedAt DATETIME DEFAULT GETDATE()
    );

    CREATE INDEX IX_EscalationLog_AuditID ON ActionPlanEscalationLog(AuditID);
    CREATE INDEX IX_EscalationLog_EventDate ON ActionPlanEscalationLog(EventDate);
    CREATE INDEX IX_EscalationLog_EventType ON ActionPlanEscalationLog(EventType);

    PRINT 'Created table: ActionPlanEscalationLog';
END
ELSE
BEGIN
    PRINT 'Table ActionPlanEscalationLog already exists';
END
GO

-- =============================================
-- Add EscalationSettings button to MenuPermissions
-- =============================================
IF NOT EXISTS (SELECT 1 FROM MenuPermissions WHERE ButtonID = 'escalationSettingsBtn')
BEGIN
    INSERT INTO MenuPermissions (
        ButtonID, ButtonName, Category, Icon, Url, ActionType, 
        AllowedRoles, EditRoles, IsEnabled, SortOrder
    ) VALUES (
        'escalationSettingsBtn',
        'Escalation Settings',
        'System Administration',
        '⏰',
        '/admin/escalation-settings',
        'Page',
        'Admin,SuperAuditor',
        'Admin',
        1,
        50
    );
    PRINT 'Added escalationSettingsBtn to MenuPermissions';
END
GO

PRINT 'Action Plan Escalation Settings schema setup complete!';
