import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from 'docx';

export async function generateTechnicalArchitectureDOCX(): Promise<Buffer> {
  const doc = new Document({
    creator: 'RMOne Engineering',
    title: 'RMOne AI Agents - Technical Architecture Documentation',
    description: 'Embed System Technical Specification',
    styles: {
      paragraphStyles: [
        {
          id: 'Normal',
          name: 'Normal',
          run: { size: 22, font: 'Calibri' },
          paragraph: { spacing: { after: 200, line: 300 } }
        }
      ]
    },
    sections: [{
      properties: {},
      children: [
        // Cover Page
        new Paragraph({ spacing: { after: 400 } }),
        new Paragraph({
          children: [new TextRun({ text: 'RMOne AI Agents', bold: true, size: 56, color: '1e40af', font: 'Calibri' })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 }
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Technical Architecture Documentation', bold: true, size: 36, color: '111827', font: 'Calibri' })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 }
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Embed Integration System Specification', size: 24, color: '6b7280', font: 'Calibri' })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 }
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Version 2.0  |  January 2026', size: 22, color: '1e40af', font: 'Calibri' })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 600 }
        }),
        
        // Document Info
        new Paragraph({
          children: [new TextRun({ text: 'Document Information', bold: true, size: 24, font: 'Calibri' })],
          spacing: { after: 200 }
        }),
        new Paragraph({ children: [new TextRun({ text: 'Classification: Technical - Internal Use Only', size: 22, font: 'Calibri' })], spacing: { after: 120 } }),
        new Paragraph({ children: [new TextRun({ text: 'Target Audience: Development & Engineering Teams', size: 22, font: 'Calibri' })], spacing: { after: 120 } }),
        new Paragraph({ children: [new TextRun({ text: 'Last Updated: January 28, 2026', size: 22, font: 'Calibri' })], spacing: { after: 120 } }),
        new Paragraph({ children: [new TextRun({ text: 'Prepared By: RMOne Engineering Team', size: 22, font: 'Calibri' })], spacing: { after: 400 } }),
        
        // Table of Contents
        new Paragraph({
          children: [new TextRun({ text: 'Table of Contents', bold: true, size: 24, font: 'Calibri' })],
          spacing: { after: 200 }
        }),
        ...[
          '1. System Overview',
          '2. Token Generation Architecture',
          '3. Authentication Flow',
          '4. Domain Restriction Mechanism',
          '5. Role-Based Access Control',
          '6. Session Management',
          '7. Security Considerations',
          '8. API Reference',
          '9. Database Schema',
          '10. Deployment Configuration'
        ].map(item => new Paragraph({ children: [new TextRun({ text: item, size: 22, font: 'Calibri' })], spacing: { after: 120 } })),
        
        new Paragraph({ pageBreakBefore: true }),
        
        // Section 1
        new Paragraph({
          text: '1. System Overview',
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 300 }
        }),
        new Paragraph({
          children: [new TextRun({ text: 'The RMOne AI Agents Embed System provides a secure, token-based authentication mechanism that enables external websites to integrate the AI-powered chatbot interface. The system is designed to operate within iframe contexts while maintaining strict security controls and domain-based access restrictions.', size: 22, font: 'Calibri' })],
          spacing: { after: 300 }
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Core Components:', bold: true, size: 22, font: 'Calibri' })],
          spacing: { after: 200 }
        }),
        ...['Token Generation Service - Cryptographically secure identifier creation',
            'Domain Validation Layer - Origin verification and subdomain matching',
            'Role-Based Access Control - Granular permission management',
            'Session Isolation - Independent chat history per embed instance',
            'Token Store - In-memory authentication state management'
        ].map(item => new Paragraph({ children: [new TextRun({ text: `• ${item}`, size: 22, font: 'Calibri' })], spacing: { after: 120 } })),
        
        // Section 2
        new Paragraph({
          text: '2. Token Generation Architecture',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 300 }
        }),
        new Paragraph({
          children: [new TextRun({ text: '2.1 Token Specification', bold: true, size: 24, font: 'Calibri' })],
          spacing: { after: 200 }
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Each embed link is assigned a unique 16-character alphanumeric token generated using the nanoid library with a cryptographically secure random number generator.', size: 22, font: 'Calibri' })],
          spacing: { after: 200 }
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Token Properties:', bold: true, size: 22, font: 'Calibri' })],
          spacing: { after: 150 }
        }),
        ...['Length: 16 characters',
            'Character Set: A-Za-z0-9 (62 characters)',
            'Entropy: ~95 bits',
            'Collision Probability: < 1 in 10^28',
            'Generation Method: crypto.getRandomValues()'
        ].map(item => new Paragraph({ children: [new TextRun({ text: `• ${item}`, size: 22, font: 'Calibri' })], spacing: { after: 120 } })),
        
        new Paragraph({
          children: [new TextRun({ text: '2.2 Token Generation Code', bold: true, size: 24, font: 'Calibri' })],
          spacing: { before: 300, after: 200 }
        }),
        new Paragraph({
          children: [new TextRun({ text: `import { nanoid } from 'nanoid';

// Generate cryptographically secure 16-character token
const embedId = nanoid(16);

// Example output: "jgUSnbPDCMftMgPF"
// Stored in embed_links table as primary identifier`, size: 20, font: 'Courier New' })],
          spacing: { after: 200 },
          shading: { fill: 'f3f4f6' }
        }),
        
        new Paragraph({
          children: [new TextRun({ text: '2.3 Token Storage', bold: true, size: 24, font: 'Calibri' })],
          spacing: { before: 300, after: 200 }
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Tokens are stored in two locations:', size: 22, font: 'Calibri' })],
          spacing: { after: 150 }
        }),
        new Paragraph({ children: [new TextRun({ text: '• Database: Permanent storage in embed_links table with metadata', size: 22, font: 'Calibri' })], spacing: { after: 120 } }),
        new Paragraph({ children: [new TextRun({ text: '• Runtime Memory: Active tokens cached in embedTokenStore Map for fast validation', size: 22, font: 'Calibri' })], spacing: { after: 200 } }),
        
        new Paragraph({ pageBreakBefore: true }),
        
        // Section 3
        new Paragraph({
          text: '3. Authentication Flow',
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 300 }
        }),
        new Paragraph({
          children: [new TextRun({ text: '3.1 Embed Initialization Sequence', bold: true, size: 24, font: 'Calibri' })],
          spacing: { after: 200 }
        }),
        new Paragraph({
          children: [new TextRun({ text: 'When an external website loads the embed iframe, the following authentication sequence occurs:', size: 22, font: 'Calibri' })],
          spacing: { after: 200 }
        }),
        ...['Step 1: Client Loads Iframe - Parent website embeds iframe with embed ID in URL path',
            'Step 2: Origin Detection - Embed page detects parent window origin via document.referrer',
            'Step 3: Token Validation - POST /api/embed/validate with embedId and parentOrigin',
            'Step 4: Domain Verification - Server validates origin against allowed_domain in database',
            'Step 5: Role Assignment - Server returns role (superadmin/admin/user) for the embed',
            'Step 6: Session Creation - Client stores token in sessionStorage, creates embed session'
        ].map(item => new Paragraph({ children: [new TextRun({ text: item, size: 22, font: 'Calibri' })], spacing: { after: 150 } })),
        
        new Paragraph({
          children: [new TextRun({ text: '3.2 Token Transmission', bold: true, size: 24, font: 'Calibri' })],
          spacing: { before: 300, after: 200 }
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Unlike cookie-based authentication, embed tokens are transmitted via HTTP headers to bypass third-party cookie restrictions:', size: 22, font: 'Calibri' })],
          spacing: { after: 200 }
        }),
        new Paragraph({
          children: [new TextRun({ text: `// Client-side: All API requests include token header
const response = await fetch('/api/query', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Embed-Token': sessionStorage.getItem('embedToken')
  },
  body: JSON.stringify({ question: userQuery })
});`, size: 20, font: 'Courier New' })],
          spacing: { after: 200 },
          shading: { fill: 'f3f4f6' }
        }),
        
        new Paragraph({ pageBreakBefore: true }),
        
        // Section 4
        new Paragraph({
          text: '4. Domain Restriction Mechanism',
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 300 }
        }),
        new Paragraph({
          children: [new TextRun({ text: '4.1 Domain Validation Logic', bold: true, size: 24, font: 'Calibri' })],
          spacing: { after: 200 }
        }),
        new Paragraph({
          children: [new TextRun({ text: 'The domain restriction system provides flexible yet secure access control. When validating a request, the following checks are performed:', size: 22, font: 'Calibri' })],
          spacing: { after: 200 }
        }),
        new Paragraph({
          children: [new TextRun({ text: `// Domain validation algorithm
const requestDomain = parentOrigin.toLowerCase();
const allowedDomain = embedLink.allowed_domain.toLowerCase();

const isAllowed = 
  allowedDomain === '*' ||                          // Wildcard
  process.env.NODE_ENV === 'development' ||         // Dev mode
  !parentOrigin ||                                  // Direct access
  requestDomain === allowedDomain ||                // Exact match
  requestDomain.endsWith('.' + allowedDomain);      // Subdomain`, size: 20, font: 'Courier New' })],
          spacing: { after: 200 },
          shading: { fill: 'f3f4f6' }
        }),
        
        new Paragraph({
          children: [new TextRun({ text: '4.2 Matching Rules', bold: true, size: 24, font: 'Calibri' })],
          spacing: { before: 300, after: 200 }
        }),
        ...['Allowed: rmone.com → rmone.com (Exact Match)',
            'Allowed: rmone.com → portal.rmone.com (Subdomain)',
            'Allowed: rmone.com → api.portal.rmone.com (Nested Subdomain)',
            'Denied: rmone.com → othersite.com (No Match)',
            'Allowed: * → anysite.com (Wildcard)',
            'Denied: portal.rmone.com → rmone.com (Parent Domain)'
        ].map(item => new Paragraph({ children: [new TextRun({ text: item, size: 22, font: 'Calibri' })], spacing: { after: 120 } })),
        
        new Paragraph({
          children: [new TextRun({ text: '4.3 Subdomain Wildcard Behavior', bold: true, size: 24, font: 'Calibri' })],
          spacing: { before: 300, after: 200 }
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Setting the allowed domain to a root domain automatically permits all subdomains through suffix matching:', size: 22, font: 'Calibri' })],
          spacing: { after: 200 }
        }),
        new Paragraph({
          children: [new TextRun({ text: `// Subdomain matching implementation
const subdomainMatch = requestDomain.endsWith('.' + allowedDomain);

// Example: allowedDomain = "rmone.com"
// "portal.rmone.com".endsWith(".rmone.com") → true
// "staging.api.rmone.com".endsWith(".rmone.com") → true`, size: 20, font: 'Courier New' })],
          spacing: { after: 200 },
          shading: { fill: 'f3f4f6' }
        }),
        
        new Paragraph({ pageBreakBefore: true }),
        
        // Section 5
        new Paragraph({
          text: '5. Role-Based Access Control',
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 300 }
        }),
        new Paragraph({
          children: [new TextRun({ text: '5.1 Role Hierarchy', bold: true, size: 24, font: 'Calibri' })],
          spacing: { after: 200 }
        }),
        new Paragraph({
          children: [new TextRun({ text: 'The embed system implements a three-tier role hierarchy with progressively restrictive permissions:', size: 22, font: 'Calibri' })],
          spacing: { after: 200 }
        }),
        new Paragraph({
          children: [new TextRun({ text: 'SUPERADMIN', bold: true, size: 24, color: 'b45309', font: 'Calibri' })],
          spacing: { after: 80 }
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Full system access: All logs, FAQ management, chat editing, integration management', size: 22, font: 'Calibri' })],
          spacing: { after: 200 }
        }),
        new Paragraph({
          children: [new TextRun({ text: 'ADMIN', bold: true, size: 24, color: '1e40af', font: 'Calibri' })],
          spacing: { after: 80 }
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Elevated access: Own query logs, FAQ management, chat editing (no integration access)', size: 22, font: 'Calibri' })],
          spacing: { after: 200 }
        }),
        new Paragraph({
          children: [new TextRun({ text: 'USER', bold: true, size: 24, color: '059669', font: 'Calibri' })],
          spacing: { after: 80 }
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Basic access: Chat interface only, view own chat history, no administrative features', size: 22, font: 'Calibri' })],
          spacing: { after: 300 }
        }),
        
        new Paragraph({
          children: [new TextRun({ text: '5.2 Permission Matrix', bold: true, size: 24, font: 'Calibri' })],
          spacing: { after: 200 }
        }),
        ...['Chat with AI: Superadmin ✓ | Admin ✓ | User ✓',
            'View Own Chat History: Superadmin ✓ | Admin ✓ | User ✓',
            'Delete Own Chats: Superadmin ✓ | Admin ✓ | User ✓',
            'View Query Logs: Superadmin (All) | Admin (Own) | User ✗',
            'FAQ Sample Management: Superadmin ✓ | Admin ✓ | User ✗',
            'Edit Chat Titles: Superadmin ✓ | Admin ✓ | User ✗',
            'Integration Management: Superadmin ✓ | Admin ✗ | User ✗'
        ].map(item => new Paragraph({ children: [new TextRun({ text: item, size: 22, font: 'Calibri' })], spacing: { after: 120 } })),
        
        new Paragraph({ pageBreakBefore: true }),
        
        // Section 6
        new Paragraph({
          text: '6. Session Management',
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 300 }
        }),
        new Paragraph({
          children: [new TextRun({ text: '6.1 Session Isolation', bold: true, size: 24, font: 'Calibri' })],
          spacing: { after: 200 }
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Each embed instance maintains an isolated session to prevent cross-contamination of chat data:', size: 22, font: 'Calibri' })],
          spacing: { after: 200 }
        }),
        new Paragraph({
          children: [new TextRun({ text: `// Embed user identification
const embedUserId = 'embed_' + embedId;

// Chat ownership
chat.userId = embedUserId;

// Session storage (client-side)
sessionStorage.setItem('embedToken', embedId);
sessionStorage.setItem('embedRole', role);
sessionStorage.setItem('embedUserId', embedUserId);`, size: 20, font: 'Courier New' })],
          spacing: { after: 300 },
          shading: { fill: 'f3f4f6' }
        }),
        
        // Section 7
        new Paragraph({
          text: '7. Security Considerations',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 300, after: 300 }
        }),
        new Paragraph({
          children: [new TextRun({ text: '7.1 Attack Mitigation', bold: true, size: 24, font: 'Calibri' })],
          spacing: { after: 200 }
        }),
        ...['Cross-Site Request Forgery: Token transmitted via custom header, not cookies',
            'Token Guessing: 95-bit entropy makes brute force infeasible',
            'Domain Spoofing: Origin validation via document.referrer and parentOrigin',
            'Session Hijacking: sessionStorage isolated per origin, cleared on tab close',
            'Privilege Escalation: Role stored server-side, not modifiable by client'
        ].map(item => new Paragraph({ children: [new TextRun({ text: `• ${item}`, size: 22, font: 'Calibri' })], spacing: { after: 120 } })),
        
        new Paragraph({
          children: [new TextRun({ text: '7.2 Best Practices', bold: true, size: 24, font: 'Calibri' })],
          spacing: { before: 300, after: 200 }
        }),
        ...['Use specific domains instead of wildcards (*) in production',
            'Create separate embed links for different roles',
            'Regularly audit active embed links and disable unused ones',
            'Monitor "last_used" timestamps to identify inactive embeds'
        ].map(item => new Paragraph({ children: [new TextRun({ text: `• ${item}`, size: 22, font: 'Calibri' })], spacing: { after: 120 } })),
        
        new Paragraph({ pageBreakBefore: true }),
        
        // Section 8
        new Paragraph({
          text: '8. API Reference',
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 300 }
        }),
        new Paragraph({
          children: [new TextRun({ text: '8.1 Embed Validation Endpoint', bold: true, size: 24, font: 'Calibri' })],
          spacing: { after: 200 }
        }),
        new Paragraph({
          children: [new TextRun({ text: 'POST /api/embed/validate', bold: true, size: 22, color: '1e40af', font: 'Calibri' })],
          spacing: { after: 150 }
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Validates an embed token and returns authorization status with role assignment.', size: 22, font: 'Calibri' })],
          spacing: { after: 200 }
        }),
        new Paragraph({
          children: [new TextRun({ text: `Request: { "embedId": "jgUSnbPDCMftMgPF", "parentOrigin": "https://portal.rmone.com" }
Response: { "valid": true, "role": "admin", "name": "RMOne Portal" }`, size: 20, font: 'Courier New' })],
          spacing: { after: 300 },
          shading: { fill: 'f3f4f6' }
        }),
        
        // Section 9
        new Paragraph({
          text: '9. Database Schema',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 300, after: 300 }
        }),
        new Paragraph({
          children: [new TextRun({ text: '9.1 Embed Links Table', bold: true, size: 24, font: 'Calibri' })],
          spacing: { after: 200 }
        }),
        new Paragraph({
          children: [new TextRun({ text: `CREATE TABLE embed_links (
  id             VARCHAR(16) PRIMARY KEY,
  name           NVARCHAR(255) NOT NULL,
  allowed_domain NVARCHAR(255) NOT NULL,
  role           VARCHAR(20) NOT NULL,
  is_active      BIT DEFAULT 1,
  created_at     DATETIME2 DEFAULT GETDATE(),
  last_used      DATETIME2 NULL,
  created_by     NVARCHAR(255) NULL
);`, size: 20, font: 'Courier New' })],
          spacing: { after: 300 },
          shading: { fill: 'f3f4f6' }
        }),
        
        // Section 10
        new Paragraph({
          text: '10. Deployment Configuration',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 300, after: 300 }
        }),
        new Paragraph({
          children: [new TextRun({ text: '10.1 Environment Variables', bold: true, size: 24, font: 'Calibri' })],
          spacing: { after: 200 }
        }),
        ...['APP_MSSQL_URL: Application database connection string',
            'CLIENT_MSSQL_URL: Client project database connection',
            'OPENAI_API_KEY: OpenAI API key for GPT-5 queries',
            'NODE_ENV: production | development',
            'PORT: Server port (default: 5000)'
        ].map(item => new Paragraph({ children: [new TextRun({ text: `• ${item}`, size: 22, font: 'Calibri' })], spacing: { after: 120 } })),
        
        new Paragraph({
          children: [new TextRun({ text: '10.2 Production URLs', bold: true, size: 24, font: 'Calibri' })],
          spacing: { before: 300, after: 200 }
        }),
        new Paragraph({ children: [new TextRun({ text: '• Primary: https://rmchat.vyaasai.com', size: 22, font: 'Calibri' })], spacing: { after: 120 } }),
        new Paragraph({ children: [new TextRun({ text: '• Embed Pattern: https://rmchat.vyaasai.com/embed/{embedId}', size: 22, font: 'Calibri' })], spacing: { after: 200 } }),
      ]
    }]
  });

  return await Packer.toBuffer(doc);
}
