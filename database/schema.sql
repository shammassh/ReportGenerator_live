-- =============================================
-- Food Safety Action Plan Database Schema
-- =============================================

-- Drop existing tables if they exist (for clean setup)
IF OBJECT_ID('ActionPlanAuditLog', 'U') IS NOT NULL DROP TABLE ActionPlanAuditLog;
IF OBJECT_ID('ActionPlanResponses', 'U') IS NOT NULL DROP TABLE ActionPlanResponses;

-- =============================================
-- Action Plan Responses Table
-- Stores store manager responses to audit findings
-- =============================================
CREATE TABLE ActionPlanResponses (
    ResponseID INT PRIMARY KEY IDENTITY(1,1),
    
    -- Link to SharePoint Audit
    DocumentNumber NVARCHAR(50) NOT NULL,
    ReferenceValue NVARCHAR(20),
    
    -- Audit Finding Details (from SharePoint)
    Section NVARCHAR(100),
    Finding NVARCHAR(MAX),
    SuggestedAction NVARCHAR(MAX),
    Priority NVARCHAR(20),
    
    -- Store Manager Response (editable fields)
    ActionTaken NVARCHAR(MAX),
    Deadline DATE,
    PersonInCharge NVARCHAR(100),
    Status NVARCHAR(50) DEFAULT 'Pending',
    
    -- Pictures/Evidence
    PicturesPaths NVARCHAR(MAX), -- JSON array of file paths
    
    -- Metadata
    CreatedDate DATETIME DEFAULT GETDATE(),
    CreatedBy NVARCHAR(100),
    UpdatedDate DATETIME DEFAULT GETDATE(),
    UpdatedBy NVARCHAR(100),
    
    -- Indexes for performance
    INDEX IX_DocumentNumber (DocumentNumber),
    INDEX IX_Status (Status),
    INDEX IX_Priority (Priority),
    INDEX IX_Deadline (Deadline)
);

-- =============================================
-- Audit Log Table
-- Tracks all changes to action plan responses
-- =============================================
CREATE TABLE ActionPlanAuditLog (
    AuditID INT PRIMARY KEY IDENTITY(1,1),
    ResponseID INT,
    Action NVARCHAR(50), -- 'INSERT', 'UPDATE', 'DELETE'
    FieldChanged NVARCHAR(100),
    OldValue NVARCHAR(MAX),
    NewValue NVARCHAR(MAX),
    ChangedBy NVARCHAR(100),
    ChangedDate DATETIME DEFAULT GETDATE(),
    
    FOREIGN KEY (ResponseID) REFERENCES ActionPlanResponses(ResponseID) ON DELETE CASCADE
);

-- =============================================
-- Stored Procedures
-- =============================================

-- Save or Update Action Plan Response
GO
CREATE PROCEDURE sp_SaveActionPlanResponse
    @DocumentNumber NVARCHAR(50),
    @ReferenceValue NVARCHAR(20),
    @Section NVARCHAR(100),
    @Finding NVARCHAR(MAX),
    @SuggestedAction NVARCHAR(MAX),
    @Priority NVARCHAR(20),
    @ActionTaken NVARCHAR(MAX),
    @Deadline DATE,
    @PersonInCharge NVARCHAR(100),
    @Status NVARCHAR(50),
    @PicturesPaths NVARCHAR(MAX),
    @UpdatedBy NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @ResponseID INT;
    DECLARE @OldActionTaken NVARCHAR(MAX);
    DECLARE @OldStatus NVARCHAR(50);
    
    -- Check if record exists
    SELECT @ResponseID = ResponseID, 
           @OldActionTaken = ActionTaken,
           @OldStatus = Status
    FROM ActionPlanResponses
    WHERE DocumentNumber = @DocumentNumber 
      AND ReferenceValue = @ReferenceValue;
    
    IF @ResponseID IS NULL
    BEGIN
        -- Insert new record
        INSERT INTO ActionPlanResponses (
            DocumentNumber, ReferenceValue, Section, Finding, 
            SuggestedAction, Priority, ActionTaken, Deadline, 
            PersonInCharge, Status, PicturesPaths, CreatedBy, UpdatedBy
        )
        VALUES (
            @DocumentNumber, @ReferenceValue, @Section, @Finding,
            @SuggestedAction, @Priority, @ActionTaken, @Deadline,
            @PersonInCharge, @Status, @PicturesPaths, @UpdatedBy, @UpdatedBy
        );
        
        SET @ResponseID = SCOPE_IDENTITY();
        
        -- Log insert
        INSERT INTO ActionPlanAuditLog (ResponseID, Action, FieldChanged, NewValue, ChangedBy)
        VALUES (@ResponseID, 'INSERT', 'ActionTaken', @ActionTaken, @UpdatedBy);
    END
    ELSE
    BEGIN
        -- Update existing record
        UPDATE ActionPlanResponses
        SET ActionTaken = @ActionTaken,
            Deadline = @Deadline,
            PersonInCharge = @PersonInCharge,
            Status = @Status,
            PicturesPaths = @PicturesPaths,
            UpdatedDate = GETDATE(),
            UpdatedBy = @UpdatedBy
        WHERE ResponseID = @ResponseID;
        
        -- Log changes
        IF @OldActionTaken != @ActionTaken
        BEGIN
            INSERT INTO ActionPlanAuditLog (ResponseID, Action, FieldChanged, OldValue, NewValue, ChangedBy)
            VALUES (@ResponseID, 'UPDATE', 'ActionTaken', @OldActionTaken, @ActionTaken, @UpdatedBy);
        END
        
        IF @OldStatus != @Status
        BEGIN
            INSERT INTO ActionPlanAuditLog (ResponseID, Action, FieldChanged, OldValue, NewValue, ChangedBy)
            VALUES (@ResponseID, 'UPDATE', 'Status', @OldStatus, @Status, @UpdatedBy);
        END
    END
    
    SELECT @ResponseID AS ResponseID;
