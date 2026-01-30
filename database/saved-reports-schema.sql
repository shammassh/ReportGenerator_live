-- =============================================
-- Saved Reports Table
-- Stores generated reports for tracking and management
-- =============================================
-- Run this script on FoodSafetyDB database

USE FoodSafetyDB;
GO

-- =============================================
-- Table: SavedReports
-- Stores saved audit reports with full data
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SavedReports')
BEGIN
    CREATE TABLE SavedReports (
        id INT PRIMARY KEY IDENTITY(1,1),
        
        -- Report Info
        document_number NVARCHAR(50) NOT NULL,
        report_type NVARCHAR(50) DEFAULT 'Enhanced HTML',     -- 'Enhanced HTML', 'Action Plan', 'Department Followup'
        file_path NVARCHAR(500),                              -- Path to the generated HTML file
        
        -- User Info
        saved_by_user_id INT FOREIGN KEY REFERENCES Users(id),
        saved_by_email NVARCHAR(255) NOT NULL,
        saved_by_name NVARCHAR(255),
        
        -- Report Data (JSON)
        report_data NVARCHAR(MAX),                            -- Full JSON with all report details
        
        -- Scores
        overall_score DECIMAL(5,2),
        store_name NVARCHAR(255),
        audit_date DATE,
        
        -- Status
        status NVARCHAR(50) DEFAULT 'Saved',                  -- 'Saved', 'Reviewed', 'Approved', 'Archived'
        
        -- Timestamps
        saved_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
    );
    
    PRINT '✅ Table SavedReports created successfully';
END
ELSE
BEGIN
    PRINT '✓ Table SavedReports already exists';
END
GO

-- Create indexes for performance
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_saved_reports_document' AND object_id = OBJECT_ID('SavedReports'))
BEGIN
    CREATE INDEX idx_saved_reports_document ON SavedReports(document_number);
    PRINT '✅ Index idx_saved_reports_document created';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_saved_reports_user' AND object_id = OBJECT_ID('SavedReports'))
BEGIN
    CREATE INDEX idx_saved_reports_user ON SavedReports(saved_by_user_id);
    PRINT '✅ Index idx_saved_reports_user created';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_saved_reports_date' AND object_id = OBJECT_ID('SavedReports'))
BEGIN
    CREATE INDEX idx_saved_reports_date ON SavedReports(saved_at);
    PRINT '✅ Index idx_saved_reports_date created';
END
GO

PRINT '';
PRINT '╔════════════════════════════════════════════════════════════╗';
PRINT '║   SavedReports Table Setup Complete                        ║';
PRINT '╚════════════════════════════════════════════════════════════╝';
PRINT '';
PRINT '✅ Table created with fields:';
PRINT '   • document_number, report_type, file_path';
PRINT '   • saved_by_user_id, saved_by_email, saved_by_name';
PRINT '   • report_data (JSON)';
PRINT '   • overall_score, store_name, audit_date';
PRINT '   • status, saved_at, updated_at';
PRINT '';
PRINT '✅ Indexes created for performance';
PRINT '';
