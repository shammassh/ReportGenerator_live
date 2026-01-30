/**
 * Stored Procedures for Schema Management
 * Modular stored procedures for ChecklistSchemas table operations
 */

USE FoodSafetyDB;
GO

PRINT '=============================================================================';
PRINT 'CREATING SCHEMA MANAGEMENT STORED PROCEDURES';
PRINT '=============================================================================';
PRINT '';

-- =============================================================================
-- SP: Create Schema
-- =============================================================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_CreateChecklistSchema')
    DROP PROCEDURE sp_CreateChecklistSchema;
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
        IF EXISTS (SELECT 1 FROM ChecklistSchemas WHERE SchemaName = @SchemaName)
        BEGIN
            RAISERROR('Schema with this name already exists', 16, 1);
            RETURN;
        END
        
        -- Insert new schema
        INSERT INTO ChecklistSchemas (SchemaName, Description, CreatedBy)
        VALUES (@SchemaName, @Description, @CreatedBy);
        
        -- Return the new schema ID
        SELECT SCOPE_IDENTITY() AS SchemaID, 'Schema created successfully' AS Message;
    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR(@ErrorMessage, 16, 1);
    END CATCH
END
GO

PRINT '✅ sp_CreateChecklistSchema created';

-- =============================================================================
-- SP: Get All Schemas
-- =============================================================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetChecklistSchemas')
    DROP PROCEDURE sp_GetChecklistSchemas;
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
        ModifiedDate,
        IsActive,
        (SELECT COUNT(*) FROM ChecklistTemplates WHERE SchemaID = cs.SchemaID AND IsActive = 1) AS TemplateCount
    FROM ChecklistSchemas cs
    WHERE (@ActiveOnly = 0 OR IsActive = 1)
    ORDER BY SchemaName;
END
GO

PRINT '✅ sp_GetChecklistSchemas created';

-- =============================================================================
-- SP: Get Schema by ID
-- =============================================================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetChecklistSchemaById')
    DROP PROCEDURE sp_GetChecklistSchemaById;
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
        ModifiedDate,
        IsActive
    FROM ChecklistSchemas
    WHERE SchemaID = @SchemaID;
END
GO

PRINT '✅ sp_GetChecklistSchemaById created';

-- =============================================================================
-- SP: Update Schema
-- =============================================================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_UpdateChecklistSchema')
    DROP PROCEDURE sp_UpdateChecklistSchema;
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
        -- Validate schema exists
        IF NOT EXISTS (SELECT 1 FROM ChecklistSchemas WHERE SchemaID = @SchemaID)
        BEGIN
            RAISERROR('Schema does not exist', 16, 1);
            RETURN;
        END
        
        -- Update only provided fields
        UPDATE ChecklistSchemas
        SET 
            SchemaName = ISNULL(@SchemaName, SchemaName),
            Description = ISNULL(@Description, Description),
            ModifiedBy = @ModifiedBy,
            ModifiedDate = GETDATE()
        WHERE SchemaID = @SchemaID;
        
        SELECT 'Schema updated successfully' AS Message;
    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR(@ErrorMessage, 16, 1);
    END CATCH
END
GO

PRINT '✅ sp_UpdateChecklistSchema created';

-- =============================================================================
-- SP: Deactivate Schema
-- =============================================================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_DeactivateChecklistSchema')
    DROP PROCEDURE sp_DeactivateChecklistSchema;
GO

CREATE PROCEDURE sp_DeactivateChecklistSchema
    @SchemaID INT,
    @ModifiedBy NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        -- Validate schema exists
        IF NOT EXISTS (SELECT 1 FROM ChecklistSchemas WHERE SchemaID = @SchemaID)
        BEGIN
            RAISERROR('Schema does not exist', 16, 1);
            RETURN;
        END
        
        -- Deactivate schema
        UPDATE ChecklistSchemas
        SET IsActive = 0,
            ModifiedBy = @ModifiedBy,
            ModifiedDate = GETDATE()
        WHERE SchemaID = @SchemaID;
        
        SELECT 'Schema deactivated successfully' AS Message;
    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR(@ErrorMessage, 16, 1);
    END CATCH
END
GO

PRINT '✅ sp_DeactivateChecklistSchema created';

PRINT '';
PRINT '=============================================================================';
PRINT '✅ SCHEMA MANAGEMENT STORED PROCEDURES CREATED!';
PRINT '=============================================================================';
GO