END;
GO

-- Get Action Plan Responses for a Document
GO
CREATE PROCEDURE sp_GetActionPlanResponses
    @DocumentNumber NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        ResponseID,
        DocumentNumber,
        ReferenceValue,
        Section,
        Finding,
        SuggestedAction,
        Priority,
        ActionTaken,
        Deadline,
        PersonInCharge,
        Status,
        PicturesPaths,
        CreatedDate,
        CreatedBy,
        UpdatedDate,
        UpdatedBy
    FROM ActionPlanResponses
    WHERE DocumentNumber = @DocumentNumber
    ORDER BY 
        CASE Priority
            WHEN 'Critical' THEN 1
            WHEN 'High' THEN 2
            WHEN 'Medium' THEN 3
            WHEN 'Low' THEN 4
            ELSE 5
        END,
        ReferenceValue;
END;
GO

-- Get Summary Statistics
GO
CREATE PROCEDURE sp_GetActionPlanSummary
    @DocumentNumber NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        COUNT(*) AS TotalActions,
        SUM(CASE WHEN Priority = 'Critical' THEN 1 ELSE 0 END) AS CriticalCount,
        SUM(CASE WHEN Priority = 'High' THEN 1 ELSE 0 END) AS HighCount,
        SUM(CASE WHEN Priority = 'Medium' THEN 1 ELSE 0 END) AS MediumCount,
        SUM(CASE WHEN Priority = 'Low' THEN 1 ELSE 0 END) AS LowCount,
        SUM(CASE WHEN Status = 'Completed' THEN 1 ELSE 0 END) AS CompletedCount,
        SUM(CASE WHEN Status = 'In Progress' THEN 1 ELSE 0 END) AS InProgressCount,
        SUM(CASE WHEN Status = 'Pending' THEN 1 ELSE 0 END) AS PendingCount
    FROM ActionPlanResponses
    WHERE DocumentNumber = @DocumentNumber;
END;
GO

-- =============================================
-- Initial Data / Test Data (Optional)
-- =============================================
-- Uncomment to insert test data
/*
INSERT INTO ActionPlanResponses (DocumentNumber, ReferenceValue, Section, Finding, SuggestedAction, Priority, CreatedBy, UpdatedBy)
VALUES 
('GMRL-FSACR-0001', '1.1', 'Food Storage', 'Expired items found in dry storage', 'Remove all expired items and implement FIFO system', 'High', 'System', 'System'),
('GMRL-FSACR-0001', '2.26', 'Fridges and Freezers', 'Temperature not within safe range', 'Adjust thermostat and monitor temperature', 'Critical', 'System', 'System');
*/

PRINT 'Database schema created successfully!';
PRINT 'Tables created: ActionPlanResponses, ActionPlanAuditLog';
PRINT 'Stored procedures created: sp_SaveActionPlanResponse, sp_GetActionPlanResponses, sp_GetActionPlanSummary';
