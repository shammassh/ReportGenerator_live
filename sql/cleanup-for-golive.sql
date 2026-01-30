-- ============================================================================
-- PRODUCTION GO-LIVE CLEANUP SCRIPT
-- ============================================================================
-- Purpose: Delete all test audit data while keeping configuration intact
-- 
-- KEEPS (Configuration):
--   - AuditSchemas (audit types)
--   - AuditSections (section definitions)
--   - AuditCategories (category groupings)
--   - AuditItems (checklist questions)
--   - CategorySections (category-section links)
--   - Users, UserRoles (user accounts)
--   - Stores (store list)
--   - StoreManagerAssignments (user-store assignments)
--   - SystemSettings (app configuration)
--   - ReportColorSettings, SchemaColors (styling)
--
-- DELETES (Test/Audit Data):
--   - AuditInstances (audit documents)
--   - AuditResponses (audit answers)
--   - AuditPictures (finding images)
--   - AuditSectionScores (section scores)
--   - FridgeReadings (temperature readings)
--   - ActionPlanResponses (action plan items)
--   - ActionPlanAuditLog (action plan history)
--   - Notifications (email logs)
--   - SavedReports (generated report metadata)
--   - DepartmentReports (department report history)
--   - AuditLog (change history - optional)
--
-- Run this script ONCE when ready to go live after testing
-- ============================================================================

USE FoodSafetyDB;
GO

-- ============================================================================
-- SAFETY CHECK: Show what will be deleted
-- ============================================================================
PRINT '============================================';
PRINT 'PRE-CLEANUP DATA COUNT';
PRINT '============================================';

SELECT 'AuditInstances' AS TableName, COUNT(*) AS RecordCount FROM AuditInstances
UNION ALL
SELECT 'AuditResponses', COUNT(*) FROM AuditResponses
UNION ALL
SELECT 'AuditPictures', COUNT(*) FROM AuditPictures
UNION ALL
SELECT 'AuditSectionScores', COUNT(*) FROM AuditSectionScores
UNION ALL
SELECT 'FridgeReadings', COUNT(*) FROM FridgeReadings
UNION ALL
SELECT 'ActionPlanResponses', COUNT(*) FROM ActionPlanResponses
UNION ALL
SELECT 'ActionPlanAuditLog', COUNT(*) FROM ActionPlanAuditLog
UNION ALL
SELECT 'Notifications', COUNT(*) FROM Notifications
UNION ALL
SELECT 'SavedReports', COUNT(*) FROM SavedReports
UNION ALL
SELECT 'DepartmentReports', COUNT(*) FROM DepartmentReports;

PRINT '';
PRINT 'Configuration data that will be KEPT:';

SELECT 'AuditSchemas' AS TableName, COUNT(*) AS RecordCount FROM AuditSchemas
UNION ALL
SELECT 'AuditSections', COUNT(*) FROM AuditSections
UNION ALL
SELECT 'AuditCategories', COUNT(*) FROM AuditCategories
UNION ALL
SELECT 'AuditItems', COUNT(*) FROM AuditItems
UNION ALL
SELECT 'CategorySections', COUNT(*) FROM CategorySections
UNION ALL
SELECT 'Users', COUNT(*) FROM Users
UNION ALL
SELECT 'Stores', COUNT(*) FROM Stores
UNION ALL
SELECT 'StoreManagerAssignments', COUNT(*) FROM StoreManagerAssignments;

PRINT '';
PRINT '============================================';
PRINT 'Starting cleanup...';
PRINT '============================================';

-- ============================================================================
-- BEGIN TRANSACTION (for safety - can rollback if needed)
-- ============================================================================
BEGIN TRANSACTION;

