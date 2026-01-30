-- Script to copy stored procedures from FoodSafetyDB to FoodSafetyDB_Live
USE FoodSafetyDB_Live;
GO

-- sp_GetAllSchemas
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetAllSchemas') DROP PROCEDURE sp_GetAllSchemas;
GO
CREATE PROCEDURE sp_GetAllSchemas
    @ActiveOnly BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    SELECT SchemaID, SchemaName, Description, IsActive, CreatedBy, CreatedDate,
        (SELECT COUNT(*) FROM AuditSections WHERE SchemaID = s.SchemaID) AS SectionCount
    FROM AuditSchemas s
    WHERE (@ActiveOnly = 0 OR IsActive = 1)
    ORDER BY SchemaName;
END
GO
PRINT 'Created sp_GetAllSchemas'
