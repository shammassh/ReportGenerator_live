-- =============================================
-- Migration: Add Brand column and HeadOfOperations/AreaManager support
-- Run this script on both FoodSafetyDB and FoodSafetyDB_Live
-- Date: 2026-01-30
-- =============================================

USE FoodSafetyDB;
GO

-- =============================================
-- 1. Add Brand column to Stores table
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Stores') AND name = 'Brand')
BEGIN
    ALTER TABLE Stores ADD Brand NVARCHAR(50) NULL;
    PRINT '✅ Added Brand column to Stores table';
END
ELSE
BEGIN
    PRINT '✓ Brand column already exists';
END
GO

-- Auto-detect brand from store name
UPDATE Stores 
SET Brand = CASE 
    WHEN StoreName LIKE '%Spinneys%' THEN 'Spinneys'
    WHEN StoreName LIKE '%Happy%' THEN 'Happy'
    WHEN StoreName LIKE '%GNG%' OR StoreName LIKE '%Grab%' OR StoreName LIKE '%G&G%' THEN 'GNG'
    ELSE 'Spinneys'  -- Default
END
WHERE Brand IS NULL;
PRINT '✅ Updated Brand values for existing stores';
GO

-- =============================================
-- 2. Create UserBrandAssignments table (for HeadOfOperations)
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'UserBrandAssignments')
BEGIN
    CREATE TABLE UserBrandAssignments (
        ID INT PRIMARY KEY IDENTITY(1,1),
        UserID INT NOT NULL FOREIGN KEY REFERENCES Users(ID) ON DELETE CASCADE,
        Brand NVARCHAR(50) NOT NULL,  -- 'Spinneys', 'Happy', 'GNG'
        CreatedAt DATETIME DEFAULT GETDATE(),
        CreatedBy NVARCHAR(255),
        
        CONSTRAINT UQ_UserBrandAssignment UNIQUE(UserID, Brand)
    );
    
    CREATE INDEX idx_userbrand_userid ON UserBrandAssignments(UserID);
    CREATE INDEX idx_userbrand_brand ON UserBrandAssignments(Brand);
    
    PRINT '✅ Table UserBrandAssignments created successfully';
END
ELSE
BEGIN
    PRINT '✓ Table UserBrandAssignments already exists';
END
GO

-- =============================================
-- 3. Create UserAreaAssignments table (for AreaManager specific store assignments)
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'UserAreaAssignments')
BEGIN
    CREATE TABLE UserAreaAssignments (
        ID INT PRIMARY KEY IDENTITY(1,1),
        UserID INT NOT NULL FOREIGN KEY REFERENCES Users(ID) ON DELETE CASCADE,
        StoreID INT NOT NULL FOREIGN KEY REFERENCES Stores(StoreID) ON DELETE CASCADE,
        CreatedAt DATETIME DEFAULT GETDATE(),
        CreatedBy NVARCHAR(255),
        
        CONSTRAINT UQ_UserAreaAssignment UNIQUE(UserID, StoreID)
    );
    
    CREATE INDEX idx_userarea_userid ON UserAreaAssignments(UserID);
    CREATE INDEX idx_userarea_storeid ON UserAreaAssignments(StoreID);
    
    PRINT '✅ Table UserAreaAssignments created successfully';
END
ELSE
BEGIN
    PRINT '✓ Table UserAreaAssignments already exists';
END
GO

PRINT '';
PRINT '==========================================';
PRINT '✅ Migration complete!';
PRINT '==========================================';
GO
