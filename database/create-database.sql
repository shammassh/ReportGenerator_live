-- =============================================
-- Step 1: Create Database (Run this FIRST)
-- =============================================
-- This creates the FoodSafetyDB database
-- Run this in SQL Server Management Studio or Azure Data Studio
-- connected to the 'master' database

USE master;
GO

-- Check if database exists, create if not
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'FoodSafetyDB')
BEGIN
    CREATE DATABASE FoodSafetyDB;
    PRINT 'βœ… Database FoodSafetyDB created successfully!';
END
ELSE
BEGIN
    PRINT 'βœ"οΈ Database FoodSafetyDB already exists.';
END
GO

-- Switch to the new database
USE FoodSafetyDB;
GO

PRINT 'βœ… Now connected to FoodSafetyDB';
PRINT 'βœ… Next step: Run schema.sql to create tables and stored procedures';
