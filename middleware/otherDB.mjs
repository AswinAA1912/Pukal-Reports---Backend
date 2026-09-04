import { failed, invalidInput, servError } from '../res.mjs';
import sql from 'mssql';
import { asyncLocalStorage } from '../config/dbContext.mjs';
import { portalPool } from '../config/dbconfig.mjs';

// Cache to store established connection pools
const connectionPools = new Map();

// Helper to parse instance names and ports from SQL server connection strings
const parseServerStr = (serverStr, config) => {
  if (!serverStr) return;
  let host = serverStr;
  let instanceName = null;
  let port = null;

  if (host.includes(',')) {
    const parts = host.split(',');
    host = parts[0];
    port = parseInt(parts[1], 10);
  }

  if (host.includes('\\')) {
    const parts = host.split('\\');
    host = parts[0];
    instanceName = parts[1];
  }

  config.server = host;
  if (port) {
    config.port = port;
  }
  if (instanceName) {
    if (!config.options) config.options = {};
    config.options.instanceName = instanceName;
  }
};

// Helper to resolve company prefix dynamically by looking up matching COMPANY<N>_ID in env
const getCompanyConfigFromEnv = (Db) => {
  let prefix = null;
  for (const key in process.env) {
    if (key.startsWith('COMPANY') && key.endsWith('_ID')) {
      if (process.env[key] == Db) {
        prefix = key.slice(0, key.indexOf('_ID'));
        break;
      }
    }
  }

  if (!prefix) {
    return null;
  }

  const host = process.env[`${prefix}_DB_HOST`] || process.env[`${prefix}_HOST`] || process.env[`${prefix}_SERVER`];
  const user = process.env[`${prefix}_DB_USER`] || process.env[`${prefix}_USER`];
  const password = process.env[`${prefix}_DB_PASSWORD`] || process.env[`${prefix}_PASSWORD`];
  const database = process.env[`${prefix}_DATABASE`] || process.env[`${prefix}_DB`];

  if (!host || !user || !password || !database) {
    console.warn(`Incomplete database config in env for prefix: ${prefix}`);
    return null;
  }

  return { host, user, password, database };
};

