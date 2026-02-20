-- =============================================
-- Add Org Tree button to MenuPermissions
-- =============================================
IF NOT EXISTS (SELECT 1 FROM MenuPermissions WHERE ButtonID = 'orgTreeBtn')
BEGIN
    INSERT INTO MenuPermissions (
        ButtonID, ButtonName, Category, Icon, Url, ActionType, 
        AllowedRoles, EditRoles, IsEnabled, SortOrder
    ) VALUES (
        'orgTreeBtn',
        'Org Tree',
        'Developer',
        '🏢',
        '/admin/org-hierarchy',
        'Page',
        'Admin',
        'Admin',
        1,
        60
    );
    PRINT 'Added orgTreeBtn to MenuPermissions';
END
ELSE
BEGIN
    PRINT 'orgTreeBtn already exists in MenuPermissions';
END
GO
