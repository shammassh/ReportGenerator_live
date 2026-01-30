-- =============================================
-- Category Management Tables
-- For grouping sections into categories for reports
-- =============================================

USE FoodSafetyDB;
GO

-- =============================================
-- Table: AuditCategories
-- Stores category definitions
-- =============================================
IF OBJECT_ID('dbo.AuditCategories', 'U') IS NULL
BEGIN
    CREATE TABLE AuditCategories (
        CategoryID INT IDENTITY(1,1) PRIMARY KEY,
        CategoryName NVARCHAR(200) NOT NULL,
        DisplayOrder INT DEFAULT 0,
        SchemaID INT NOT NULL,                -- Categories are schema-specific
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME,
        CONSTRAINT FK_AuditCategories_Schema FOREIGN KEY (SchemaID) REFERENCES AuditSchemas(SchemaID)
    );

    CREATE INDEX IX_AuditCategories_SchemaID ON AuditCategories(SchemaID);
    CREATE INDEX IX_AuditCategories_DisplayOrder ON AuditCategories(DisplayOrder);

    PRINT 'Created table: AuditCategories';
END
ELSE
BEGIN
    PRINT 'Table AuditCategories already exists';
END
GO

-- =============================================
-- Table: CategorySections
-- Maps sections to categories
-- =============================================
IF OBJECT_ID('dbo.CategorySections', 'U') IS NULL
BEGIN
    CREATE TABLE CategorySections (
        CategorySectionID INT IDENTITY(1,1) PRIMARY KEY,
        CategoryID INT NOT NULL,
        SectionID INT NOT NULL,
        DisplayOrder INT DEFAULT 0,
        CONSTRAINT FK_CategorySections_Category FOREIGN KEY (CategoryID) REFERENCES AuditCategories(CategoryID) ON DELETE CASCADE,
        CONSTRAINT FK_CategorySections_Section FOREIGN KEY (SectionID) REFERENCES AuditSections(SectionID),
        CONSTRAINT UQ_CategorySection UNIQUE (CategoryID, SectionID)
    );

    CREATE INDEX IX_CategorySections_CategoryID ON CategorySections(CategoryID);
    CREATE INDEX IX_CategorySections_SectionID ON CategorySections(SectionID);

    PRINT 'Created table: CategorySections';
END
ELSE
BEGIN
    PRINT 'Table CategorySections already exists';
END
GO

PRINT 'Category tables created successfully!';
