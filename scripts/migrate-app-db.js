const sql = require('mssql');

// ============================================================
// RMOne App Database Migration Script
// Copies all app tables from AWS RDS to Windows VM SQL Server
// ============================================================
// 
// USAGE:
//   1. Edit SOURCE_CONNECTION and TARGET_CONNECTION below
//   2. Run: node migrate-app-db.js
//
// This script will:
//   - Connect to both source (AWS RDS) and target (Windows VM) SQL Servers
//   - Create the target database if it doesn't exist
//   - Create all 7 app tables on the target
//   - Copy all data from source to target
// ============================================================

// ---- EDIT THESE CONNECTION STRINGS ----

// SOURCE: AWS RDS (old location)
const SOURCE_CONNECTION = process.env.APP_MSSQL_URL || 'Server=rmchatbot.c4f40eea0sit.us-east-1.rds.amazonaws.com,1433;Database=rmchatbot_app;User Id=admin;Password=rmone8723;Encrypt=true;TrustServerCertificate=true;';

// TARGET: Windows VM (new location)
const TARGET_CONNECTION = process.env.TARGET_MSSQL_URL || 'Server=AWS-VM36,1433;Database=rmchatbot;User Id=CB-SA-App;Password=P@$$word@321;TrustServerCertificate=true;Encrypt=true;';

// ---- DO NOT EDIT BELOW THIS LINE ----

