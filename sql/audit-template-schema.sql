-- =====================================================
-- AUDIT TEMPLATE MANAGEMENT SYSTEM
-- Database Schema with Proper Relationships
-- =====================================================

-- 1. SCHEMAS TABLE (Audit Types)
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AuditSchemas')
BEGIN
    CREATE TABLE AuditSchemas (
        SchemaID INT IDENTITY(1,1) PRIMARY KEY,
        SchemaName NVARCHAR(100) NOT NULL UNIQUE,
        Description NVARCHAR(500),
        IsActive BIT DEFAULT 1,
        CreatedBy NVARCHAR(255),
        CreatedDate DATETIME DEFAULT GETDATE(),
        ModifiedBy NVARCHAR(255),
        ModifiedDate DATETIME
    );
    PRINT '✅ Created AuditSchemas table';
END
ELSE
    PRINT '⚠️ AuditSchemas table already exists';
GO

-- 2. SECTIONS TABLE (Categories within a Schema)
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AuditSections')
BEGIN
    CREATE TABLE AuditSections (
        SectionID INT IDENTITY(1,1) PRIMARY KEY,
        SchemaID INT NOT NULL,
        SectionNumber INT NOT NULL,
        SectionName NVARCHAR(200) NOT NULL,
        SectionIcon NVARCHAR(10) DEFAULT '📋',
        IsActive BIT DEFAULT 1,
        CreatedBy NVARCHAR(255),
        CreatedDate DATETIME DEFAULT GETDATE(),
        ModifiedBy NVARCHAR(255),
        ModifiedDate DATETIME,
        
        -- Foreign Key to Schema
        CONSTRAINT FK_AuditSections_Schema FOREIGN KEY (SchemaID) 
            REFERENCES AuditSchemas(SchemaID) ON DELETE CASCADE,
        
        -- Unique section number per schema
        CONSTRAINT UQ_Section_Per_Schema UNIQUE (SchemaID, SectionNumber)
    );
    
    -- Index for faster lookups
    CREATE INDEX IX_AuditSections_SchemaID ON AuditSections(SchemaID);
    
    PRINT '✅ Created AuditSections table';
END
ELSE
    PRINT '⚠️ AuditSections table already exists';
GO

-- 3. ITEMS TABLE (Questions within a Section)
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AuditItems')
BEGIN
    CREATE TABLE AuditItems (
        ItemID INT IDENTITY(1,1) PRIMARY KEY,
        SectionID INT NOT NULL,
        ReferenceValue NVARCHAR(20) NOT NULL,
        Title NVARCHAR(1000) NOT NULL,
        Coeff INT NOT NULL DEFAULT 2,
        Answer NVARCHAR(100) NOT NULL DEFAULT 'Yes,Partially,No,NA',
        CR NVARCHAR(2000),
        SortOrder INT DEFAULT 0,
        IsActive BIT DEFAULT 1,
        CreatedBy NVARCHAR(255),
        CreatedDate DATETIME DEFAULT GETDATE(),
        ModifiedBy NVARCHAR(255),
        ModifiedDate DATETIME,
        
        -- Foreign Key to Section
        CONSTRAINT FK_AuditItems_Section FOREIGN KEY (SectionID) 
            REFERENCES AuditSections(SectionID) ON DELETE CASCADE,
        
        -- Unique reference value per section
        CONSTRAINT UQ_RefValue_Per_Section UNIQUE (SectionID, ReferenceValue)
    );
    
    -- Index for faster lookups
    CREATE INDEX IX_AuditItems_SectionID ON AuditItems(SectionID);
    
    PRINT '✅ Created AuditItems table';
END
ELSE
    PRINT '⚠️ AuditItems table already exists';
GO

-- =====================================================
-- STORED PROCEDURES
-- =====================================================

-- SP: Get all schemas
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetAllSchemas')
    DROP PROCEDURE sp_GetAllSchemas;
GO

CREATE PROCEDURE sp_GetAllSchemas
    @ActiveOnly BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        SchemaID,
        SchemaName,
        Description,
        IsActive,
        CreatedBy,
        CreatedDate,
        (SELECT COUNT(*) FROM AuditSections WHERE SchemaID = s.SchemaID) AS SectionCount
    FROM AuditSchemas s
    WHERE (@ActiveOnly = 0 OR IsActive = 1)
    ORDER BY SchemaName;
END
GO
PRINT '✅ Created sp_GetAllSchemas';
GO

-- SP: Create schema
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_CreateSchema')
    DROP PROCEDURE sp_CreateSchema;
GO

CREATE PROCEDURE sp_CreateSchema
    @SchemaName NVARCHAR(100),
    @Description NVARCHAR(500),
    @CreatedBy NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;
    
    INSERT INTO AuditSchemas (SchemaName, Description, CreatedBy)
    VALUES (@SchemaName, @Description, @CreatedBy);
    
    SELECT SCOPE_IDENTITY() AS SchemaID;
END
GO
PRINT '✅ Created sp_CreateSchema';
GO

-- SP: Get sections by schema
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetSectionsBySchema')
    DROP PROCEDURE sp_GetSectionsBySchema;
GO

CREATE PROCEDURE sp_GetSectionsBySchema
    @SchemaID INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        s.SectionID,
        s.SchemaID,
        s.SectionNumber,
        s.SectionName,
        s.SectionIcon,
        s.IsActive,
        s.CreatedBy,
        s.CreatedDate,
        (SELECT COUNT(*) FROM AuditItems WHERE SectionID = s.SectionID AND IsActive = 1) AS ItemCount
    FROM AuditSections s
    WHERE s.SchemaID = @SchemaID AND s.IsActive = 1
    ORDER BY s.SectionNumber;
