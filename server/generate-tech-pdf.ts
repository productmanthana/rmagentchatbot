import PDFDocument from 'pdfkit';

export function generateTechnicalArchitecturePDF(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ 
      size: 'A4', 
      margins: { top: 60, bottom: 60, left: 60, right: 60 },
      info: {
        Title: 'RMOne AI Agents - Technical Architecture Documentation',
        Author: 'RMOne Engineering',
        Subject: 'Embed System Technical Specification'
      }
    });

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Colors
    const primary = '#1e40af';
    const secondary = '#3b82f6';
    const dark = '#111827';
    const medium = '#374151';
    const light = '#6b7280';
    const accent = '#059669';
    const warning = '#d97706';
    const bgLight = '#f8fafc';
    const border = '#e2e8f0';

    // Helper functions
    const drawLine = (y: number, color = border) => {
      doc.strokeColor(color).lineWidth(1).moveTo(60, y).lineTo(535, y).stroke();
    };

    const sectionTitle = (num: string, title: string) => {
      doc.moveDown(1.5);
      doc.fontSize(14).fillColor(primary).text(`${num}. ${title}`, { continued: false });
      doc.moveDown(0.3);
      drawLine(doc.y);
      doc.moveDown(0.8);
    };

    const subSection = (title: string) => {
      doc.moveDown(0.8);
      doc.fontSize(11).fillColor(secondary).text(title);
      doc.moveDown(0.4);
    };

    const paragraph = (text: string) => {
      doc.fontSize(10).fillColor(medium).text(text, { align: 'justify', lineGap: 2 });
      doc.moveDown(0.5);
    };

    const bullet = (text: string, indent = 0) => {
      doc.fontSize(10).fillColor(medium).text(`•  ${text}`, 70 + indent, doc.y, { lineGap: 2 });
      doc.moveDown(0.3);
    };

    const codeBlock = (code: string, lang = '') => {
      const startY = doc.y;
      const lines = code.split('\n');
      const height = lines.length * 14 + 20;
      
      doc.rect(60, startY, 475, height).fillColor('#1f2937').fill();
      doc.fontSize(9).fillColor('#e5e7eb');
      let y = startY + 10;
      lines.forEach(line => {
        doc.text(line, 70, y, { width: 455 });
        y += 14;
      });
      doc.y = startY + height + 10;
      doc.moveDown(0.3);
    };

    // ========== COVER PAGE ==========
    doc.rect(0, 0, 595, 842).fillColor(primary).fill();
    
    // White content area
    doc.rect(40, 40, 515, 762).fillColor('#ffffff').fill();
    
    // Header accent
    doc.rect(40, 40, 515, 8).fillColor(secondary).fill();
    
    // Title section
    doc.moveDown(8);
    doc.fontSize(32).fillColor(primary).text('RMOne AI Agents', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(18).fillColor(dark).text('Technical Architecture Documentation', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(12).fillColor(light).text('Embed Integration System Specification', { align: 'center' });
    
    // Version badge
    doc.moveDown(2);
    const badgeX = 220;
    doc.roundedRect(badgeX, doc.y, 150, 28, 14).fillColor('#dbeafe').fill();
    doc.fontSize(10).fillColor(primary).text('Version 2.0  |  January 2026', badgeX, doc.y - 20, { width: 150, align: 'center' });
    
    // Document info box
    doc.moveDown(6);
    const infoY = doc.y;
    doc.rect(80, infoY, 435, 120).fillColor(bgLight).fill();
    doc.rect(80, infoY, 4, 120).fillColor(primary).fill();
    
    doc.fontSize(11).fillColor(dark).text('Document Information', 100, infoY + 15);
    doc.fontSize(9).fillColor(medium);
    doc.text('Classification:', 100, infoY + 40);
    doc.text('Technical - Internal Use Only', 200, infoY + 40);
    doc.text('Target Audience:', 100, infoY + 58);
    doc.text('Development & Engineering Teams', 200, infoY + 58);
    doc.text('Last Updated:', 100, infoY + 76);
    doc.text('January 28, 2026', 200, infoY + 76);
    doc.text('Prepared By:', 100, infoY + 94);
    doc.text('RMOne Engineering Team', 200, infoY + 94);

    // Footer on cover
    doc.fontSize(9).fillColor(light).text('Confidential Document', 60, 750, { align: 'center', width: 475 });

    // ========== PAGE 2: TABLE OF CONTENTS ==========
    doc.addPage();
    
    doc.fontSize(20).fillColor(primary).text('Table of Contents', 60, 60);
    doc.moveDown(0.5);
    drawLine(doc.y, primary);
    doc.moveDown(1.5);

    const tocItems = [
      ['1', 'System Overview', '3'],
      ['2', 'Token Generation Architecture', '3'],
      ['3', 'Authentication Flow', '4'],
      ['4', 'Domain Restriction Mechanism', '5'],
      ['5', 'Role-Based Access Control', '6'],
      ['6', 'Session Management', '7'],
      ['7', 'Security Considerations', '7'],
      ['8', 'API Reference', '8'],
      ['9', 'Database Schema', '9'],
      ['10', 'Deployment Configuration', '10']
    ];

    tocItems.forEach(([num, title, page]) => {
      doc.fontSize(11).fillColor(dark).text(`${num}.`, 70, doc.y);
      doc.text(title, 90, doc.y - 13);
      doc.fillColor(light).text(page, 500, doc.y - 13, { align: 'right', width: 35 });
      doc.moveDown(0.6);
    });

    // ========== PAGE 3: SYSTEM OVERVIEW & TOKEN GENERATION ==========
    doc.addPage();
    
    doc.fontSize(9).fillColor(light).text('RMOne AI Agents - Technical Architecture', 60, 40);
    doc.text('Page 3', 500, 40);
    drawLine(55);

    sectionTitle('1', 'System Overview');
    
    paragraph('The RMOne AI Agents Embed System provides a secure, token-based authentication mechanism that enables external websites to integrate the AI-powered chatbot interface. The system is designed to operate within iframe contexts while maintaining strict security controls and domain-based access restrictions.');

    subSection('Core Components');
    bullet('Token Generation Service - Cryptographically secure identifier creation');
    bullet('Domain Validation Layer - Origin verification and subdomain matching');
    bullet('Role-Based Access Control - Granular permission management');
    bullet('Session Isolation - Independent chat history per embed instance');
    bullet('Token Store - In-memory authentication state management');

    sectionTitle('2', 'Token Generation Architecture');

    subSection('2.1 Token Specification');
    paragraph('Each embed link is assigned a unique 16-character alphanumeric token generated using the nanoid library with a cryptographically secure random number generator.');

    doc.moveDown(0.3);
    doc.fontSize(10).fillColor(dark).text('Token Properties:', 60, doc.y);
    doc.moveDown(0.5);
    
    // Properties table
    const props = [
      ['Length', '16 characters'],
      ['Character Set', 'A-Za-z0-9 (62 characters)'],
      ['Entropy', '~95 bits'],
      ['Collision Probability', '< 1 in 10^28'],
      ['Generation Method', 'crypto.getRandomValues()']
    ];
    
    props.forEach(([key, val], i) => {
      const y = doc.y;
      if (i % 2 === 0) doc.rect(60, y - 2, 475, 18).fillColor(bgLight).fill();
      doc.fontSize(9).fillColor(dark).text(key, 70, y);
      doc.fillColor(medium).text(val, 250, y);
      doc.moveDown(0.5);
    });

    subSection('2.2 Token Generation Code');
    codeBlock(`import { nanoid } from 'nanoid';

// Generate cryptographically secure 16-character token
const embedId = nanoid(16);

// Example output: "jgUSnbPDCMftMgPF"
// Stored in embed_links table as primary identifier`);

    subSection('2.3 Token Storage');
    paragraph('Tokens are stored in two locations:');
    bullet('Database: Permanent storage in embed_links table with metadata');
    bullet('Runtime Memory: Active tokens cached in embedTokenStore Map for fast validation');

    // ========== PAGE 4: AUTHENTICATION FLOW ==========
    doc.addPage();
    
    doc.fontSize(9).fillColor(light).text('RMOne AI Agents - Technical Architecture', 60, 40);
    doc.text('Page 4', 500, 40);
    drawLine(55);

    sectionTitle('3', 'Authentication Flow');

    subSection('3.1 Embed Initialization Sequence');
    paragraph('When an external website loads the embed iframe, the following authentication sequence occurs:');

    // Flow diagram
    const flowY = doc.y + 10;
    const steps = [
      { num: '1', title: 'Client Loads Iframe', desc: 'Parent website embeds iframe with embed ID in URL path' },
      { num: '2', title: 'Origin Detection', desc: 'Embed page detects parent window origin via document.referrer' },
      { num: '3', title: 'Token Validation', desc: 'POST /api/embed/validate with embedId and parentOrigin' },
      { num: '4', title: 'Domain Verification', desc: 'Server validates origin against allowed_domain in database' },
      { num: '5', title: 'Role Assignment', desc: 'Server returns role (superadmin/admin/user) for the embed' },
      { num: '6', title: 'Session Creation', desc: 'Client stores token in sessionStorage, creates embed session' }
    ];

    let stepY = flowY;
    steps.forEach((step, i) => {
      // Step number circle
      doc.circle(80, stepY + 10, 12).fillColor(primary).fill();
      doc.fontSize(10).fillColor('#ffffff').text(step.num, 76, stepY + 5);
      
      // Step content
      doc.fontSize(10).fillColor(dark).text(step.title, 100, stepY + 2);
      doc.fontSize(9).fillColor(medium).text(step.desc, 100, stepY + 15, { width: 420 });
      
      // Connector line
      if (i < steps.length - 1) {
        doc.strokeColor(border).lineWidth(2).moveTo(80, stepY + 22).lineTo(80, stepY + 42).stroke();
      }
      
      stepY += 45;
    });

    doc.y = stepY + 10;

    subSection('3.2 Token Transmission');
    paragraph('Unlike cookie-based authentication, embed tokens are transmitted via HTTP headers to bypass third-party cookie restrictions:');

    codeBlock(`// Client-side: All API requests include token header
const response = await fetch('/api/query', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Embed-Token': sessionStorage.getItem('embedToken')
  },
  body: JSON.stringify({ question: userQuery })
});`);

    // ========== PAGE 5: DOMAIN RESTRICTION ==========
    doc.addPage();
    
    doc.fontSize(9).fillColor(light).text('RMOne AI Agents - Technical Architecture', 60, 40);
    doc.text('Page 5', 500, 40);
    drawLine(55);

    sectionTitle('4', 'Domain Restriction Mechanism');

    subSection('4.1 Domain Validation Logic');
    paragraph('The domain restriction system provides flexible yet secure access control. When validating a request, the following checks are performed in order:');

    codeBlock(`// Domain validation algorithm
const requestDomain = parentOrigin.toLowerCase();
const allowedDomain = embedLink.allowed_domain.toLowerCase();

const isAllowed = 
  allowedDomain === '*' ||                          // Wildcard
  process.env.NODE_ENV === 'development' ||         // Dev mode
  !parentOrigin ||                                  // Direct access
  requestDomain === allowedDomain ||                // Exact match
  requestDomain.endsWith('.' + allowedDomain);      // Subdomain`);

    subSection('4.2 Matching Rules');
    
    // Rules table
    doc.moveDown(0.5);
    const rulesY = doc.y;
    doc.rect(60, rulesY, 475, 24).fillColor(primary).fill();
    doc.fontSize(9).fillColor('#ffffff');
    doc.text('Allowed Domain', 70, rulesY + 7);
    doc.text('Request Origin', 200, rulesY + 7);
    doc.text('Result', 370, rulesY + 7);
    doc.text('Rule Applied', 440, rulesY + 7);

    const rules = [
      ['rmone.com', 'rmone.com', 'ALLOWED', 'Exact Match'],
      ['rmone.com', 'portal.rmone.com', 'ALLOWED', 'Subdomain'],
      ['rmone.com', 'api.portal.rmone.com', 'ALLOWED', 'Nested Subdomain'],
      ['rmone.com', 'othersite.com', 'DENIED', 'No Match'],
      ['*', 'anysite.com', 'ALLOWED', 'Wildcard'],
      ['portal.rmone.com', 'rmone.com', 'DENIED', 'Parent Domain']
    ];

    let ruleY = rulesY + 24;
    rules.forEach((rule, i) => {
      if (i % 2 === 0) doc.rect(60, ruleY, 475, 20).fillColor(bgLight).fill();
      doc.rect(60, ruleY, 475, 20).strokeColor(border).stroke();
      doc.fontSize(8).fillColor(medium);
      doc.text(rule[0], 70, ruleY + 6);
      doc.text(rule[1], 200, ruleY + 6);
      doc.fillColor(rule[2] === 'ALLOWED' ? accent : '#dc2626').text(rule[2], 370, ruleY + 6);
      doc.fillColor(light).text(rule[3], 440, ruleY + 6);
      ruleY += 20;
    });

    doc.y = ruleY + 15;

    subSection('4.3 Subdomain Wildcard Behavior');
    paragraph('Setting the allowed domain to a root domain automatically permits all subdomains. This is achieved through suffix matching:');

    codeBlock(`// Subdomain matching implementation
const subdomainMatch = requestDomain.endsWith('.' + allowedDomain);

// Example: allowedDomain = "rmone.com"
// "portal.rmone.com".endsWith(".rmone.com") → true
// "staging.api.rmone.com".endsWith(".rmone.com") → true
// "rmone.com".endsWith(".rmone.com") → false (handled by exact match)`);

    // ========== PAGE 6: ROLE-BASED ACCESS CONTROL ==========
    doc.addPage();
    
    doc.fontSize(9).fillColor(light).text('RMOne AI Agents - Technical Architecture', 60, 40);
    doc.text('Page 6', 500, 40);
    drawLine(55);

    sectionTitle('5', 'Role-Based Access Control');

    subSection('5.1 Role Hierarchy');
    paragraph('The embed system implements a three-tier role hierarchy with progressively restrictive permissions:');

    // Role hierarchy diagram
    const roleY = doc.y + 10;
    
    // Superadmin
    doc.rect(60, roleY, 475, 45).fillColor('#fef3c7').fill();
    doc.rect(60, roleY, 4, 45).fillColor('#f59e0b').fill();
    doc.fontSize(11).fillColor(dark).text('SUPERADMIN', 75, roleY + 8);
    doc.fontSize(9).fillColor(medium).text('Full system access: All logs, FAQ management, chat editing, integration management', 75, roleY + 24);
    
    // Admin
    doc.rect(60, roleY + 55, 475, 45).fillColor('#dbeafe').fill();
    doc.rect(60, roleY + 55, 4, 45).fillColor(primary).fill();
    doc.fontSize(11).fillColor(dark).text('ADMIN', 75, roleY + 63);
    doc.fontSize(9).fillColor(medium).text('Elevated access: Own query logs, FAQ management, chat editing (no integration access)', 75, roleY + 79);
    
    // User
    doc.rect(60, roleY + 110, 475, 45).fillColor('#f0fdf4').fill();
    doc.rect(60, roleY + 110, 4, 45).fillColor(accent).fill();
    doc.fontSize(11).fillColor(dark).text('USER', 75, roleY + 118);
    doc.fontSize(9).fillColor(medium).text('Basic access: Chat interface only, view own chat history, no administrative features', 75, roleY + 134);

    doc.y = roleY + 170;

    subSection('5.2 Permission Matrix');
    
    const permY = doc.y;
    doc.rect(60, permY, 475, 24).fillColor(primary).fill();
    doc.fontSize(9).fillColor('#ffffff');
    doc.text('Feature', 70, permY + 7);
    doc.text('Superadmin', 250, permY + 7);
    doc.text('Admin', 340, permY + 7);
    doc.text('User', 420, permY + 7);

    const perms = [
      ['Chat with AI', '✓', '✓', '✓'],
      ['View Own Chat History', '✓', '✓', '✓'],
      ['Delete Own Chats', '✓', '✓', '✓'],
      ['View Query Logs', 'All Logs', 'Own Logs', '—'],
      ['FAQ Sample Management', '✓', '✓', '—'],
      ['Edit Chat Titles', '✓', '✓', '—'],
      ['Integration Management', '✓', '—', '—'],
      ['Logs Tab in Results', '✓', '✓', '—']
    ];

    let permRowY = permY + 24;
    perms.forEach((perm, i) => {
      if (i % 2 === 0) doc.rect(60, permRowY, 475, 20).fillColor(bgLight).fill();
      doc.rect(60, permRowY, 475, 20).strokeColor(border).stroke();
      doc.fontSize(8).fillColor(medium).text(perm[0], 70, permRowY + 6);
      doc.fillColor(perm[1] === '—' ? '#dc2626' : accent).text(perm[1], 250, permRowY + 6);
      doc.fillColor(perm[2] === '—' ? '#dc2626' : accent).text(perm[2], 340, permRowY + 6);
      doc.fillColor(perm[3] === '—' ? '#dc2626' : accent).text(perm[3], 420, permRowY + 6);
      permRowY += 20;
    });

    doc.y = permRowY + 15;

    subSection('5.3 Role Check Implementation');
    codeBlock(`// Server-side role validation
const embedData = embedTokenStore.get(embedToken);
const isAdmin = embedData.role === 'admin' || embedData.role === 'superadmin';
const isSuperadmin = embedData.role === 'superadmin';

// Client-side permission checks
const canViewLogsTab = isAdminOrAbove;
const canManageFAQ = isAdminOrAbove;
const canEditChat = isAdminOrAbove;`);

    // ========== PAGE 7: SESSION & SECURITY ==========
    doc.addPage();
    
    doc.fontSize(9).fillColor(light).text('RMOne AI Agents - Technical Architecture', 60, 40);
    doc.text('Page 7', 500, 40);
    drawLine(55);

    sectionTitle('6', 'Session Management');

    subSection('6.1 Session Isolation');
    paragraph('Each embed instance maintains an isolated session to prevent cross-contamination of chat data:');

    codeBlock(`// Embed user identification
const embedUserId = 'embed_' + embedId;  // e.g., "embed_jgUSnbPDCMftMgPF"

// Chat ownership
chat.userId = embedUserId;  // All chats scoped to this embed

// Session storage (client-side)
sessionStorage.setItem('embedToken', embedId);
sessionStorage.setItem('embedRole', role);
sessionStorage.setItem('embedUserId', embedUserId);`);

    subSection('6.2 Token Store Architecture');
    paragraph('Active embed sessions are cached in memory for fast validation:');

    codeBlock(`// In-memory token store (server/simpleAuth.ts)
export const embedTokenStore = new Map<string, {
  embedId: string;
  role: 'superadmin' | 'admin' | 'user';
  userId: string;
  validatedAt: Date;
}>();

// Token validation populates the store
embedTokenStore.set(embedToken, {
  embedId: embedToken,
  role: validatedRole,
  userId: 'embed_' + embedToken,
  validatedAt: new Date()
});`);

    sectionTitle('7', 'Security Considerations');

    subSection('7.1 Attack Mitigation');
    
    const security = [
      ['Cross-Site Request Forgery', 'Token transmitted via custom header, not cookies'],
      ['Token Guessing', '95-bit entropy makes brute force infeasible'],
      ['Domain Spoofing', 'Origin validation via document.referrer and parentOrigin'],
      ['Session Hijacking', 'sessionStorage isolated per origin, cleared on tab close'],
      ['Privilege Escalation', 'Role stored server-side, not modifiable by client']
    ];

    security.forEach(([attack, mitigation]) => {
      doc.fontSize(9).fillColor(dark).text(`${attack}:`, 60, doc.y);
      doc.fontSize(9).fillColor(medium).text(mitigation, 60, doc.y + 2, { indent: 20 });
      doc.moveDown(0.7);
    });

    subSection('7.2 Best Practices');
    bullet('Use specific domains instead of wildcards (*) in production');
    bullet('Create separate embed links for different roles');
    bullet('Regularly audit active embed links and disable unused ones');
    bullet('Monitor "last_used" timestamps to identify inactive embeds');

    // ========== PAGE 8: API REFERENCE ==========
    doc.addPage();
    
    doc.fontSize(9).fillColor(light).text('RMOne AI Agents - Technical Architecture', 60, 40);
    doc.text('Page 8', 500, 40);
    drawLine(55);

    sectionTitle('8', 'API Reference');

    subSection('8.1 Embed Validation Endpoint');
    
    doc.fontSize(10).fillColor(dark).text('POST /api/embed/validate', 60, doc.y);
    doc.moveDown(0.5);
    paragraph('Validates an embed token and returns authorization status with role assignment.');

    doc.fontSize(9).fillColor(medium).text('Request Body:', 60, doc.y);
    codeBlock(`{
  "embedId": "jgUSnbPDCMftMgPF",
  "parentOrigin": "https://portal.rmone.com"
}`);

    doc.fontSize(9).fillColor(medium).text('Success Response (200):', 60, doc.y);
    codeBlock(`{
  "valid": true,
  "role": "admin",
  "name": "RMOne Portal - Admin Access"
}`);

    doc.fontSize(9).fillColor(medium).text('Error Response (403):', 60, doc.y);
    codeBlock(`{
  "valid": false,
  "error": "Domain not authorized for this embed link"
}`);

    subSection('8.2 Embed Link Management');

    doc.fontSize(10).fillColor(dark).text('POST /api/embed-links', 60, doc.y);
    doc.fontSize(9).fillColor(light).text('(Superadmin only)', 200, doc.y - 12);
    doc.moveDown(0.5);
    
    codeBlock(`// Create new embed link
{
  "name": "Client Portal - User Access",
  "allowed_domain": "client.rmone.com",
  "role": "user"
}`);

    doc.fontSize(10).fillColor(dark).text('GET /api/embed-links', 60, doc.y);
    doc.fontSize(9).fillColor(light).text('(Superadmin only)', 200, doc.y - 12);
    doc.moveDown(0.3);
    paragraph('Returns all embed links with usage statistics.');

    doc.fontSize(10).fillColor(dark).text('DELETE /api/embed-links/:id', 60, doc.y);
    doc.fontSize(9).fillColor(light).text('(Superadmin only)', 230, doc.y - 12);
    doc.moveDown(0.3);
    paragraph('Deactivates an embed link. Existing sessions continue until page refresh.');

    // ========== PAGE 9: DATABASE SCHEMA ==========
    doc.addPage();
    
    doc.fontSize(9).fillColor(light).text('RMOne AI Agents - Technical Architecture', 60, 40);
    doc.text('Page 9', 500, 40);
    drawLine(55);

    sectionTitle('9', 'Database Schema');

    subSection('9.1 Embed Links Table');

    codeBlock(`-- MS SQL Server Schema
CREATE TABLE embed_links (
  id           VARCHAR(16) PRIMARY KEY,    -- nanoid token
  name         NVARCHAR(255) NOT NULL,     -- Display name
  allowed_domain NVARCHAR(255) NOT NULL,   -- Domain restriction
  role         VARCHAR(20) NOT NULL,       -- superadmin|admin|user
  is_active    BIT DEFAULT 1,              -- Enable/disable flag
  created_at   DATETIME2 DEFAULT GETDATE(),
  last_used    DATETIME2 NULL,             -- Usage tracking
  created_by   NVARCHAR(255) NULL          -- Creator identifier
);

-- Indexes for performance
CREATE INDEX idx_embed_active ON embed_links(is_active);
CREATE INDEX idx_embed_domain ON embed_links(allowed_domain);`);

    subSection('9.2 Schema Relationships');
    paragraph('The embed_links table operates independently but integrates with the chat system through the userId field:');

    codeBlock(`-- Chat ownership for embed users
chats.user_id = 'embed_' + embed_links.id

-- Example: All chats for embed "jgUSnbPDCMftMgPF"
SELECT * FROM chats 
WHERE user_id = 'embed_jgUSnbPDCMftMgPF';`);

    subSection('9.3 Data Lifecycle');
    bullet('Embed links persist until manually deleted');
    bullet('Chat history retained per embed instance');
    bullet('last_used updated on each successful validation');
    bullet('Inactive embeds (is_active = 0) reject all requests');

    // ========== PAGE 10: DEPLOYMENT ==========
    doc.addPage();
    
    doc.fontSize(9).fillColor(light).text('RMOne AI Agents - Technical Architecture', 60, 40);
    doc.text('Page 10', 500, 40);
    drawLine(55);

    sectionTitle('10', 'Deployment Configuration');

    subSection('10.1 Environment Variables');
    
    const envVars = [
      ['APP_MSSQL_URL', 'Application database connection string'],
      ['CLIENT_MSSQL_URL', 'Client project database connection'],
      ['OPENAI_API_KEY', 'OpenAI API key for GPT-5 queries'],
      ['NODE_ENV', 'production | development'],
      ['PORT', 'Server port (default: 5000)']
    ];

    envVars.forEach(([key, desc]) => {
      doc.fontSize(9).fillColor(dark).text(key, 70, doc.y);
      doc.fontSize(9).fillColor(medium).text(desc, 250, doc.y - 11);
      doc.moveDown(0.5);
    });

    subSection('10.2 Production URLs');
    paragraph('The embed system is deployed at:');
    bullet('Primary: https://rmchat.vyaasai.com');
    bullet('Embed Pattern: https://rmchat.vyaasai.com/embed/{embedId}');

    subSection('10.3 CORS Configuration');
    paragraph('The server accepts requests from any origin when accessed via embed tokens. Standard session-based authentication still requires same-origin or configured CORS.');

    subSection('10.4 Iframe Requirements');
    paragraph('Parent websites embedding the chatbot must ensure:');
    bullet('HTTPS protocol (required for secure context)');
    bullet('No X-Frame-Options: DENY headers blocking iframes');
    bullet('Allow scripts from rmchat.vyaasai.com domain');

    // Footer
    doc.moveDown(3);
    drawLine(doc.y);
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor(light).text('End of Document', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(8).fillColor(light).text('RMOne AI Agents - Technical Architecture Documentation v2.0', { align: 'center' });
    doc.text('Confidential - Internal Use Only', { align: 'center' });

    doc.end();
  });
}