function parseConnectionString(connectionString) {
  const config = {
    server: '',
    options: {
      encrypt: true,
      trustServerCertificate: true,
      enableArithAbort: true,
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    requestTimeout: 120000,
  };

  const parts = connectionString.split(';');
  for (const part of parts) {
    const [key, ...valueParts] = part.split('=');
    const value = valueParts.join('=');
    const keyLower = key?.toLowerCase().trim();

    if (keyLower === 'server' || keyLower === 'data source') {
      const [server, port] = value.split(',');
      config.server = server;
      if (port) config.port = parseInt(port, 10);
    } else if (keyLower === 'database' || keyLower === 'initial catalog') {
      config.database = value;
    } else if (keyLower === 'user id' || keyLower === 'uid') {
      config.user = value;
    } else if (keyLower === 'password' || keyLower === 'pwd') {
      config.password = value;
    } else if (keyLower === 'port') {
      config.port = parseInt(value, 10);
    }
  }

  if (!config.port) config.port = 1433;
  return config;
}

const TABLE_DEFINITIONS = [
  {
    name: 'sessions',
    create: `
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'sessions')
      CREATE TABLE sessions (
        sid NVARCHAR(255) PRIMARY KEY,
        sess NVARCHAR(MAX) NOT NULL,
        expire DATETIME2 NOT NULL
      );
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IDX_session_expire')
      CREATE INDEX IDX_session_expire ON sessions(expire);
    `,
    columns: 'sid, sess, expire',
  },
  {
    name: 'users',
    create: `
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'users')
      CREATE TABLE users (
        id NVARCHAR(255) PRIMARY KEY DEFAULT NEWID(),
        email NVARCHAR(255) UNIQUE NOT NULL,
        password_hash NVARCHAR(255) NOT NULL,
        first_name NVARCHAR(255),
        last_name NVARCHAR(255),
        profile_image_url NVARCHAR(500),
        role NVARCHAR(50) DEFAULT 'user',
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE()
      );
    `,
    columns: 'id, email, password_hash, first_name, last_name, profile_image_url, role, created_at, updated_at',
  },
  {
    name: 'chats',
    create: `
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'chats')
      CREATE TABLE chats (
        id NVARCHAR(255) PRIMARY KEY,
        session_id NVARCHAR(255) NOT NULL,
        title NVARCHAR(MAX) NOT NULL,
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE(),
        faq_category NVARCHAR(255)
      );
    `,
    columns: 'id, session_id, title, created_at, updated_at, faq_category',
  },
  {
    name: 'messages',
    create: `
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'messages')
      CREATE TABLE messages (
        id NVARCHAR(255) PRIMARY KEY,
        chat_id NVARCHAR(255) NOT NULL,
        type NVARCHAR(50) NOT NULL,
        content NVARCHAR(MAX) NOT NULL,
        timestamp DATETIME2 DEFAULT GETDATE(),
        response NVARCHAR(MAX),
        ai_analysis_messages NVARCHAR(MAX),
        is_faq BIT DEFAULT 0,
        faq_category NVARCHAR(255),
        faq_display_text NVARCHAR(MAX),
        user_id NVARCHAR(255)
      );
    `,
    columns: 'id, chat_id, type, content, timestamp, response, ai_analysis_messages, is_faq, faq_category, faq_display_text, user_id',
  },
  {
    name: 'error_logs',
    create: `
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'error_logs')
      CREATE TABLE error_logs (
        id NVARCHAR(255) PRIMARY KEY,
        session_id NVARCHAR(255) NOT NULL,
        user_id NVARCHAR(255),
        user_email NVARCHAR(255),
        chat_id NVARCHAR(255) NOT NULL,
        message_id NVARCHAR(255),
        question NVARCHAR(MAX) NOT NULL,
        error_message NVARCHAR(MAX),
        user_comment NVARCHAR(MAX) NOT NULL,
        developer_comment NVARCHAR(MAX),
        status NVARCHAR(50) DEFAULT 'pending',
        screenshot_filename NVARCHAR(255),
        screenshot_url NVARCHAR(500),
        created_at DATETIME2 DEFAULT GETDATE()
      );
    `,
    columns: 'id, session_id, user_id, user_email, chat_id, message_id, question, error_message, user_comment, developer_comment, status, screenshot_filename, screenshot_url, created_at',
  },
  {
    name: 'user_hidden_faqs',
    create: `
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'user_hidden_faqs')
      CREATE TABLE user_hidden_faqs (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id NVARCHAR(255) NOT NULL,
        faq_text NVARCHAR(MAX) NOT NULL,
        created_at DATETIME2 DEFAULT GETDATE()
      );
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IDX_user_hidden_faqs_user_id')
      CREATE INDEX IDX_user_hidden_faqs_user_id ON user_hidden_faqs(user_id);
    `,
    columns: 'user_id, faq_text, created_at',
    hasIdentity: true,
  },
  {
    name: 'embed_links',
    create: `
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='embed_links' AND xtype='U')
      CREATE TABLE embed_links (
        id VARCHAR(255) PRIMARY KEY,
        embed_id VARCHAR(255) NOT NULL UNIQUE,
        role VARCHAR(50) NOT NULL,
        allowed_domain VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_by VARCHAR(255) NOT NULL,
        created_by_email VARCHAR(255) NOT NULL,
        is_active BIT DEFAULT 1,
        created_at DATETIME2 DEFAULT GETUTCDATE(),
        last_used_at DATETIME2 NULL
      );
    `,
    columns: 'id, embed_id, role, allowed_domain, name, created_by, created_by_email, is_active, created_at, last_used_at',
  },
];

async function migrate() {
  let sourcePool = null;
  let targetPool = null;

  try {
    console.log('========================================');
    console.log('  RMOne App Database Migration Script');
    console.log('========================================\n');

    // Connect to source (AWS RDS)
    console.log('[1/4] Connecting to SOURCE database (AWS RDS)...');
    const sourceConfig = parseConnectionString(SOURCE_CONNECTION);
    sourcePool = await new sql.ConnectionPool(sourceConfig).connect();
    console.log(`  Connected to: ${sourceConfig.server} / ${sourceConfig.database}\n`);

    // Connect to target (Windows VM)
    console.log('[2/4] Connecting to TARGET database (Windows VM)...');
    const targetConfig = parseConnectionString(TARGET_CONNECTION);

    // First connect to master to create the database if needed
    const masterConfig = { ...targetConfig, database: 'master' };
    const masterPool = await new sql.ConnectionPool(masterConfig).connect();
    const dbName = targetConfig.database || 'rmchatbot_app';
    await masterPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = '${dbName}')
      CREATE DATABASE [${dbName}];
    `);
    console.log(`  Database '${dbName}' ready.`);
    await masterPool.close();

    targetPool = await new sql.ConnectionPool(targetConfig).connect();
    console.log(`  Connected to: ${targetConfig.server} / ${targetConfig.database}\n`);

    // Create tables on target
    console.log('[3/4] Creating tables on target...');
    for (const table of TABLE_DEFINITIONS) {
      try {
        await targetPool.request().query(table.create);
        console.log(`  Table '${table.name}' ready.`);
      } catch (err) {
        console.log(`  Table '${table.name}' - ${err.message}`);
      }
    }
    console.log('');

    // Copy data
    console.log('[4/4] Copying data...\n');
    let totalRows = 0;

    for (const table of TABLE_DEFINITIONS) {
      try {
        // Check if source table exists and has data
        const countResult = await sourcePool.request().query(
          `IF EXISTS (SELECT * FROM sys.tables WHERE name = '${table.name}')
           SELECT COUNT(*) as cnt FROM [${table.name}]
           ELSE SELECT 0 as cnt`
        );
        const rowCount = countResult.recordset[0].cnt;

        if (rowCount === 0) {
          console.log(`  ${table.name}: 0 rows (skipped)`);
          continue;
        }

        // Clear existing data in target (to avoid duplicates on re-run)
        try {
          await targetPool.request().query(`DELETE FROM [${table.name}]`);
        } catch (e) {}

        // Read all data from source
        const data = await sourcePool.request().query(`SELECT ${table.columns} FROM [${table.name}]`);
        const rows = data.recordset;

        if (rows.length === 0) {
          console.log(`  ${table.name}: 0 rows (skipped)`);
          continue;
        }

        // Insert in batches of 100
        const batchSize = 100;
        let inserted = 0;
        const columns = table.columns.split(',').map(c => c.trim());

        // Enable identity insert if needed
        if (table.hasIdentity) {
          try {
            await targetPool.request().query(`SET IDENTITY_INSERT [${table.name}] ON`);
          } catch (e) {}
        }

        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          
          for (const row of batch) {
            try {
              const request = targetPool.request();
              const paramNames = [];
              
              for (const col of columns) {
                const paramName = col.replace(/[^a-zA-Z0-9_]/g, '');
                let value = row[col];
                if (value === undefined) value = null;
                request.input(paramName, value);
                paramNames.push(`@${paramName}`);
              }

              // For identity columns, include all columns including the ID
              const insertCols = table.hasIdentity 
                ? `id, ${table.columns}` 
                : table.columns;
              const insertParams = table.hasIdentity
                ? `@id_val, ${paramNames.join(', ')}`
                : paramNames.join(', ');

              if (table.hasIdentity && row.id !== undefined) {
                request.input('id_val', row.id);
              }

              await request.query(
                `INSERT INTO [${table.name}] (${table.hasIdentity ? insertCols : table.columns}) VALUES (${table.hasIdentity ? insertParams : paramNames.join(', ')})`
              );
              inserted++;
            } catch (rowErr) {
              // Skip duplicate key errors on re-run
              if (!rowErr.message.includes('duplicate') && !rowErr.message.includes('PRIMARY KEY')) {
                console.log(`    Warning: ${table.name} row error: ${rowErr.message.substring(0, 100)}`);
              }
            }
          }
        }

        // Disable identity insert
        if (table.hasIdentity) {
          try {
            await targetPool.request().query(`SET IDENTITY_INSERT [${table.name}] OFF`);
          } catch (e) {}
        }

        console.log(`  ${table.name}: ${inserted}/${rowCount} rows copied`);
        totalRows += inserted;
      } catch (tableErr) {
        console.log(`  ${table.name}: ERROR - ${tableErr.message.substring(0, 150)}`);
      }
    }

    console.log('\n========================================');
    console.log(`  Migration Complete!`);
    console.log(`  Total rows copied: ${totalRows}`);
    console.log('========================================');
    console.log('\nNext steps:');
    console.log('  1. Update APP_MSSQL_URL in your .env file to point to the Windows VM');
    console.log('  2. Restart the app: pm2 restart all');
    console.log('  3. Test login and chat functionality');

  } catch (error) {
    console.error('\nMIGRATION FAILED:', error.message);
    console.error('\nPlease check:');
    console.error('  - SOURCE_CONNECTION string is correct');
    console.error('  - TARGET_CONNECTION string is correct');
    console.error('  - Both SQL Servers are accessible from this machine');
    console.error('  - Firewall allows connections on port 1433');
  } finally {
    if (sourcePool) try { await sourcePool.close(); } catch (e) {}
    if (targetPool) try { await targetPool.close(); } catch (e) {}
    process.exit(0);
  }
}

migrate();
