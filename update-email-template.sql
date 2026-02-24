USE FoodSafetyDB_Live;
GO

UPDATE EmailTemplates 
SET available_placeholders = '["recipientName","storeName","documentNumber","auditDate","score","sectionScores","customMessage","reportUrl","dashboardUrl"]'
WHERE template_key = 'report_notification';
GO

PRINT 'Updated available_placeholders for report_notification template';
GO