const dbconnect = async (req, res, next) => {
  // Skip company database connection for portal-only routes
  if (req.path && (req.path.includes('/userPortal/') || req.path.includes('/menuMaster'))) {
    return next();
  }

  let Db = req.get('Db') || req.get('companyId') || req.get('company_id') || req.get('CompanyId') || req.get('Company_Id') ||
           req.body?.companyId || req.body?.company_id || req.body?.CompanyId || req.body?.Company_Id ||
           req.query?.companyId || req.query?.company_id || req.query?.CompanyId || req.query?.Company_Id;

  // Fallback to SELECTED_COMPANY_ID if no dynamic Db is provided
  if (!Db && process.env.SELECTED_COMPANY_ID) {
    Db = process.env.SELECTED_COMPANY_ID;
  }

  // If no Db ID is resolved, simply proceed with the default global connection.
  if (!Db) {
    return next();
  }


  let config = {
    driver: "SQL Server",
    stream: false,
    options: {
      trustedConnection: true,
      trustServerCertificate: true,
      enableArithAbort: true,
      requestTimeout: 60000,
    },
    connectionTimeout: 15000,
    requestTimeout: 15000,
  };

  try {
    // 1. Fetch metadata and connection details from portal database directly
    let Tally_Company_Id = null;
    let Tally_Guid = null;
    let dbDetails = null;

    if (!process.env.SELECTED_COMPANY_ID || process.env.SELECTED_COMPANY_ID != Db) {
      try {
        const fetchDbdata = new sql.Request(portalPool);
        fetchDbdata.input('Id', sql.VarChar, String(Db));
        const result = await fetchDbdata.query(`
          SELECT 
            DB_Server_Name AS IP_Address, 
            DB_Name AS SQL_DB_Name, 
            DB_User_Name AS SQL_User_Name, 
            DB_Pass AS SQL_Pass
          FROM [dbo].[tbl_Company]
          WHERE Local_Comp_Id = @Id
        `);

        if (result.recordset.length > 0) {
          dbDetails = result.recordset[0];
          Tally_Company_Id = dbDetails.Tally_Company_Id || null;
          Tally_Guid = dbDetails.Tally_Guid || null;
        }
      } catch (dbErr) {
        console.warn("Failed to retrieve company metadata from portal DB:", dbErr.message);
      }
    }

    // 2. Resolve credentials: Prioritize .env variables, fallback to DB if not found
    const envConfig = getCompanyConfigFromEnv(Db);

    let serverStr = null;
    if (envConfig) {
      serverStr = envConfig.host;
      config.database = envConfig.database;
      config.user = envConfig.user;
      config.password = envConfig.password;
    } else if (dbDetails) {
      serverStr = dbDetails.IP_Address;
      config.database = dbDetails.SQL_DB_Name;
      config.user = dbDetails.SQL_User_Name;
      config.password = dbDetails.SQL_Pass;
    } else {
      return failed(res, 'Invalid Db Id or Database Config Missing');
    }

    parseServerStr(serverStr, config);

    config.Tally_Company_Id = Tally_Company_Id;
    config.Tally_Guid = Tally_Guid;

    // 3. Retrieve or create cached connection pool
    let activePool = connectionPools.get(Db);

    if (!activePool) {
      let pool = new sql.ConnectionPool(config);
      try {
        activePool = await pool.connect();
      } catch (poolErr) {
        // Fallback: If primary database server is offline (e.g. timeout on 122.165.240.65 or 192.168.1.52),
        // try to connect to the active test server (103.14.120.9) mapping the database name appropriately
        const currentServer = config.server;
        if (currentServer !== "103.14.120.9") {
          console.warn(`[otherDB] Connection to primary server ${currentServer} failed: ${poolErr.message}. Attempting fallback to test server 103.14.120.9...`);
          
          let fallbackDatabase = config.database;
          if (process.env.DB_NAME_MAPPING) {
            const mappings = process.env.DB_NAME_MAPPING.split(',');
            for (const m of mappings) {
              const [dbName, idStr] = m.split('=');
              if (idStr === String(Db)) {
                fallbackDatabase = dbName;
                break;
              }
            }
          }

          const fallbackConfig = {
            ...config,
            server: "103.14.120.9",
            database: fallbackDatabase,
            user: "SMT_ADMIN",
            password: "yvKj3699^"
          };
          delete fallbackConfig.port;
          if (fallbackConfig.options) {
            delete fallbackConfig.options.instanceName;
          }
          pool = new sql.ConnectionPool(fallbackConfig);
          activePool = await pool.connect();
          config = fallbackConfig; // Sync config for downstream operations
        } else {
          throw poolErr;
        }
      }

      // Ensure the report settings tables exist on first connect
      await ensureReportTablesExist(activePool);

      // Override pool.close to do nothing so it's not closed by controller finally blocks
      activePool.close = () => Promise.resolve();

      // Listen for pool connection errors and remove from cache so it gets re-created
      activePool.on('error', (err) => {
        console.error(`Database pool error for Company ID ${Db}:`, err);
        connectionPools.delete(Db);
      });

      connectionPools.set(Db, activePool);
    }

    // 4. Set configs on request object
    req.db = activePool;
    req.dbID = Db;
    req.config = config;

    // 5. Run downstream controllers within AsyncLocalStorage context
    asyncLocalStorage.run(activePool, () => {
      next();
    });

  } catch (e) {
    if (req.path && req.path.includes('/userAuth')) {
      req.db = null;
      req.dbError = e.message;
      return next();
    }
    return servError(e, res, 'Db connection Failed');
  }
};

