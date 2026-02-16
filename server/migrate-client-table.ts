/**
 * Migration script: Drop existing POR table and recreate with 3 new columns
 * New columns: COOP, Conflict, [Linked Projects]
 * Then bulk import data from CSV file
 */

import sql from 'mssql';
import fs from 'fs';
import path from 'path';

function parseConnectionUrl(url: string): sql.config {
  if (url.startsWith('mssql://') || url.startsWith('sqlserver://')) {
    const parsed = new URL(url.replace('mssql://', 'http://').replace('sqlserver://', 'http://'));
    return {
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      server: parsed.hostname,
      port: parseInt(parsed.port) || 1433,
      database: parsed.pathname.replace('/', ''),
      options: {
        encrypt: true,
        trustServerCertificate: true,
        enableArithAbort: true,
        connectTimeout: 30000,
        requestTimeout: 120000,
      },
      pool: { max: 10, min: 0 }
    };
  }

  const config: sql.config = {
    server: '',
    database: '',
    user: '',
    password: '',
    port: 1433,
    options: {
      encrypt: true,
      trustServerCertificate: true,
      enableArithAbort: true,
      connectTimeout: 30000,
      requestTimeout: 120000,
    },
    pool: { max: 10, min: 0 }
  };

  const parts = url.split(';');
  for (const part of parts) {
    const eqIndex = part.indexOf('=');
    if (eqIndex === -1) continue;
    const key = part.substring(0, eqIndex).trim().toLowerCase();
    const value = part.substring(eqIndex + 1).trim();

    if (key === 'server' || key === 'data source') {
      if (value.includes(',')) {
        const [server, port] = value.split(',');
        config.server = server;
        config.port = parseInt(port) || 1433;
      } else {
        config.server = value;
      }
    } else if (key === 'database' || key === 'initial catalog') {
      config.database = value;
    } else if (key === 'user id' || key === 'uid' || key === 'user') {
      config.user = value;
    } else if (key === 'password' || key === 'pwd') {
      config.password = value;
    } else if (key === 'port') {
      config.port = parseInt(value) || 1433;
    }
  }

  return config;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

async function migrate() {
  const CLIENT_MSSQL_URL = process.env.CLIENT_MSSQL_URL;
  const TABLE_NAME = process.env.CLIENT_TABLE_NAME || 'POR';

  if (!CLIENT_MSSQL_URL) {
    console.error('CLIENT_MSSQL_URL not set');
    process.exit(1);
  }

  console.log(`Connecting to MS SQL Server...`);
  const config = parseConnectionUrl(CLIENT_MSSQL_URL);
  const pool = new sql.ConnectionPool(config);
  await pool.connect();
  console.log('Connected successfully.');

  const csvPath = path.resolve('attached_assets/ChatBotData_CoOp_Conflict_LP_1771229608541.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n').filter(l => l.trim().length > 0);

  const headerLine = lines[0].replace(/^\uFEFF/, '');
  const headers = parseCSVLine(headerLine);
  console.log(`CSV has ${headers.length} columns: ${headers.join(', ')}`);
  console.log(`Total data rows: ${lines.length - 1}`);

  console.log(`\nStep 1: Dropping existing table [${TABLE_NAME}]...`);
  try {
    await pool.request().query(`IF OBJECT_ID('${TABLE_NAME}', 'U') IS NOT NULL DROP TABLE [${TABLE_NAME}]`);
    console.log('Table dropped (or did not exist).');
  } catch (err: any) {
    console.log(`Drop warning: ${err.message}`);
  }

  console.log(`\nStep 2: Creating new table [${TABLE_NAME}] with ${headers.length} columns...`);
  const createSQL = `
    CREATE TABLE [${TABLE_NAME}] (
      [COOP] INT NULL,
      [Conflict] INT NULL,
      [Linked Projects] INT NULL,
      [RequestCategory] NVARCHAR(500) NULL,
      [Title] NVARCHAR(1000) NULL,
      [CRMCompanyTitle] NVARCHAR(500) NULL,
      [Company] NVARCHAR(500) NULL,
      [ModuleName] NVARCHAR(200) NULL,
      [StatusChoice] NVARCHAR(200) NULL,
      [ProjectType] NVARCHAR(500) NULL,
      [ConstStartDate] DATE NULL,
      [Comments] NVARCHAR(MAX) NULL,
      [Closed] BIT NULL,
      [ClosedDate] DATE NULL,
      [Deleted] BIT NULL,
      [ChanceOfSuccess] INT NULL,
      [ServiceType] NVARCHAR(500) NULL,
      [Description] NVARCHAR(MAX) NULL,
      [PointOfContact] NVARCHAR(500) NULL,
      [Fee] DECIMAL(18,2) NULL,
      [InterestedUserNames] NVARCHAR(MAX) NULL,
      [IsStrategicProject] BIT NULL,
      [Division] NVARCHAR(500) NULL,
      [Department] NVARCHAR(500) NULL,
      [Region] NVARCHAR(500) NULL,
      [Country] NVARCHAR(500) NULL,
      [State] NVARCHAR(500) NULL,
      [Address] NVARCHAR(1000) NULL,
      [Zip] NVARCHAR(50) NULL,
      [ProposalDate] DATE NULL,
      [ProjectDuration] INT NULL,
      [City] NVARCHAR(500) NULL,
      [ContractDate] DATE NULL,
      [GoProbability] NVARCHAR(100) NULL,
      [GetPercent] NVARCHAR(100) NULL,
      [Currency] NVARCHAR(10) NULL,
      [TenantName] NVARCHAR(100) NULL
    )
  `;
  await pool.request().query(createSQL);
  console.log('Table created successfully.');

  console.log(`\nStep 3: Importing data in batches...`);
  const BATCH_SIZE = 500;
  let totalInserted = 0;
  let errors = 0;

  for (let batchStart = 1; batchStart < lines.length; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, lines.length);
    const table = new sql.Table(TABLE_NAME);
    table.create = false;

    table.columns.add('COOP', sql.Int, { nullable: true });
    table.columns.add('Conflict', sql.Int, { nullable: true });
    table.columns.add('Linked Projects', sql.Int, { nullable: true });
    table.columns.add('RequestCategory', sql.NVarChar(500), { nullable: true });
    table.columns.add('Title', sql.NVarChar(1000), { nullable: true });
    table.columns.add('CRMCompanyTitle', sql.NVarChar(500), { nullable: true });
    table.columns.add('Company', sql.NVarChar(500), { nullable: true });
    table.columns.add('ModuleName', sql.NVarChar(200), { nullable: true });
    table.columns.add('StatusChoice', sql.NVarChar(200), { nullable: true });
    table.columns.add('ProjectType', sql.NVarChar(500), { nullable: true });
    table.columns.add('ConstStartDate', sql.Date, { nullable: true });
    table.columns.add('Comments', sql.NVarChar(sql.MAX), { nullable: true });
    table.columns.add('Closed', sql.Bit, { nullable: true });
    table.columns.add('ClosedDate', sql.Date, { nullable: true });
    table.columns.add('Deleted', sql.Bit, { nullable: true });
    table.columns.add('ChanceOfSuccess', sql.Int, { nullable: true });
    table.columns.add('ServiceType', sql.NVarChar(500), { nullable: true });
    table.columns.add('Description', sql.NVarChar(sql.MAX), { nullable: true });
    table.columns.add('PointOfContact', sql.NVarChar(500), { nullable: true });
    table.columns.add('Fee', sql.Decimal(18, 2), { nullable: true });
    table.columns.add('InterestedUserNames', sql.NVarChar(sql.MAX), { nullable: true });
    table.columns.add('IsStrategicProject', sql.Bit, { nullable: true });
    table.columns.add('Division', sql.NVarChar(500), { nullable: true });
    table.columns.add('Department', sql.NVarChar(500), { nullable: true });
    table.columns.add('Region', sql.NVarChar(500), { nullable: true });
    table.columns.add('Country', sql.NVarChar(500), { nullable: true });
    table.columns.add('State', sql.NVarChar(500), { nullable: true });
    table.columns.add('Address', sql.NVarChar(1000), { nullable: true });
    table.columns.add('Zip', sql.NVarChar(50), { nullable: true });
    table.columns.add('ProposalDate', sql.Date, { nullable: true });
    table.columns.add('ProjectDuration', sql.Int, { nullable: true });
    table.columns.add('City', sql.NVarChar(500), { nullable: true });
    table.columns.add('ContractDate', sql.Date, { nullable: true });
    table.columns.add('GoProbability', sql.NVarChar(100), { nullable: true });
    table.columns.add('GetPercent', sql.NVarChar(100), { nullable: true });
    table.columns.add('Currency', sql.NVarChar(10), { nullable: true });
    table.columns.add('TenantName', sql.NVarChar(100), { nullable: true });

    for (let i = batchStart; i < batchEnd; i++) {
      try {
        const fields = parseCSVLine(lines[i]);
        if (fields.length < 37) continue;

        const parseIntVal = (v: string) => {
          if (!v || v === 'NULL' || v === '') return null;
          const n = parseInt(v);
          return isNaN(n) ? null : n;
        };
        const parseDecimal = (v: string) => {
          if (!v || v === 'NULL' || v === '') return null;
          const n = parseFloat(v);
          return isNaN(n) ? null : n;
        };
        const parseDate = (v: string) => {
          if (!v || v === 'NULL' || v === '' || v === '1/1/1900') return null;
          const d = new Date(v);
          return isNaN(d.getTime()) ? null : d;
        };
        const parseBit = (v: string) => {
          if (!v || v === 'NULL' || v === '') return null;
          if (v === 'TRUE' || v === 'true' || v === '1') return true;
          if (v === 'FALSE' || v === 'false' || v === '0') return false;
          return null;
        };
        const parseStr = (v: string) => {
          if (!v || v === 'NULL') return null;
          return v;
        };

        table.rows.add(
          parseIntVal(fields[0]),   // COOP
          parseIntVal(fields[1]),   // Conflict
          parseIntVal(fields[2]),   // Linked Projects
          parseStr(fields[3]),      // RequestCategory
          parseStr(fields[4]),      // Title
          parseStr(fields[5]),      // CRMCompanyTitle
          parseStr(fields[6]),      // Company
          parseStr(fields[7]),      // ModuleName
          parseStr(fields[8]),      // StatusChoice
          parseStr(fields[9]),      // ProjectType
          parseDate(fields[10]),    // ConstStartDate
          parseStr(fields[11]),     // Comments
          parseBit(fields[12]),     // Closed
          parseDate(fields[13]),    // ClosedDate
          parseBit(fields[14]),     // Deleted
          parseIntVal(fields[15]),  // ChanceOfSuccess
          parseStr(fields[16]),     // ServiceType
          parseStr(fields[17]),     // Description
          parseStr(fields[18]),     // PointOfContact
          parseDecimal(fields[19]), // Fee
          parseStr(fields[20]),     // InterestedUserNames
          parseBit(fields[21]),     // IsStrategicProject
          parseStr(fields[22]),     // Division
          parseStr(fields[23]),     // Department
          parseStr(fields[24]),     // Region
          parseStr(fields[25]),     // Country
          parseStr(fields[26]),     // State
          parseStr(fields[27]),     // Address
          parseStr(fields[28]),     // Zip
          parseDate(fields[29]),    // ProposalDate
          parseIntVal(fields[30]),  // ProjectDuration
          parseStr(fields[31]),     // City
          parseDate(fields[32]),    // ContractDate
          parseStr(fields[33]),     // GoProbability
          parseStr(fields[34]),     // GetPercent
          parseStr(fields[35]),     // Currency
          parseStr(fields[36]),     // TenantName
        );
      } catch (rowErr: any) {
        errors++;
        if (errors <= 5) console.log(`  Row ${i} error: ${rowErr.message}`);
      }
    }

    try {
      const request = pool.request();
      await request.bulk(table);
      totalInserted += table.rows.length;
      console.log(`  Inserted batch ${Math.ceil(batchStart / BATCH_SIZE)}: rows ${batchStart}-${batchEnd - 1} (${table.rows.length} rows, total: ${totalInserted})`);
    } catch (bulkErr: any) {
      console.error(`  Batch error at rows ${batchStart}-${batchEnd - 1}: ${bulkErr.message}`);
      errors++;
    }
  }

  console.log(`\n--- Migration Complete ---`);
  console.log(`Total rows inserted: ${totalInserted}`);
  console.log(`Errors: ${errors}`);

  const countResult = await pool.request().query(`SELECT COUNT(*) as cnt FROM [${TABLE_NAME}]`);
  console.log(`Verification: ${countResult.recordset[0].cnt} rows in [${TABLE_NAME}]`);

  const sampleResult = await pool.request().query(`SELECT TOP 3 [COOP], [Conflict], [Linked Projects], [Title], [Company], [Fee] FROM [${TABLE_NAME}]`);
  console.log('\nSample rows:');
  sampleResult.recordset.forEach((r: any, i: number) => {
    console.log(`  ${i + 1}. COOP=${r.COOP}, Conflict=${r.Conflict}, LinkedProjects=${r['Linked Projects']}, Title="${r.Title?.substring(0, 40)}...", Company=${r.Company}, Fee=${r.Fee}`);
  });

  await pool.close();
  console.log('\nDone. Connection closed.');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
