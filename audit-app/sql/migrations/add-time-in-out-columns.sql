-- =============================================
-- Migration: Add TimeIn and TimeOut columns
-- Replace AuditTime with TimeIn and TimeOut
-- Date: 2025-01-22
-- =============================================

-- Step 1: Add new columns
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AuditInstances') AND name = 'TimeIn')
BEGIN
    ALTER TABLE AuditInstances ADD TimeIn NVARCHAR(10);
    PRINT 'Added column: TimeIn';
END
ELSE
BEGIN
    PRINT 'Column TimeIn already exists';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AuditInstances') AND name = 'TimeOut')
BEGIN
    ALTER TABLE AuditInstances ADD TimeOut NVARCHAR(10);
    PRINT 'Added column: TimeOut';
END
ELSE
BEGIN
    PRINT 'Column TimeOut already exists';
END
GO

-- Step 2: Migrate existing AuditTime data to TimeIn (if AuditTime column exists)
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AuditInstances') AND name = 'AuditTime')
BEGIN
    UPDATE AuditInstances SET TimeIn = AuditTime WHERE TimeIn IS NULL AND AuditTime IS NOT NULL;
    PRINT 'Migrated AuditTime data to TimeIn';
END
GO

-- Step 3: Optional - Drop old AuditTime column after verifying data migration
-- Uncomment the following after confirming migration success:
/*
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AuditInstances') AND name = 'AuditTime')
BEGIN
    ALTER TABLE AuditInstances DROP COLUMN AuditTime;
    PRINT 'Dropped column: AuditTime';
END
GO
*/

-- Verify the changes
SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'AuditInstances' 
AND COLUMN_NAME IN ('AuditTime', 'TimeIn', 'TimeOut')
ORDER BY COLUMN_NAME;
