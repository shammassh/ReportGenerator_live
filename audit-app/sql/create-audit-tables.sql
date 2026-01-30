-- =============================================
-- Audit App Database Schema
-- Creates tables for audit instances and responses
-- =============================================

USE FoodSafetyDB;
GO

-- =============================================
-- Table: AuditInstances
-- Stores audit header information
-- =============================================
IF OBJECT_ID('dbo.AuditInstances', 'U') IS NULL
BEGIN
    CREATE TABLE AuditInstances (
        AuditID INT IDENTITY(1,1) PRIMARY KEY,
        DocumentNumber NVARCHAR(50) NOT NULL UNIQUE,
        StoreID INT NOT NULL,
        StoreCode NVARCHAR(50) NOT NULL,
        StoreName NVARCHAR(200) NOT NULL,
        SchemaID INT NOT NULL,
        AuditDate DATE NOT NULL,
        TimeIn NVARCHAR(10),
        TimeOut NVARCHAR(10),
        Cycle NVARCHAR(10) NOT NULL,          -- C1, C2, C3, C4, C5, C6
        Year INT NOT NULL,
        Auditors NVARCHAR(500) NOT NULL,
        AccompaniedBy NVARCHAR(500),
        Status NVARCHAR(50) DEFAULT 'In Progress',  -- In Progress, Completed, Submitted
        TotalScore FLOAT,
        CreatedBy NVARCHAR(200),
        CreatedAt DATETIME DEFAULT GETDATE(),
        CompletedAt DATETIME,
        CONSTRAINT FK_AuditInstances_Store FOREIGN KEY (StoreID) REFERENCES Stores(StoreID),
        CONSTRAINT FK_AuditInstances_Schema FOREIGN KEY (SchemaID) REFERENCES AuditSchemas(SchemaID)
    );

    CREATE INDEX IX_AuditInstances_DocumentNumber ON AuditInstances(DocumentNumber);
    CREATE INDEX IX_AuditInstances_StoreID ON AuditInstances(StoreID);
    CREATE INDEX IX_AuditInstances_Status ON AuditInstances(Status);
    CREATE INDEX IX_AuditInstances_Cycle_Year ON AuditInstances(Cycle, Year);

    PRINT 'Created table: AuditInstances';
END
ELSE
BEGIN
    PRINT 'Table AuditInstances already exists';
END
GO

-- =============================================
-- Table: AuditResponses
-- Stores individual audit item responses
-- =============================================
IF OBJECT_ID('dbo.AuditResponses', 'U') IS NULL
BEGIN
    CREATE TABLE AuditResponses (
        ResponseID INT IDENTITY(1,1) PRIMARY KEY,
        AuditID INT NOT NULL,
        SectionID INT NOT NULL,
        SectionNumber INT NOT NULL,
        SectionName NVARCHAR(200) NOT NULL,
        ItemID INT NOT NULL,
        ReferenceValue NVARCHAR(50),
        Title NVARCHAR(1000) NOT NULL,
        Coeff INT DEFAULT 2,
        AnswerOptions NVARCHAR(200),          -- e.g., "Yes,Partially,No,NA"
        CR NVARCHAR(2000),                     -- Criterion/Requirement
        SelectedChoice NVARCHAR(20),           -- The selected answer
        Value FLOAT,                           -- Calculated score value
        Finding NVARCHAR(2000),
        Comment NVARCHAR(2000),
        CorrectiveAction NVARCHAR(2000),
        Priority NVARCHAR(20),                 -- High, Medium, Low
        HasPicture BIT DEFAULT 0,
        Escalate BIT DEFAULT 0,                -- Escalate to department
        Department NVARCHAR(200),              -- Assigned department(s)
        UpdatedAt DATETIME,
        CONSTRAINT FK_AuditResponses_Audit FOREIGN KEY (AuditID) REFERENCES AuditInstances(AuditID) ON DELETE CASCADE,
        CONSTRAINT FK_AuditResponses_Section FOREIGN KEY (SectionID) REFERENCES AuditSections(SectionID),
        CONSTRAINT FK_AuditResponses_Item FOREIGN KEY (ItemID) REFERENCES AuditItems(ItemID)
    );

    CREATE INDEX IX_AuditResponses_AuditID ON AuditResponses(AuditID);
    CREATE INDEX IX_AuditResponses_SectionID ON AuditResponses(SectionID);

    PRINT 'Created table: AuditResponses';
END
ELSE
BEGIN
    PRINT 'Table AuditResponses already exists';
END
GO

-- =============================================
-- Table: AuditPictures
-- Stores pictures associated with audit responses
-- =============================================
IF OBJECT_ID('dbo.AuditPictures', 'U') IS NULL
BEGIN
    CREATE TABLE AuditPictures (
        PictureID INT IDENTITY(1,1) PRIMARY KEY,
        ResponseID INT NOT NULL,
        AuditID INT NOT NULL,
        FileName NVARCHAR(255),
        FileData VARBINARY(MAX),               -- Store image binary or use external storage
        ContentType NVARCHAR(100),
        CreatedAt DATETIME DEFAULT GETDATE(),
        CONSTRAINT FK_AuditPictures_Response FOREIGN KEY (ResponseID) REFERENCES AuditResponses(ResponseID) ON DELETE CASCADE
    );

    CREATE INDEX IX_AuditPictures_ResponseID ON AuditPictures(ResponseID);
    CREATE INDEX IX_AuditPictures_AuditID ON AuditPictures(AuditID);

    PRINT 'Created table: AuditPictures';
END
ELSE
BEGIN
    PRINT 'Table AuditPictures already exists';
END
GO

PRINT 'Audit App database schema setup complete!';
