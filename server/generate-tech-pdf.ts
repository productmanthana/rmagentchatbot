import PDFDocument from 'pdfkit';

export function generateTechnicalArchitecturePDF(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ 
      size: 'A4', 
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: 'RMOne AI Agents - Technical Architecture Documentation',
        Author: 'RMOne Engineering',
        Subject: 'Embed System Technical Specification'
      }
    });

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = 495;
    const leftMargin = 50;

    // Colors
    const primary = '#1e40af';
    const dark = '#111827';
    const medium = '#4b5563';
    const light = '#9ca3af';
    const accent = '#059669';

    // ========== COVER PAGE ==========
    doc.fontSize(36).fillColor(primary).text('RMOne AI Agents', { align: 'center' });
    doc.moveDown(0.8);
    doc.fontSize(20).fillColor(dark).text('Technical Architecture Documentation', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(14).fillColor(light).text('Embed Integration System Specification', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor(primary).text('Version 2.0  |  January 2026', { align: 'center' });
    
    doc.moveDown(3);
    doc.fontSize(11).fillColor(dark).text('Document Information', { align: 'left' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor(medium);
    doc.text('Classification: Technical - Internal Use Only');
    doc.text('Target Audience: Development & Engineering Teams');
    doc.text('Last Updated: January 28, 2026');
    doc.text('Prepared By: RMOne Engineering Team');

    doc.moveDown(2);
    doc.fontSize(11).fillColor(dark).text('Table of Contents', { align: 'left' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor(medium);
    doc.text('1. System Overview');
    doc.text('2. Token Generation Architecture');
    doc.text('3. Authentication Flow');
    doc.text('4. Domain Restriction Mechanism');
    doc.text('5. Role-Based Access Control');
    doc.text('6. Session Management');
    doc.text('7. Security Considerations');
    doc.text('8. API Reference');
    doc.text('9. Database Schema');
    doc.text('10. Deployment Configuration');

    // ========== SECTION 1 ==========
    doc.addPage();
    
    doc.fontSize(18).fillColor(primary).text('1. System Overview');
    doc.moveDown(0.8);
    
    doc.fontSize(10).fillColor(medium).text(
      'The RMOne AI Agents Embed System provides a secure, token-based authentication mechanism that enables external websites to integrate the AI-powered chatbot interface. The system is designed to operate within iframe contexts while maintaining strict security controls and domain-based access restrictions.',
      { align: 'justify', lineGap: 3 }
    );
    
    doc.moveDown(1);
    doc.fontSize(12).fillColor(dark).text('Core Components:');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor(medium);
    doc.text('• Token Generation Service - Cryptographically secure identifier creation');
    doc.text('• Domain Validation Layer - Origin verification and subdomain matching');
    doc.text('• Role-Based Access Control - Granular permission management');
    doc.text('• Session Isolation - Independent chat history per embed instance');
    doc.text('• Token Store - In-memory authentication state management');

    // ========== SECTION 2 ==========
    doc.moveDown(1.5);
    doc.fontSize(18).fillColor(primary).text('2. Token Generation Architecture');
    doc.moveDown(0.8);

    doc.fontSize(12).fillColor(dark).text('2.1 Token Specification');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor(medium).text(
      'Each embed link is assigned a unique 16-character alphanumeric token generated using the nanoid library with a cryptographically secure random number generator.',
      { lineGap: 3 }
    );

    doc.moveDown(0.8);
    doc.fontSize(10).fillColor(dark).text('Token Properties:');
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor(medium);
    doc.text('• Length: 16 characters');
    doc.text('• Character Set: A-Za-z0-9 (62 characters)');
    doc.text('• Entropy: ~95 bits');
    doc.text('• Collision Probability: < 1 in 10^28');
    doc.text('• Generation Method: crypto.getRandomValues()');

    doc.moveDown(0.8);
    doc.fontSize(12).fillColor(dark).text('2.2 Token Generation Code');
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor('#374151').font('Courier').text(
`import { nanoid } from 'nanoid';

// Generate cryptographically secure 16-character token
const embedId = nanoid(16);

// Example output: "jgUSnbPDCMftMgPF"
// Stored in embed_links table as primary identifier`,
      { lineGap: 2 }
    );
    doc.font('Helvetica');

    doc.moveDown(0.8);
    doc.fontSize(12).fillColor(dark).text('2.3 Token Storage');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor(medium).text('Tokens are stored in two locations:');
    doc.text('• Database: Permanent storage in embed_links table with metadata');
    doc.text('• Runtime Memory: Active tokens cached in embedTokenStore Map for fast validation');

    // ========== SECTION 3 ==========
    doc.addPage();
    
    doc.fontSize(18).fillColor(primary).text('3. Authentication Flow');
    doc.moveDown(0.8);

    doc.fontSize(12).fillColor(dark).text('3.1 Embed Initialization Sequence');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor(medium).text(
      'When an external website loads the embed iframe, the following authentication sequence occurs:',
      { lineGap: 3 }
    );

    doc.moveDown(0.5);
    doc.fontSize(10).fillColor(dark).text('Step 1: Client Loads Iframe');
    doc.fontSize(10).fillColor(medium).text('Parent website embeds iframe with embed ID in URL path');
    doc.moveDown(0.3);
    
    doc.fontSize(10).fillColor(dark).text('Step 2: Origin Detection');
    doc.fontSize(10).fillColor(medium).text('Embed page detects parent window origin via document.referrer');
    doc.moveDown(0.3);
    
    doc.fontSize(10).fillColor(dark).text('Step 3: Token Validation');
    doc.fontSize(10).fillColor(medium).text('POST /api/embed/validate with embedId and parentOrigin');
    doc.moveDown(0.3);
    
    doc.fontSize(10).fillColor(dark).text('Step 4: Domain Verification');
    doc.fontSize(10).fillColor(medium).text('Server validates origin against allowed_domain in database');
    doc.moveDown(0.3);
    
    doc.fontSize(10).fillColor(dark).text('Step 5: Role Assignment');
    doc.fontSize(10).fillColor(medium).text('Server returns role (superadmin/admin/user) for the embed');
    doc.moveDown(0.3);
    
    doc.fontSize(10).fillColor(dark).text('Step 6: Session Creation');
    doc.fontSize(10).fillColor(medium).text('Client stores token in sessionStorage, creates embed session');

    doc.moveDown(1);
    doc.fontSize(12).fillColor(dark).text('3.2 Token Transmission');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor(medium).text(
      'Unlike cookie-based authentication, embed tokens are transmitted via HTTP headers to bypass third-party cookie restrictions:',
      { lineGap: 3 }
    );

    doc.moveDown(0.5);
    doc.fontSize(9).fillColor('#374151').font('Courier').text(
`// Client-side: All API requests include token header
const response = await fetch('/api/query', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Embed-Token': sessionStorage.getItem('embedToken')
  },
  body: JSON.stringify({ question: userQuery })
});`,
      { lineGap: 2 }
    );
    doc.font('Helvetica');

    // ========== SECTION 4 ==========
    doc.addPage();
    
    doc.fontSize(18).fillColor(primary).text('4. Domain Restriction Mechanism');
    doc.moveDown(0.8);

    doc.fontSize(12).fillColor(dark).text('4.1 Domain Validation Logic');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor(medium).text(
      'The domain restriction system provides flexible yet secure access control. When validating a request, the following checks are performed:',
      { lineGap: 3 }
    );

    doc.moveDown(0.5);
    doc.fontSize(9).fillColor('#374151').font('Courier').text(
`// Domain validation algorithm
const requestDomain = parentOrigin.toLowerCase();
const allowedDomain = embedLink.allowed_domain.toLowerCase();

const isAllowed = 
  allowedDomain === '*' ||                          // Wildcard
  process.env.NODE_ENV === 'development' ||         // Dev mode
  !parentOrigin ||                                  // Direct access
  requestDomain === allowedDomain ||                // Exact match
  requestDomain.endsWith('.' + allowedDomain);      // Subdomain`,
      { lineGap: 2 }
    );
    doc.font('Helvetica');

    doc.moveDown(1);
    doc.fontSize(12).fillColor(dark).text('4.2 Matching Rules');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor(medium);
    doc.text('Allowed: rmone.com → rmone.com (Exact Match)');
    doc.text('Allowed: rmone.com → portal.rmone.com (Subdomain)');
    doc.text('Allowed: rmone.com → api.portal.rmone.com (Nested Subdomain)');
    doc.text('Denied: rmone.com → othersite.com (No Match)');
    doc.text('Allowed: * → anysite.com (Wildcard)');
    doc.text('Denied: portal.rmone.com → rmone.com (Parent Domain)');

    doc.moveDown(1);
    doc.fontSize(12).fillColor(dark).text('4.3 Subdomain Wildcard Behavior');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor(medium).text(
      'Setting the allowed domain to a root domain automatically permits all subdomains through suffix matching:',
      { lineGap: 3 }
    );

    doc.moveDown(0.5);
    doc.fontSize(9).fillColor('#374151').font('Courier').text(
`// Subdomain matching implementation
const subdomainMatch = requestDomain.endsWith('.' + allowedDomain);

// Example: allowedDomain = "rmone.com"
// "portal.rmone.com".endsWith(".rmone.com") → true
// "staging.api.rmone.com".endsWith(".rmone.com") → true
// "rmone.com".endsWith(".rmone.com") → false (exact match used)`,
      { lineGap: 2 }
    );
    doc.font('Helvetica');

    // ========== SECTION 5 ==========
    doc.addPage();
    
    doc.fontSize(18).fillColor(primary).text('5. Role-Based Access Control');
    doc.moveDown(0.8);

    doc.fontSize(12).fillColor(dark).text('5.1 Role Hierarchy');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor(medium).text(
      'The embed system implements a three-tier role hierarchy with progressively restrictive permissions:',
      { lineGap: 3 }
    );

    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#b45309').text('SUPERADMIN');
    doc.fontSize(10).fillColor(medium).text('Full system access: All logs, FAQ management, chat editing, integration management');
    
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor(primary).text('ADMIN');
    doc.fontSize(10).fillColor(medium).text('Elevated access: Own query logs, FAQ management, chat editing (no integration access)');
    
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor(accent).text('USER');
    doc.fontSize(10).fillColor(medium).text('Basic access: Chat interface only, view own chat history, no administrative features');

    doc.moveDown(1);
    doc.fontSize(12).fillColor(dark).text('5.2 Permission Matrix');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor(medium);
    doc.text('Chat with AI: Superadmin ✓ | Admin ✓ | User ✓');
    doc.text('View Own Chat History: Superadmin ✓ | Admin ✓ | User ✓');
    doc.text('Delete Own Chats: Superadmin ✓ | Admin ✓ | User ✓');
    doc.text('View Query Logs: Superadmin (All) | Admin (Own) | User ✗');
    doc.text('FAQ Sample Management: Superadmin ✓ | Admin ✓ | User ✗');
    doc.text('Edit Chat Titles: Superadmin ✓ | Admin ✓ | User ✗');
    doc.text('Integration Management: Superadmin ✓ | Admin ✗ | User ✗');
    doc.text('Logs Tab in Results: Superadmin ✓ | Admin ✓ | User ✗');

    doc.moveDown(1);
    doc.fontSize(12).fillColor(dark).text('5.3 Role Check Implementation');
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor('#374151').font('Courier').text(
`// Server-side role validation
const embedData = embedTokenStore.get(embedToken);
const isAdmin = embedData.role === 'admin' || embedData.role === 'superadmin';
const isSuperadmin = embedData.role === 'superadmin';

// Client-side permission checks
const canViewLogsTab = isAdminOrAbove;
const canManageFAQ = isAdminOrAbove;
const canEditChat = isAdminOrAbove;`,
      { lineGap: 2 }
    );
    doc.font('Helvetica');

    // ========== SECTION 6 ==========
    doc.addPage();
    
    doc.fontSize(18).fillColor(primary).text('6. Session Management');
    doc.moveDown(0.8);

    doc.fontSize(12).fillColor(dark).text('6.1 Session Isolation');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor(medium).text(
      'Each embed instance maintains an isolated session to prevent cross-contamination of chat data:',
      { lineGap: 3 }
    );

    doc.moveDown(0.5);
    doc.fontSize(9).fillColor('#374151').font('Courier').text(
`// Embed user identification
const embedUserId = 'embed_' + embedId;  // e.g., "embed_jgUSnbPDCMftMgPF"

// Chat ownership
chat.userId = embedUserId;  // All chats scoped to this embed

// Session storage (client-side)
sessionStorage.setItem('embedToken', embedId);
sessionStorage.setItem('embedRole', role);
sessionStorage.setItem('embedUserId', embedUserId);`,
      { lineGap: 2 }
    );
    doc.font('Helvetica');

    doc.moveDown(1);
    doc.fontSize(12).fillColor(dark).text('6.2 Token Store Architecture');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor(medium).text('Active embed sessions are cached in memory for fast validation:');

    doc.moveDown(0.5);
    doc.fontSize(9).fillColor('#374151').font('Courier').text(
`// In-memory token store (server/simpleAuth.ts)
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
});`,
      { lineGap: 2 }
    );
    doc.font('Helvetica');

    // ========== SECTION 7 ==========
    doc.moveDown(1.5);
    doc.fontSize(18).fillColor(primary).text('7. Security Considerations');
    doc.moveDown(0.8);

    doc.fontSize(12).fillColor(dark).text('7.1 Attack Mitigation');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor(medium);
    doc.text('• Cross-Site Request Forgery: Token transmitted via custom header, not cookies');
    doc.text('• Token Guessing: 95-bit entropy makes brute force infeasible');
    doc.text('• Domain Spoofing: Origin validation via document.referrer and parentOrigin');
    doc.text('• Session Hijacking: sessionStorage isolated per origin, cleared on tab close');
    doc.text('• Privilege Escalation: Role stored server-side, not modifiable by client');

    doc.moveDown(1);
    doc.fontSize(12).fillColor(dark).text('7.2 Best Practices');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor(medium);
    doc.text('• Use specific domains instead of wildcards (*) in production');
    doc.text('• Create separate embed links for different roles');
    doc.text('• Regularly audit active embed links and disable unused ones');
    doc.text('• Monitor "last_used" timestamps to identify inactive embeds');

    // ========== SECTION 8 ==========
    doc.addPage();
    
    doc.fontSize(18).fillColor(primary).text('8. API Reference');
    doc.moveDown(0.8);

    doc.fontSize(12).fillColor(dark).text('8.1 Embed Validation Endpoint');
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor(primary).text('POST /api/embed/validate');
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor(medium).text(
      'Validates an embed token and returns authorization status with role assignment.',
      { lineGap: 3 }
    );

    doc.moveDown(0.5);
    doc.fontSize(10).fillColor(dark).text('Request Body:');
    doc.fontSize(9).fillColor('#374151').font('Courier').text(
`{
  "embedId": "jgUSnbPDCMftMgPF",
  "parentOrigin": "https://portal.rmone.com"
}`,
      { lineGap: 2 }
    );
    doc.font('Helvetica');

    doc.moveDown(0.5);
    doc.fontSize(10).fillColor(dark).text('Success Response (200):');
    doc.fontSize(9).fillColor('#374151').font('Courier').text(
`{
  "valid": true,
  "role": "admin",
  "name": "RMOne Portal - Admin Access"
}`,
      { lineGap: 2 }
    );
    doc.font('Helvetica');

    doc.moveDown(0.5);
    doc.fontSize(10).fillColor(dark).text('Error Response (403):');
    doc.fontSize(9).fillColor('#374151').font('Courier').text(
`{
  "valid": false,
  "error": "Domain not authorized for this embed link"
}`,
      { lineGap: 2 }
    );
    doc.font('Helvetica');

    doc.moveDown(1);
    doc.fontSize(12).fillColor(dark).text('8.2 Embed Link Management');
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor(primary).text('POST /api/embed-links');
    doc.fontSize(10).fillColor(light).text('(Superadmin only)');
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor('#374151').font('Courier').text(
`// Create new embed link
{
  "name": "Client Portal - User Access",
  "allowed_domain": "client.rmone.com",
  "role": "user"
}`,
      { lineGap: 2 }
    );
    doc.font('Helvetica');

    doc.moveDown(0.5);
    doc.fontSize(11).fillColor(primary).text('GET /api/embed-links');
    doc.fontSize(10).fillColor(light).text('(Superadmin only) - Returns all embed links with usage statistics');

    doc.moveDown(0.5);
    doc.fontSize(11).fillColor(primary).text('DELETE /api/embed-links/:id');
    doc.fontSize(10).fillColor(light).text('(Superadmin only) - Deactivates an embed link');

    // ========== SECTION 9 ==========
    doc.addPage();
    
    doc.fontSize(18).fillColor(primary).text('9. Database Schema');
    doc.moveDown(0.8);

    doc.fontSize(12).fillColor(dark).text('9.1 Embed Links Table');
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor('#374151').font('Courier').text(
`-- MS SQL Server Schema
CREATE TABLE embed_links (
  id             VARCHAR(16) PRIMARY KEY,    -- nanoid token
  name           NVARCHAR(255) NOT NULL,     -- Display name
  allowed_domain NVARCHAR(255) NOT NULL,     -- Domain restriction
  role           VARCHAR(20) NOT NULL,       -- superadmin|admin|user
  is_active      BIT DEFAULT 1,              -- Enable/disable flag
  created_at     DATETIME2 DEFAULT GETDATE(),
  last_used      DATETIME2 NULL,             -- Usage tracking
  created_by     NVARCHAR(255) NULL          -- Creator identifier
);

-- Indexes for performance
CREATE INDEX idx_embed_active ON embed_links(is_active);
CREATE INDEX idx_embed_domain ON embed_links(allowed_domain);`,
      { lineGap: 2 }
    );
    doc.font('Helvetica');

    doc.moveDown(1);
    doc.fontSize(12).fillColor(dark).text('9.2 Schema Relationships');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor(medium).text(
      'The embed_links table operates independently but integrates with the chat system through the userId field:',
      { lineGap: 3 }
    );

    doc.moveDown(0.5);
    doc.fontSize(9).fillColor('#374151').font('Courier').text(
`-- Chat ownership for embed users
chats.user_id = 'embed_' + embed_links.id

-- Example: All chats for embed "jgUSnbPDCMftMgPF"
SELECT * FROM chats 
WHERE user_id = 'embed_jgUSnbPDCMftMgPF';`,
      { lineGap: 2 }
    );
    doc.font('Helvetica');

    doc.moveDown(1);
    doc.fontSize(12).fillColor(dark).text('9.3 Data Lifecycle');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor(medium);
    doc.text('• Embed links persist until manually deleted');
    doc.text('• Chat history retained per embed instance');
    doc.text('• last_used updated on each successful validation');
    doc.text('• Inactive embeds (is_active = 0) reject all requests');

    // ========== SECTION 10 ==========
    doc.addPage();
    
    doc.fontSize(18).fillColor(primary).text('10. Deployment Configuration');
    doc.moveDown(0.8);

    doc.fontSize(12).fillColor(dark).text('10.1 Environment Variables');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor(medium);
    doc.text('• APP_MSSQL_URL: Application database connection string');
    doc.text('• CLIENT_MSSQL_URL: Client project database connection');
    doc.text('• OPENAI_API_KEY: OpenAI API key for GPT-5 queries');
    doc.text('• NODE_ENV: production | development');
    doc.text('• PORT: Server port (default: 5000)');

    doc.moveDown(1);
    doc.fontSize(12).fillColor(dark).text('10.2 Production URLs');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor(medium);
    doc.text('• Primary: https://rmchat.vyaasai.com');
    doc.text('• Embed Pattern: https://rmchat.vyaasai.com/embed/{embedId}');

    doc.moveDown(1);
    doc.fontSize(12).fillColor(dark).text('10.3 CORS Configuration');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor(medium).text(
      'The server accepts requests from any origin when accessed via embed tokens. Standard session-based authentication still requires same-origin or configured CORS.',
      { lineGap: 3 }
    );

    doc.moveDown(1);
    doc.fontSize(12).fillColor(dark).text('10.4 Iframe Requirements');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor(medium).text('Parent websites embedding the chatbot must ensure:');
    doc.text('• HTTPS protocol (required for secure context)');
    doc.text('• No X-Frame-Options: DENY headers blocking iframes');
    doc.text('• Allow scripts from rmchat.vyaasai.com domain');

    // Footer
    doc.moveDown(3);
    doc.fontSize(10).fillColor(light).text('End of Document', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor(light).text('RMOne AI Agents - Technical Architecture Documentation v2.0', { align: 'center' });
    doc.text('Confidential - Internal Use Only', { align: 'center' });

    doc.end();
  });
}
