-- Fix audit date for document GMRL-FSACSG-1221-0027
-- The date should be 27/03/2026 (March 27, 2026)

-- First, check the current date
SELECT AuditID, DocumentNumber, AuditDate, StoreName, Status 
FROM AuditInstances 
WHERE DocumentNumber = 'GMRL-FSACSG-1221-0027';

-- Update the date to March 27, 2026
UPDATE AuditInstances 
SET AuditDate = '2026-03-27'
WHERE DocumentNumber = 'GMRL-FSACSG-1221-0027';

-- Verify the update
SELECT AuditID, DocumentNumber, AuditDate, StoreName, Status 
FROM AuditInstances 
WHERE DocumentNumber = 'GMRL-FSACSG-1221-0027';
