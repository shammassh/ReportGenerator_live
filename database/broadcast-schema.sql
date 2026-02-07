-- Broadcast Feature Schema
-- Run this script to create the broadcast tables

-- =============================================
-- Table: Broadcasts (the message itself)
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Broadcasts')
BEGIN
    CREATE TABLE Broadcasts (
        id INT PRIMARY KEY IDENTITY(1,1),
        
        -- Broadcast content
        title NVARCHAR(255) NOT NULL,
        message NVARCHAR(MAX) NOT NULL,
        broadcast_type NVARCHAR(50) NOT NULL DEFAULT 'Announcement', -- 'Announcement', 'Reminder', 'Urgent'
        
        -- Target audience
        target_roles NVARCHAR(500), -- Comma-separated roles: 'StoreManager,Auditor,DepartmentHead'
        
        -- Sender info
        sent_by_user_id INT,
        sent_by_name NVARCHAR(255),
        sent_by_email NVARCHAR(255),
        
        -- Status
        status NVARCHAR(50) DEFAULT 'Sent', -- 'Draft', 'Sent', 'Failed'
        recipient_count INT DEFAULT 0,
        email_sent_count INT DEFAULT 0,
        
        -- Timestamps
        created_at DATETIME DEFAULT GETDATE(),
        sent_at DATETIME
    );
    
    PRINT 'Created Broadcasts table';
END
GO

-- =============================================
-- Table: BroadcastRecipients (who received it)
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'BroadcastRecipients')
BEGIN
    CREATE TABLE BroadcastRecipients (
        id INT PRIMARY KEY IDENTITY(1,1),
        
        -- Reference to broadcast
        broadcast_id INT NOT NULL,
        
        -- Recipient info
        user_id INT NOT NULL,
        user_email NVARCHAR(255),
        user_name NVARCHAR(255),
        user_role NVARCHAR(50),
        
        -- Email delivery status
        email_sent BIT DEFAULT 0,
        email_sent_at DATETIME,
        email_error NVARCHAR(MAX),
        
        -- In-app notification status
        read_at DATETIME,
        dismissed_at DATETIME,
        
        -- Timestamps
        created_at DATETIME DEFAULT GETDATE(),
        
        -- Foreign key to Broadcasts only
        FOREIGN KEY (broadcast_id) REFERENCES Broadcasts(id) ON DELETE CASCADE
    );
    
    -- Index for faster queries
    CREATE INDEX IX_BroadcastRecipients_UserId ON BroadcastRecipients(user_id);
    CREATE INDEX IX_BroadcastRecipients_BroadcastId ON BroadcastRecipients(broadcast_id);
    CREATE INDEX IX_BroadcastRecipients_Unread ON BroadcastRecipients(user_id, read_at) WHERE read_at IS NULL;
    
    PRINT 'Created BroadcastRecipients table';
END
GO

-- =============================================
-- View: Unread broadcasts per user
-- =============================================
IF EXISTS (SELECT * FROM sys.views WHERE name = 'vw_UnreadBroadcasts')
    DROP VIEW vw_UnreadBroadcasts;
GO

CREATE VIEW vw_UnreadBroadcasts AS
SELECT 
    br.user_id,
    COUNT(*) as unread_count
FROM BroadcastRecipients br
WHERE br.read_at IS NULL 
  AND br.dismissed_at IS NULL
GROUP BY br.user_id;
GO

PRINT 'Created vw_UnreadBroadcasts view';
GO
