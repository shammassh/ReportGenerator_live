USE FoodSafetyDB_Live;
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetAllStores') DROP PROCEDURE sp_GetAllStores;
GO
-- Stored Procedure: Get All Stores with Schema info
CREATE   PROCEDURE sp_GetAllStores
AS
BEGIN
    SELECT 
        s.StoreID,
        s.StoreCode,
        s.StoreName,
        s.Location,
        s.SchemaID,
        a.SchemaName,
        s.IsActive,
GO
PRINT 'Created sp_GetAllStores';
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetActiveStores') DROP PROCEDURE sp_GetActiveStores;
GO
-- Stored Procedure: Get Active Stores only
CREATE   PROCEDURE sp_GetActiveStores
AS
BEGIN
    SELECT 
        s.StoreID,
        s.StoreCode,
        s.StoreName,
        s.Location,
        s.SchemaID,
        a.SchemaName,
        s.IsActive
    FROM S
GO
PRINT 'Created sp_GetActiveStores';
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_CreateStore') DROP PROCEDURE sp_CreateStore;
GO
-- Stored Procedure: Create Store
CREATE   PROCEDURE sp_CreateStore
    @StoreCode NVARCHAR(50),
    @StoreName NVARCHAR(200),
    @Location NVARCHAR(500),
    @SchemaID INT,
    @CreatedBy NVARCHAR(200)
