USE FoodSafetyDB_Live;
GO

-- sp_GetAllStores
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetAllStores') DROP PROCEDURE sp_GetAllStores;
GO
CREATE PROCEDURE sp_GetAllStores
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
        s.CreatedAt,
        s.CreatedBy
    FROM Stores s
    INNER JOIN AuditSchemas a ON s.SchemaID = a.SchemaID
    ORDER BY s.StoreName;
END;
GO
PRINT 'Created sp_GetAllStores';
GO

-- sp_GetActiveStores
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetActiveStores') DROP PROCEDURE sp_GetActiveStores;
GO
CREATE PROCEDURE sp_GetActiveStores
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
        s.CreatedAt,
        s.CreatedBy
    FROM Stores s
    INNER JOIN AuditSchemas a ON s.SchemaID = a.SchemaID
    WHERE s.IsActive = 1
    ORDER BY s.StoreName;
END;
GO
PRINT 'Created sp_GetActiveStores';
GO

-- sp_CreateStore
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_CreateStore') DROP PROCEDURE sp_CreateStore;
GO
CREATE PROCEDURE sp_CreateStore
    @StoreCode NVARCHAR(50),
    @StoreName NVARCHAR(200),
    @Location NVARCHAR(500) = NULL,
    @SchemaID INT,
    @CreatedBy NVARCHAR(255) = NULL
AS
BEGIN
    INSERT INTO Stores (StoreCode, StoreName, Location, SchemaID, CreatedBy)
    VALUES (@StoreCode, @StoreName, @Location, @SchemaID, @CreatedBy);
    
    SELECT SCOPE_IDENTITY() AS StoreID;
END;
GO
PRINT 'Created sp_CreateStore';
GO

-- sp_UpdateStore
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_UpdateStore') DROP PROCEDURE sp_UpdateStore;
GO
CREATE PROCEDURE sp_UpdateStore
    @StoreID INT,
    @StoreCode NVARCHAR(50),
    @StoreName NVARCHAR(200),
    @Location NVARCHAR(500) = NULL,
    @SchemaID INT,
    @IsActive BIT = 1
AS
BEGIN
    UPDATE Stores
    SET StoreCode = @StoreCode,
        StoreName = @StoreName,
        Location = @Location,
        SchemaID = @SchemaID,
        IsActive = @IsActive
    WHERE StoreID = @StoreID;
    
    SELECT @@ROWCOUNT AS RowsAffected;
END;
GO
PRINT 'Created sp_UpdateStore';
GO
