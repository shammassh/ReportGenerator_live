-- =============================================
-- Migration: Fix Section Item Count
-- Issue: ItemCount was including soft-deleted (IsActive=0) items
-- Date: 2026-01-21
-- =============================================

-- Drop and recreate sp_GetSectionsBySchema with fixed ItemCount query
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

PRINT '✅ Fixed sp_GetSectionsBySchema - ItemCount now only counts active items';
GO