const ensureReportTablesExist = async (pool) => {
  try {
    const request = new sql.Request(pool);

    // 1. Check/create tbl_reports_userrights
    try {
      await request.query(`
        IF OBJECT_ID('tbl_reports_userrights') IS NULL
        BEGIN
          CREATE TABLE tbl_reports_userrights (
            user_id INT NOT NULL,
            menu_id INT NOT NULL,
            user_type_id INT NULL
          );
        END
        ELSE IF COL_LENGTH('tbl_reports_userrights', 'user_type_id') IS NULL
        BEGIN
          ALTER TABLE tbl_reports_userrights ADD user_type_id INT NULL;
        END

        IF OBJECT_ID('tbl_reports_usertype_rights') IS NULL
        BEGIN
          CREATE TABLE tbl_reports_usertype_rights (
            user_type_id INT NOT NULL,
            menu_id INT NOT NULL
          );
        END
      `);
    } catch (e) {
      console.warn("Failed to ensure tbl_reports_userrights or tbl_reports_usertype_rights:", e.message);
    }

    // 2. Check/create tbl_ERP_Report
    try {
      await request.query(`
        IF OBJECT_ID('tbl_ERP_Report') IS NULL
        BEGIN
          CREATE TABLE tbl_ERP_Report (
            Report_Id INT IDENTITY(1,1) PRIMARY KEY,
            Report_Name NVARCHAR(150) NULL,
            Parent_Report NVARCHAR(150) NULL,
            CreatedBy INT NULL,
            CreatedAt DATETIME NULL
          );
          BEGIN TRY
            SET IDENTITY_INSERT tbl_ERP_Report ON;
            INSERT INTO tbl_ERP_Report (Report_Id, Report_Name, Parent_Report, CreatedBy, CreatedAt)
            SELECT Report_Id, Report_Name, Parent_Report, CreatedBy, CreatedAt 
            FROM [ERP_LIVE_DB_PUKAL_FOODS].[dbo].[tbl_ERP_Report];
            SET IDENTITY_INSERT tbl_ERP_Report OFF;
          END TRY
          BEGIN CATCH
            -- Fallback if Pukal Foods DB is not available
            INSERT INTO tbl_ERP_Report (Report_Name, Parent_Report, CreatedBy, CreatedAt)
            VALUES 
            ('Ref Broker wise', 'SALES REPORT LOL', 1, GETDATE()),
            ('Retailer wise', 'SALES REPORT LOL', 1, GETDATE()),
            ('Beat wise ', 'SALES REPORT LOL', 1, GETDATE()),
            ('Brand Wise', 'SALES REPORT LOL', 1, GETDATE());
          END CATCH
        END
      `);
    } catch (e) {
      console.warn("Failed to ensure tbl_ERP_Report:", e.message);
    }

    // 3. Check/create tbl_ERP_ReportType
    try {
      await request.query(`
        IF OBJECT_ID('tbl_ERP_ReportType') IS NULL
        BEGIN
          CREATE TABLE tbl_ERP_ReportType (
            Type_Id INT IDENTITY(1,1) PRIMARY KEY,
            Report_Id INT NOT NULL,
            Report_Type NVARCHAR(50) NOT NULL
          );
          BEGIN TRY
            SET IDENTITY_INSERT tbl_ERP_ReportType ON;
            INSERT INTO tbl_ERP_ReportType (Type_Id, Report_Id, Report_Type)
            SELECT Type_Id, Report_Id, Report_Type 
            FROM [ERP_LIVE_DB_PUKAL_FOODS].[dbo].[tbl_ERP_ReportType];
            SET IDENTITY_INSERT tbl_ERP_ReportType OFF;
          END TRY
          BEGIN CATCH
            -- Fallback if Pukal Foods DB is not available
            INSERT INTO tbl_ERP_ReportType (Report_Id, Report_Type)
            VALUES 
            (1, 'Sales Order'),
            (2, 'Sales Invoice'),
            (3, 'Receipt Voucher');
          END CATCH
        END
      `);
    } catch (e) {
      console.warn("Failed to ensure tbl_ERP_ReportType:", e.message);
    }

    // 4. Check/create tbl_ERP_Report_Fileds
    try {
      await request.query(`
        IF OBJECT_ID('tbl_ERP_Report_Fileds') IS NULL
        BEGIN
          CREATE TABLE tbl_ERP_Report_Fileds (
            Report_Id INT NULL,
            Field_Id INT NULL,
            Field_Name NVARCHAR(150) NULL,
            Fied_Data NVARCHAR(50) NULL,
            Enable_By INT NULL,
            Order_By INT NULL,
            Group_By INT NULL,
            Type_Id INT NOT NULL
          );
          BEGIN TRY
            INSERT INTO tbl_ERP_Report_Fileds (Report_Id, Field_Id, Field_Name, Fied_Data, Enable_By, Order_By, Group_By, Type_Id)
            SELECT Report_Id, Field_Id, Field_Name, Fied_Data, Enable_By, Order_By, Group_By, Type_Id 
            FROM [ERP_LIVE_DB_PUKAL_FOODS].[dbo].[tbl_ERP_Report_Fileds];
          END TRY
          BEGIN CATCH
            -- Fallback if Pukal Foods DB is not available
          END CATCH
        END
      `);
    } catch (e) {
      console.warn("Failed to ensure tbl_ERP_Report_Fileds:", e.message);
    }

    // 5. Check/create tbl_Report_OverAll_Group
    try {
      await request.query(`
        IF OBJECT_ID('tbl_Report_OverAll_Group') IS NULL
        BEGIN
          CREATE TABLE tbl_Report_OverAll_Group (
            Id BIGINT IDENTITY(1,1) PRIMARY KEY,
            GroupName NVARCHAR(50) NULL,
            Created_By DATETIME2 NULL
          );
          INSERT INTO tbl_Report_OverAll_Group (GroupName)
          VALUES ('INWARDS'), ('PROCESS'), ('OUTWARDS');
        END
      `);
    } catch (e) {
      console.warn("Failed to ensure tbl_Report_OverAll_Group:", e.message);
    }

    // 6. Check/create tbl_Repots_EmployeeReport_Group
    try {
      await request.query(`
        IF OBJECT_ID('tbl_Repots_EmployeeReport_Group') IS NULL
        BEGIN
          CREATE TABLE tbl_Repots_EmployeeReport_Group (
            Id BIGINT IDENTITY(1,1) PRIMARY KEY,
            Group_Name NVARCHAR(50) NULL,
            Overall_GroupId BIGINT NULL,
            VoucherId BIGINT NULL,
            Created_By BIGINT NULL,
            Created_At DATETIME NULL,
            Updated_By BIGINT NULL,
            Updated_At DATETIME NULL
          );
        END
      `);
    } catch (e) {
      console.warn("Failed to ensure tbl_Repots_EmployeeReport_Group:", e.message);
    }

    // 7. Check/create tbl_SalesStockGodown (with migration if created_at is bigint)
    try {
      await request.query(`
        IF OBJECT_ID('tbl_SalesStockGodown') IS NOT NULL
        BEGIN
          DECLARE @colType NVARCHAR(50);
          SELECT @colType = t.name 
          FROM sys.columns c
          JOIN sys.types t ON c.user_type_id = t.user_type_id
          WHERE c.object_id = OBJECT_ID('tbl_SalesStockGodown') AND c.name = 'created_at';
          
          IF @colType = 'bigint'
          BEGIN
            DROP TABLE tbl_SalesStockGodown;
          END
        END

        IF OBJECT_ID('tbl_SalesStockGodown') IS NULL
        BEGIN
          CREATE TABLE tbl_SalesStockGodown (
            Id BIGINT IDENTITY(1,1) PRIMARY KEY,
            SalesStockGroup NVARCHAR(100) NULL,
            SaleStock NVARCHAR(100) NULL,
            Godown_Id BIGINT NULL,
            created_by BIGINT NULL,
            created_at DATETIME NULL
          );
        END
      `);
    } catch (e) {
      console.warn("Failed to ensure tbl_SalesStockGodown:", e.message);
    }

  } catch (err) {
    console.error("Failed to ensure report tables exist:", err.message);
  }
};

export default dbconnect;