END
GO
PRINT '✅ Created sp_GetSectionsBySchema';
GO

-- SP: Create section
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_CreateSection')
    DROP PROCEDURE sp_CreateSection;
GO

CREATE PROCEDURE sp_CreateSection
    @SchemaID INT,
    @SectionNumber INT,
    @SectionName NVARCHAR(200),
    @SectionIcon NVARCHAR(10) = '📋',
    @CreatedBy NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;
    
    INSERT INTO AuditSections (SchemaID, SectionNumber, SectionName, SectionIcon, CreatedBy)
    VALUES (@SchemaID, @SectionNumber, @SectionName, @SectionIcon, @CreatedBy);
    
    SELECT SCOPE_IDENTITY() AS SectionID;
END
GO
PRINT '✅ Created sp_CreateSection';
GO

-- SP: Get items by section
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetItemsBySection')
    DROP PROCEDURE sp_GetItemsBySection;
GO

CREATE PROCEDURE sp_GetItemsBySection
    @SectionID INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        ItemID,
        SectionID,
        ReferenceValue,
        Title,
        Coeff,
        Answer,
        CR,
        SortOrder,
        IsActive,
        CreatedBy,
        CreatedDate
    FROM AuditItems
    WHERE SectionID = @SectionID AND IsActive = 1
    ORDER BY SortOrder, ReferenceValue;
END
GO
PRINT '✅ Created sp_GetItemsBySection';
GO

-- SP: Create item
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_CreateItem')
    DROP PROCEDURE sp_CreateItem;
GO

CREATE PROCEDURE sp_CreateItem
    @SectionID INT,
    @ReferenceValue NVARCHAR(20),
    @Title NVARCHAR(1000),
    @Coeff INT,
    @Answer NVARCHAR(100),
    @CR NVARCHAR(2000),
    @CreatedBy NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Get next sort order
    DECLARE @SortOrder INT;
    SELECT @SortOrder = ISNULL(MAX(SortOrder), 0) + 1 FROM AuditItems WHERE SectionID = @SectionID;
    
    INSERT INTO AuditItems (SectionID, ReferenceValue, Title, Coeff, Answer, CR, SortOrder, CreatedBy)
    VALUES (@SectionID, @ReferenceValue, @Title, @Coeff, @Answer, @CR, @SortOrder, @CreatedBy);
    
    SELECT SCOPE_IDENTITY() AS ItemID;
END
GO
PRINT '✅ Created sp_CreateItem';
GO

-- SP: Update item
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_UpdateItem')
    DROP PROCEDURE sp_UpdateItem;
GO

CREATE PROCEDURE sp_UpdateItem
    @ItemID INT,
    @ReferenceValue NVARCHAR(20),
    @Title NVARCHAR(1000),
    @Coeff INT,
    @Answer NVARCHAR(100),
    @CR NVARCHAR(2000),
    @ModifiedBy NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE AuditItems
    SET ReferenceValue = @ReferenceValue,
        Title = @Title,
        Coeff = @Coeff,
        Answer = @Answer,
        CR = @CR,
        ModifiedBy = @ModifiedBy,
        ModifiedDate = GETDATE()
    WHERE ItemID = @ItemID;
    
    SELECT @@ROWCOUNT AS RowsAffected;
END
GO
PRINT '✅ Created sp_UpdateItem';
GO

-- SP: Delete item (soft delete)
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_DeleteItem')
    DROP PROCEDURE sp_DeleteItem;
GO

CREATE PROCEDURE sp_DeleteItem
    @ItemID INT
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE AuditItems SET IsActive = 0 WHERE ItemID = @ItemID;
    SELECT @@ROWCOUNT AS RowsAffected;
END
GO
PRINT '✅ Created sp_DeleteItem';
GO

-- SP: Get full schema with sections and items
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetFullSchema')
    DROP PROCEDURE sp_GetFullSchema;
GO

CREATE PROCEDURE sp_GetFullSchema
    @SchemaID INT
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Return schema info
    SELECT 
        SchemaID,
        SchemaName,
        Description,
        IsActive,
        CreatedBy,
        CreatedDate
    FROM AuditSchemas
    WHERE SchemaID = @SchemaID;
    
    -- Return sections
    SELECT 
        SectionID,
        SchemaID,
        SectionNumber,
        SectionName,
        SectionIcon,
        IsActive
    FROM AuditSections
    WHERE SchemaID = @SchemaID AND IsActive = 1
    ORDER BY SectionNumber;
    
    -- Return all items for all sections in this schema
    SELECT 
        i.ItemID,
        i.SectionID,
        i.ReferenceValue,
        i.Title,
        i.Coeff,
        i.Answer,
        i.CR,
        i.SortOrder
    FROM AuditItems i
    INNER JOIN AuditSections s ON i.SectionID = s.SectionID
    WHERE s.SchemaID = @SchemaID AND i.IsActive = 1 AND s.IsActive = 1
    ORDER BY s.SectionNumber, i.SortOrder, i.ReferenceValue;
END
GO
PRINT '✅ Created sp_GetFullSchema';
GO

PRINT '';
PRINT '=====================================================';
PRINT '✅ ALL TABLES AND STORED PROCEDURES CREATED!';
PRINT '=====================================================';
PRINT '';
PRINT 'Tables:';
PRINT '  - AuditSchemas (audit types)';
PRINT '  - AuditSections (categories per schema)';
PRINT '  - AuditItems (questions per section)';
PRINT '';
PRINT 'Relationships:';
PRINT '  - Schema (1) → Sections (many)';
PRINT '  - Section (1) → Items (many)';
PRINT '';
GO