AS
BEGIN
    INSERT INTO Stores (StoreCode, StoreNa
GO
PRINT 'Created sp_CreateStore';
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_UpdateStore') DROP PROCEDURE sp_UpdateStore;
GO
-- Stored Procedure: Update Store
CREATE   PROCEDURE sp_UpdateStore
    @StoreID INT,
    @StoreCode NVARCHAR(50),
    @StoreName NVARCHAR(200),
    @Location NVARCHAR(500),
    @SchemaID INT,
    @IsActive BIT
AS
BEGIN
    UPDATE Stores
    SET StoreCode
GO
PRINT 'Created sp_UpdateStore';
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_DeleteStore') DROP PROCEDURE sp_DeleteStore;
GO
-- Stored Procedure: Delete Store
CREATE   PROCEDURE sp_DeleteStore
    @StoreID INT
AS
BEGIN
    DELETE FROM Stores WHERE StoreID = @StoreID;
END;
GO
PRINT 'Created sp_DeleteStore';
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetAllAudits') DROP PROCEDURE sp_GetAllAudits;
GO
CREATE PROCEDURE sp_GetAllAudits
    @StoreID INT = NULL,
    @Status NVARCHAR(50) = NULL,
    @Top INT = 100
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP (@Top)
        ai.AuditInstanceID,
        ai.DocumentNumber,
        ai.TemplateID,
GO
PRINT 'Created sp_GetAllAudits';
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetAuditInstance') DROP PROCEDURE sp_GetAuditInstance;
GO
CREATE PROCEDURE sp_GetAuditInstance
    @AuditInstanceID INT = NULL,
    @DocumentNumber NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    -- Get audit instance
    SELECT 
        ai.AuditInstanceID,
        ai.DocumentNumber,
        ai.T
GO
PRINT 'Created sp_GetAuditInstance';
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_SaveAuditResponse') DROP PROCEDURE sp_SaveAuditResponse;
GO
CREATE PROCEDURE sp_SaveAuditResponse
    @ResponseID INT,
    @SelectedChoice NVARCHAR(20),
    @Finding NVARCHAR(MAX) = NULL,
    @Comment NVARCHAR(MAX) = NULL,
    @CorrectiveAction NVARCHAR(MAX) = NULL,
    @Priority NVARCHAR(20) = NULL,
    @Ha
GO
PRINT 'Created sp_SaveAuditResponse';
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_CompleteAudit') DROP PROCEDURE sp_CompleteAudit;
GO
CREATE PROCEDURE sp_CompleteAudit
    @AuditInstanceID INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        UPDATE AuditInstances
        SET 
            Status = 'Completed',
            CompletedDate = GETDATE(),
            ModifiedDate =
GO
PRINT 'Created sp_CompleteAudit';
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetActionPlanSummary') DROP PROCEDURE sp_GetActionPlanSummary;
GO
CREATE PROCEDURE sp_GetActionPlanSummary
    @DocumentNumber NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT 
        COUNT(*) AS TotalActions,
        SUM(CASE WHEN Priority = 'Critical' THEN 1 ELSE 0 END) AS CriticalCount,
        SU
GO
PRINT 'Created sp_GetActionPlanSummary';
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetActionPlanResponses') DROP PROCEDURE sp_GetActionPlanResponses;
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
        SuggestedA
GO
PRINT 'Created sp_GetActionPlanResponses';
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_SaveActionPlanResponse') DROP PROCEDURE sp_SaveActionPlanResponse;
GO
CREATE PROCEDURE sp_SaveActionPlanResponse
    @DocumentNumber NVARCHAR(50),
    @ReferenceValue NVARCHAR(20),
    @Section NVARCHAR(100),
    @Finding NVARCHAR(MAX),
    @SuggestedAction NVARCHAR(MAX),
    @Priority NVARCHAR(20),
    @ActionTaken
GO
PRINT 'Created sp_SaveActionPlanResponse';
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_CleanupExpiredSessions') DROP PROCEDURE sp_CleanupExpiredSessions;
GO
CREATE PROCEDURE sp_CleanupExpiredSessions
AS
BEGIN
    DELETE FROM Sessions WHERE expires_at < GETDATE();
    PRINT CAST(@@ROWCOUNT AS VARCHAR) + ' expired sessions cleaned up';
END
GO
PRINT 'Created sp_CleanupExpiredSessions';
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetNextReferenceValue') DROP PROCEDURE sp_GetNextReferenceValue;
GO
CREATE PROCEDURE sp_GetNextReferenceValue
    @TemplateID INT,
    @SectionID INT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @SectionNumber INT;
    DECLARE @MaxItemNumber INT;
    DECLARE @NextReference NVARCHAR(20);
    -- Get sectio
GO
PRINT 'Created sp_GetNextReferenceValue';
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_CreateChecklistSchema') DROP PROCEDURE sp_CreateChecklistSchema;
GO
CREATE PROCEDURE sp_CreateChecklistSchema
    @SchemaName NVARCHAR(200),
    @Description NVARCHAR(MAX) = NULL,
    @CreatedBy NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        -- Check if schema already exists
        IF EX
GO
PRINT 'Created sp_CreateChecklistSchema';
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetChecklistSchemas') DROP PROCEDURE sp_GetChecklistSchemas;
GO
CREATE PROCEDURE sp_GetChecklistSchemas
    @ActiveOnly BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    SELECT 
        SchemaID,
        SchemaName,
        Description,
        CreatedBy,
        CreatedDate,
        ModifiedBy,
        Modi
GO
PRINT 'Created sp_GetChecklistSchemas';
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetChecklistSchemaById') DROP PROCEDURE sp_GetChecklistSchemaById;
GO
CREATE PROCEDURE sp_GetChecklistSchemaById
    @SchemaID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT 
        SchemaID,
        SchemaName,
        Description,
        CreatedBy,
        CreatedDate,
        ModifiedBy,
        Modifie
GO
PRINT 'Created sp_GetChecklistSchemaById';
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_UpdateChecklistSchema') DROP PROCEDURE sp_UpdateChecklistSchema;
GO
CREATE PROCEDURE sp_UpdateChecklistSchema
    @SchemaID INT,
    @SchemaName NVARCHAR(200) = NULL,
    @Description NVARCHAR(MAX) = NULL,
    @ModifiedBy NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        -- Validate schema e
GO
PRINT 'Created sp_UpdateChecklistSchema';
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_DeactivateChecklistSchema') DROP PROCEDURE sp_DeactivateChecklistSchema;
GO
CREATE PROCEDURE sp_DeactivateChecklistSchema
    @SchemaID INT,
    @ModifiedBy NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        -- Validate schema exists
        IF NOT EXISTS (SELECT 1 FROM ChecklistSchemas WHERE SchemaID
GO
PRINT 'Created sp_DeactivateChecklistSchema';
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_CreateChecklistTemplate') DROP PROCEDURE sp_CreateChecklistTemplate;
GO
CREATE PROCEDURE sp_CreateChecklistTemplate
    @TemplateName NVARCHAR(200),
    @SchemaID INT,
    @Description NVARCHAR(MAX) = NULL,
    @Version NVARCHAR(20) = NULL,
    @CreatedBy NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TR
GO
PRINT 'Created sp_CreateChecklistTemplate';
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetChecklistTemplates') DROP PROCEDURE sp_GetChecklistTemplates;
GO
CREATE PROCEDURE sp_GetChecklistTemplates
    @ActiveOnly BIT = 1,
    @SchemaID INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT 
        t.TemplateID,
        t.TemplateName,
        t.SchemaID,
        s.SchemaName,
        t.Descri
GO
PRINT 'Created sp_GetChecklistTemplates';
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetChecklistTemplateById') DROP PROCEDURE sp_GetChecklistTemplateById;
GO
CREATE PROCEDURE sp_GetChecklistTemplateById
    @TemplateID INT
AS
BEGIN
    SET NOCOUNT ON;
    -- Return template details
    SELECT 
        t.TemplateID,
        t.TemplateName,
        t.SchemaID,
        s.SchemaName,
        t.De
GO
PRINT 'Created sp_GetChecklistTemplateById';
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_UpdateChecklistTemplate') DROP PROCEDURE sp_UpdateChecklistTemplate;
GO
CREATE PROCEDURE sp_UpdateChecklistTemplate
    @TemplateID INT,
    @TemplateName NVARCHAR(200) = NULL,
    @Description NVARCHAR(MAX) = NULL,
    @Version NVARCHAR(20) = NULL,
    @ModifiedBy NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
GO
PRINT 'Created sp_UpdateChecklistTemplate';
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_DeactivateChecklistTemplate') DROP PROCEDURE sp_DeactivateChecklistTemplate;
GO
CREATE PROCEDURE sp_DeactivateChecklistTemplate
    @TemplateID INT,
    @ModifiedBy NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        -- Validate template exists
        IF NOT EXISTS (SELECT 1 FROM ChecklistTemplates WHERE 
GO
PRINT 'Created sp_DeactivateChecklistTemplate';
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_AddSectionToTemplate') DROP PROCEDURE sp_AddSectionToTemplate;
GO
CREATE PROCEDURE sp_AddSectionToTemplate
    @TemplateID INT,
    @SectionID INT,
    @SectionOrder INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        -- Validate template exists
        IF NOT EXISTS (SELECT 1 FROM ChecklistTem
GO
PRINT 'Created sp_AddSectionToTemplate';
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_RemoveSectionFromTemplate') DROP PROCEDURE sp_RemoveSectionFromTemplate;
GO
CREATE PROCEDURE sp_RemoveSectionFromTemplate
    @TemplateID INT,
    @SectionID INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        -- Delete section from template
        DELETE FROM TemplateSections
        WHERE TemplateID = @Templ
GO
PRINT 'Created sp_RemoveSectionFromTemplate';
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_AddTemplateItem') DROP PROCEDURE sp_AddTemplateItem;
GO
CREATE PROCEDURE sp_AddTemplateItem
    @TemplateID INT,
    @SectionID INT,
    @ReferenceValue NVARCHAR(20),
    @Title NVARCHAR(MAX),
    @Coeff INT,
    @Answer NVARCHAR(100) = 'Yes,Partially,No,NA',
    @Cr NVARCHAR(MAX) = NULL,
    @SortOrd
GO
PRINT 'Created sp_AddTemplateItem';
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_BatchAddTemplateItems') DROP PROCEDURE sp_BatchAddTemplateItems;
GO
CREATE PROCEDURE sp_BatchAddTemplateItems
    @TemplateID INT,
    @SectionID INT,
    @ItemsJSON NVARCHAR(MAX) -- JSON array of items
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        -- Validate template exists
        IF NOT EXISTS (SE
GO
PRINT 'Created sp_BatchAddTemplateItems';
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_UpdateTemplateItem') DROP PROCEDURE sp_UpdateTemplateItem;
GO
CREATE PROCEDURE sp_UpdateTemplateItem
    @ItemID INT,
    @ReferenceValue NVARCHAR(20) = NULL,
    @Title NVARCHAR(MAX) = NULL,
    @Coeff INT = NULL,
    @Answer NVARCHAR(100) = NULL,
    @Cr NVARCHAR(MAX) = NULL,
    @SortOrder INT = NULL
AS
GO
PRINT 'Created sp_UpdateTemplateItem';
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_DeleteTemplateItem') DROP PROCEDURE sp_DeleteTemplateItem;
GO
CREATE PROCEDURE sp_DeleteTemplateItem
    @ItemID INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        -- Validate item exists
        IF NOT EXISTS (SELECT 1 FROM ChecklistTemplateItems WHERE ItemID = @ItemID)
        BEGIN
GO
PRINT 'Created sp_DeleteTemplateItem';
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetTemplateItems') DROP PROCEDURE sp_GetTemplateItems;
GO
CREATE PROCEDURE sp_GetTemplateItems
    @TemplateID INT,
    @SectionID INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT 
        i.ItemID,
        i.TemplateID,
        i.SectionID,
        s.SectionName,
        s.SectionNumber,
GO
PRINT 'Created sp_GetTemplateItems';
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetTemplateItemById') DROP PROCEDURE sp_GetTemplateItemById;
GO
CREATE PROCEDURE sp_GetTemplateItemById
    @ItemID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT 
        i.ItemID,
        i.TemplateID,
        i.SectionID,
        s.SectionName,
        s.SectionNumber,
        i.ReferenceValue,
GO
PRINT 'Created sp_GetTemplateItemById';
GO

