/**
 * Stored Procedures for Section Management
 * Modular stored procedures for ChecklistSections table operations
 */

USE FoodSafetyDB_Live;
GO

PRINT '=============================================================================';
PRINT 'CREATING SECTION MANAGEMENT STORED PROCEDURES';
PRINT '=============================================================================';
PRINT '';

-- =============================================================================
-- SP: Create Section
-- =============================================================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_CreateChecklistSection')
    DROP PROCEDURE sp_CreateChecklistSection;
GO

CREATE PROCEDURE sp_CreateChecklistSection
    @SectionName NVARCHAR(200),
    @SectionNumber INT = NULL,
    @Icon NVARCHAR(10) = NULL,
    @Description NVARCHAR(MAX) = NULL,
    @CreatedBy NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        -- Check if section already exists
        IF EXISTS (SELECT 1 FROM ChecklistSections WHERE SectionName = @SectionName)
        BEGIN
            RAISERROR('Section with this name already exists', 16, 1);
            RETURN;
        END
        
        -- Auto-assign section number if not provided
        IF @SectionNumber IS NULL
        BEGIN
            SELECT @SectionNumber = ISNULL(MAX(SectionNumber), 0) + 1
            FROM ChecklistSections;
        END
        
        -- Insert new section
        INSERT INTO ChecklistSections (SectionName, SectionNumber, Icon, Description, CreatedBy)
        VALUES (@SectionName, @SectionNumber, @Icon, @Description, @CreatedBy);
        
        -- Return the new section ID
        SELECT SCOPE_IDENTITY() AS SectionID, 'Section created successfully' AS Message;
    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR(@ErrorMessage, 16, 1);
    END CATCH
END
GO

PRINT 'âœ… sp_CreateChecklistSection created';

-- =============================================================================
-- SP: Get All Sections
-- =============================================================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetChecklistSections')
    DROP PROCEDURE sp_GetChecklistSections;
GO

CREATE PROCEDURE sp_GetChecklistSections
    @ActiveOnly BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        SectionID,
        SectionName,
        SectionNumber,
        Icon,
        Description,
        CreatedBy,
        CreatedDate,
        IsActive
    FROM ChecklistSections
    WHERE (@ActiveOnly = 0 OR IsActive = 1)
    ORDER BY SectionNumber, SectionName;
END
GO

PRINT 'âœ… sp_GetChecklistSections created';

-- =============================================================================
-- SP: Get Section by ID
-- =============================================================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetChecklistSectionById')
    DROP PROCEDURE sp_GetChecklistSectionById;
GO

CREATE PROCEDURE sp_GetChecklistSectionById
    @SectionID INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        SectionID,
        SectionName,
        SectionNumber,
        Icon,
        Description,
        CreatedBy,
        CreatedDate,
        IsActive
    FROM ChecklistSections
    WHERE SectionID = @SectionID;
END
GO

PRINT 'âœ… sp_GetChecklistSectionById created';

-- =============================================================================
-- SP: Update Section
-- =============================================================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_UpdateChecklistSection')
    DROP PROCEDURE sp_UpdateChecklistSection;
GO

CREATE PROCEDURE sp_UpdateChecklistSection
    @SectionID INT,
    @SectionName NVARCHAR(200) = NULL,
    @SectionNumber INT = NULL,
    @Icon NVARCHAR(10) = NULL,
    @Description NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        -- Validate section exists
        IF NOT EXISTS (SELECT 1 FROM ChecklistSections WHERE SectionID = @SectionID)
        BEGIN
            RAISERROR('Section does not exist', 16, 1);
            RETURN;
        END
        
        -- Update only provided fields
        UPDATE ChecklistSections
        SET 
            SectionName = ISNULL(@SectionName, SectionName),
            SectionNumber = ISNULL(@SectionNumber, SectionNumber),
            Icon = ISNULL(@Icon, Icon),
            Description = ISNULL(@Description, Description)
        WHERE SectionID = @SectionID;
        
        SELECT 'Section updated successfully' AS Message;
    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR(@ErrorMessage, 16, 1);
    END CATCH
END
GO

PRINT 'âœ… sp_UpdateChecklistSection created';

-- =============================================================================
-- SP: Deactivate Section
-- =============================================================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_DeactivateChecklistSection')
    DROP PROCEDURE sp_DeactivateChecklistSection;
GO

CREATE PROCEDURE sp_DeactivateChecklistSection
    @SectionID INT
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        -- Validate section exists
        IF NOT EXISTS (SELECT 1 FROM ChecklistSections WHERE SectionID = @SectionID)
        BEGIN
            RAISERROR('Section does not exist', 16, 1);
            RETURN;
        END
        
        -- Deactivate section
        UPDATE ChecklistSections
        SET IsActive = 0
        WHERE SectionID = @SectionID;
        
        SELECT 'Section deactivated successfully' AS Message;
    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR(@ErrorMessage, 16, 1);
    END CATCH
END
GO

PRINT 'âœ… sp_DeactivateChecklistSection created';

PRINT '';
PRINT '=============================================================================';
PRINT 'âœ… SECTION MANAGEMENT STORED PROCEDURES CREATED!';
PRINT '=============================================================================';
GO