BEGIN TRY

    -- ========================================================================
    -- DELETE AUDIT DATA (in correct order due to foreign keys)
    -- ========================================================================
    
    -- 1. Delete audit pictures (child of AuditResponses)
    PRINT 'Deleting AuditPictures...';
    DELETE FROM AuditPictures;
    PRINT '  Deleted ' + CAST(@@ROWCOUNT AS VARCHAR) + ' records';
    
    -- 2. Delete audit responses (child of AuditInstances)
    PRINT 'Deleting AuditResponses...';
    DELETE FROM AuditResponses;
    PRINT '  Deleted ' + CAST(@@ROWCOUNT AS VARCHAR) + ' records';
    
    -- 3. Delete section scores (child of AuditInstances)
    PRINT 'Deleting AuditSectionScores...';
    DELETE FROM AuditSectionScores;
    PRINT '  Deleted ' + CAST(@@ROWCOUNT AS VARCHAR) + ' records';
    
    -- 4. Delete fridge/temperature readings
    PRINT 'Deleting FridgeReadings...';
    DELETE FROM FridgeReadings;
    PRINT '  Deleted ' + CAST(@@ROWCOUNT AS VARCHAR) + ' records';
    
    -- 5. Delete action plan audit log
    PRINT 'Deleting ActionPlanAuditLog...';
    DELETE FROM ActionPlanAuditLog;
    PRINT '  Deleted ' + CAST(@@ROWCOUNT AS VARCHAR) + ' records';
    
    -- 6. Delete action plan responses
    PRINT 'Deleting ActionPlanResponses...';
    DELETE FROM ActionPlanResponses;
    PRINT '  Deleted ' + CAST(@@ROWCOUNT AS VARCHAR) + ' records';
    
    -- 7. Delete notifications
    PRINT 'Deleting Notifications...';
    DELETE FROM Notifications;
    PRINT '  Deleted ' + CAST(@@ROWCOUNT AS VARCHAR) + ' records';
    
    -- 8. Delete saved reports metadata
    PRINT 'Deleting SavedReports...';
    DELETE FROM SavedReports;
    PRINT '  Deleted ' + CAST(@@ROWCOUNT AS VARCHAR) + ' records';
    
    -- 9. Delete department reports
    PRINT 'Deleting DepartmentReports...';
    DELETE FROM DepartmentReports;
    PRINT '  Deleted ' + CAST(@@ROWCOUNT AS VARCHAR) + ' records';
    
    -- 10. Delete audit instances (parent table - delete last)
    PRINT 'Deleting AuditInstances...';
    DELETE FROM AuditInstances;
    PRINT '  Deleted ' + CAST(@@ROWCOUNT AS VARCHAR) + ' records';
    
    -- 11. Optional: Delete audit log (change history)
    -- Uncomment the next 3 lines if you want to clear change history too
    -- PRINT 'Deleting AuditLog...';
    -- DELETE FROM AuditLog;
    -- PRINT '  Deleted ' + CAST(@@ROWCOUNT AS VARCHAR) + ' records';

    -- ========================================================================
    -- RESET IDENTITY SEEDS (so document numbers start from 1)
    -- ========================================================================
    PRINT '';
    PRINT 'Resetting identity seeds...';
    
    -- Reset AuditInstances ID (for document numbers)
    DBCC CHECKIDENT ('AuditInstances', RESEED, 0);
    PRINT '  AuditInstances identity reset to 0';
    
    -- Reset other tables with identity columns
    DBCC CHECKIDENT ('AuditResponses', RESEED, 0);
    PRINT '  AuditResponses identity reset to 0';
    
    DBCC CHECKIDENT ('AuditPictures', RESEED, 0);
    PRINT '  AuditPictures identity reset to 0';
    
    DBCC CHECKIDENT ('AuditSectionScores', RESEED, 0);
    PRINT '  AuditSectionScores identity reset to 0';
    
    DBCC CHECKIDENT ('FridgeReadings', RESEED, 0);
    PRINT '  FridgeReadings identity reset to 0';
    
    DBCC CHECKIDENT ('ActionPlanResponses', RESEED, 0);
    PRINT '  ActionPlanResponses identity reset to 0';
    
    DBCC CHECKIDENT ('ActionPlanAuditLog', RESEED, 0);
    PRINT '  ActionPlanAuditLog identity reset to 0';
    
    DBCC CHECKIDENT ('Notifications', RESEED, 0);
    PRINT '  Notifications identity reset to 0';
    
    DBCC CHECKIDENT ('SavedReports', RESEED, 0);
    PRINT '  SavedReports identity reset to 0';
    
    DBCC CHECKIDENT ('DepartmentReports', RESEED, 0);
    PRINT '  DepartmentReports identity reset to 0';

    -- ========================================================================
    -- COMMIT TRANSACTION
    -- ========================================================================
    COMMIT TRANSACTION;
    
    PRINT '';
    PRINT '============================================';
    PRINT 'CLEANUP COMPLETED SUCCESSFULLY!';
    PRINT '============================================';
    PRINT '';
    PRINT 'Configuration data preserved:';
    PRINT '  - Schemas, Sections, Categories, Items';
    PRINT '  - Users and Store Assignments';
    PRINT '  - System Settings and Colors';
    PRINT '';
    PRINT 'Audit data cleared:';
    PRINT '  - All test audits deleted';
    PRINT '  - Document numbers will start from 1';
    PRINT '';
    PRINT 'System is ready for production!';
    PRINT '============================================';

END TRY
BEGIN CATCH
    -- Rollback on error
    ROLLBACK TRANSACTION;
    
    PRINT '';
    PRINT '============================================';
    PRINT 'ERROR OCCURRED - TRANSACTION ROLLED BACK';
    PRINT '============================================';
    PRINT 'Error Number: ' + CAST(ERROR_NUMBER() AS VARCHAR);
    PRINT 'Error Message: ' + ERROR_MESSAGE();
    PRINT '';
    PRINT 'No data was deleted. Please fix the error and try again.';
    PRINT '============================================';
END CATCH;

GO
