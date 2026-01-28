import PDFDocument from 'pdfkit';

export function generateIntegrationPDF(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ 
      size: 'A4', 
      margin: 50,
      info: {
        Title: 'RMOne AI Agents - Embed Integration Guide',
        Author: 'RMOne',
        Subject: 'Integration Architecture Documentation'
      }
    });

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

  // Colors
  const primaryBlue = '#2563eb';
  const darkGray = '#1f2937';
  const mediumGray = '#4b5563';
  const lightGray = '#6b7280';
  const successGreen = '#16a34a';
  const warningOrange = '#f59e0b';

  // Header
  doc.fontSize(28).fillColor(primaryBlue).text('RMOne AI Agents', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(20).fillColor(darkGray).text('Embed Integration Architecture Guide', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(12).fillColor(lightGray).text('External Website Integration Documentation', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor(primaryBlue).text('Version 2.0 | January 2026', { align: 'center' });
  
  // Divider
  doc.moveDown(1);
  doc.strokeColor(primaryBlue).lineWidth(2).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(1.5);

  // Section 1: Executive Summary
  doc.fontSize(16).fillColor(primaryBlue).text('1. Executive Summary');
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor(mediumGray).text(
    'RMOne AI Agents provides a powerful one-click embed solution that allows external websites to integrate the AI-powered project query chatbot seamlessly. This document outlines the architecture, security model, and implementation approach for embedding the chatbot on client portals.',
    { align: 'justify' }
  );
  doc.moveDown(1);

  // Key Benefits Box
  doc.rect(50, doc.y, 495, 100).fillColor('#f0fdf4').fill();
  doc.fillColor(successGreen).fontSize(12).text('Key Benefits:', 60, doc.y - 90);
  doc.fontSize(10).fillColor(mediumGray);
  doc.text('• One-click embed generation with unique secure tokens', 70, doc.y + 15);
  doc.text('• Domain-restricted access with automatic subdomain support', 70, doc.y + 5);
  doc.text('• Role-based permissions (Superadmin, Admin, User)', 70, doc.y + 5);
  doc.text('• Token-based authentication (works in all browsers, including Safari)', 70, doc.y + 5);
  doc.text('• No cookies required - iframe compatible', 70, doc.y + 5);
  doc.moveDown(2);

  // Section 2: Architecture Overview
  doc.fontSize(16).fillColor(primaryBlue).text('2. Architecture Overview');
  doc.moveDown(0.5);
  
  // Flow diagram
  doc.rect(50, doc.y, 495, 50).fillColor('#f8fafc').fill();
  const flowY = doc.y - 35;
  doc.fontSize(9).fillColor('#ffffff');
  
  const boxes = ['Client Website', 'Embed URL', 'Token Validation', 'Role Assignment', 'Chat Interface'];
  let boxX = 60;
  boxes.forEach((text, i) => {
    doc.rect(boxX, flowY, 85, 25).fillColor(primaryBlue).fill();
    doc.fillColor('#ffffff').text(text, boxX + 5, flowY + 8, { width: 75, align: 'center' });
    if (i < boxes.length - 1) {
      doc.fillColor(lightGray).text('→', boxX + 88, flowY + 6);
    }
    boxX += 98;
  });
  
  doc.moveDown(2);
  doc.fontSize(12).fillColor(darkGray).text('Component Overview:');
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor(mediumGray);
  doc.text('• Integration Management Page: Admin interface to create/manage embed links');
  doc.text('• Embed Token System: Secure 16-character unique identifiers per embed');
  doc.text('• Domain Validator: Restricts embed usage to authorized domains');
  doc.text('• Role-Based Access Control: Three permission levels with granular access');
  doc.text('• Session Management: Isolated chat history per embed instance');
  doc.moveDown(1);

  // Section 3: How It Works
  doc.fontSize(16).fillColor(primaryBlue).text('3. How It Works');
  doc.moveDown(0.5);

  const steps = [
    { title: 'Create Embed Link', desc: 'Admin navigates to Integration page and creates a new embed link with name, role, and allowed domain.' },
    { title: 'Configure Domain', desc: 'Specify the allowed domain (e.g., rmone.com). All subdomains are automatically included.' },
    { title: 'Select Role', desc: 'Choose permission level: Superadmin (full access), Admin (logs + FAQ), or User (chat only).' },
    { title: 'Copy & Embed', desc: 'Copy the generated iframe code and paste into your website. That\'s it!' }
  ];

  steps.forEach((step, i) => {
    doc.circle(65, doc.y + 8, 10).fillColor(primaryBlue).fill();
    doc.fillColor('#ffffff').fontSize(10).text((i + 1).toString(), 61, doc.y + 4);
    doc.fillColor(darkGray).fontSize(11).text(step.title, 85, doc.y);
    doc.fillColor(mediumGray).fontSize(10).text(step.desc, 85, doc.y + 3, { width: 450 });
    doc.moveDown(0.8);
  });

  // Page break
  doc.addPage();

  // Section 4: Role-Based Permissions
  doc.fontSize(16).fillColor(primaryBlue).text('4. Role-Based Permissions');
  doc.moveDown(0.5);

  // Table header
  const tableTop = doc.y;
  const colWidths = [180, 100, 100, 100];
  const rowHeight = 25;
  
  doc.rect(50, tableTop, 495, rowHeight).fillColor('#f3f4f6').fill();
  doc.fillColor(darkGray).fontSize(10);
  doc.text('Feature', 55, tableTop + 8);
  doc.text('Superadmin', 235, tableTop + 8);
  doc.text('Admin', 335, tableTop + 8);
  doc.text('User', 435, tableTop + 8);

  const permissions = [
    ['Chat with AI', '✓', '✓', '✓'],
    ['View Chat History', '✓', '✓', '✓'],
    ['Query Logs Access', '✓ All logs', '✓ Own logs', '✗'],
    ['FAQ Management', '✓', '✓', '✗'],
    ['Edit Chat Titles', '✓', '✓', '✗'],
    ['Integration Management', '✓', '✗', '✗']
  ];

  permissions.forEach((row, i) => {
    const y = tableTop + rowHeight + (i * rowHeight);
    if (i % 2 === 0) {
      doc.rect(50, y, 495, rowHeight).fillColor('#f9fafb').fill();
    }
    doc.rect(50, y, 495, rowHeight).strokeColor('#e5e7eb').stroke();
    
    doc.fillColor(mediumGray).text(row[0], 55, y + 8);
    doc.fillColor(row[1].includes('✓') ? successGreen : '#dc2626').text(row[1], 235, y + 8);
    doc.fillColor(row[2].includes('✓') ? successGreen : '#dc2626').text(row[2], 335, y + 8);
    doc.fillColor(row[3].includes('✓') ? successGreen : '#dc2626').text(row[3], 435, y + 8);
  });

  doc.moveDown(8);

  // Section 5: Security Features
  doc.fontSize(16).fillColor(primaryBlue).text('5. Security Features');
  doc.moveDown(0.5);

  // Info box
  doc.rect(50, doc.y, 495, 60).fillColor('#f0f9ff').fill();
  doc.rect(50, doc.y - 60, 4, 60).fillColor(primaryBlue).fill();
  doc.fillColor(darkGray).fontSize(11).text('Token-Based Authentication', 65, doc.y - 50);
  doc.fillColor(mediumGray).fontSize(10).text(
    'Unlike traditional cookie-based auth, embed uses secure tokens sent via HTTP headers. This bypasses third-party cookie restrictions in modern browsers (Safari, Chrome) making it iframe-compatible.',
    65, doc.y + 5, { width: 470 }
  );
  doc.moveDown(3);

  doc.fontSize(10).fillColor(mediumGray);
  doc.text('• Domain Validation: Embeds only work on authorized domains');
  doc.text('• Unique Tokens: Each embed has a cryptographically secure 16-character ID');
  doc.text('• Isolated Sessions: Each embed instance has separate chat history');
  doc.text('• No Cookie Dependency: Works reliably in all iframe scenarios');
  doc.text('• Audit Trail: Last-used timestamps tracked for each embed');
  doc.moveDown(1);

  // Section 6: Domain Configuration
  doc.fontSize(16).fillColor(primaryBlue).text('6. Domain Configuration');
  doc.moveDown(0.5);

  doc.rect(50, doc.y, 495, 85).fillColor('#fffbeb').fill();
  doc.rect(50, doc.y - 85, 4, 85).fillColor(warningOrange).fill();
  doc.fillColor(darkGray).fontSize(11).text('Subdomain Support', 65, doc.y - 75);
  doc.fillColor(mediumGray).fontSize(10).text('When you set the allowed domain to rmone.com, the following are automatically allowed:', 65, doc.y + 5);
  doc.text('• rmone.com (exact match)', 75, doc.y + 8);
  doc.text('• portal.rmone.com (subdomain)', 75, doc.y + 5);
  doc.text('• app.rmone.com (subdomain)', 75, doc.y + 5);
  doc.text('• staging.portal.rmone.com (nested subdomain)', 75, doc.y + 5);
  doc.moveDown(4);

  // Section 7: Quick Start Checklist
  doc.fontSize(16).fillColor(primaryBlue).text('7. Quick Start Checklist');
  doc.moveDown(0.5);

  const checklist = [
    'Login to RMOne AI Agents as Superadmin',
    'Navigate to Integration page',
    'Click "Create New Embed Link"',
    'Enter a descriptive name (e.g., "RMOne Portal - Admin")',
    'Set the allowed domain (e.g., rmone.com)',
    'Select the appropriate role',
    'Click Create',
    'Copy the iframe code',
    'Paste into your website HTML',
    'Done! The chatbot is now embedded.'
  ];

  checklist.forEach((item, i) => {
    doc.fillColor(primaryBlue).fontSize(10).text(`${i + 1}.`, 55, doc.y + (i === 0 ? 0 : 3));
    doc.fillColor(mediumGray).text(item, 75, doc.y);
  });

  doc.moveDown(1.5);

  // Section 8: Technical Specifications
  doc.fontSize(16).fillColor(primaryBlue).text('8. Technical Specifications');
  doc.moveDown(0.5);

  const specs = [
    ['Authentication Method', 'Token-based (X-Embed-Token header)'],
    ['Token Length', '16 characters (alphanumeric)'],
    ['Session Storage', 'Browser sessionStorage (isolated per embed)'],
    ['Cookie Requirement', 'None (iframe compatible)'],
    ['Browser Support', 'All modern browsers including Safari'],
    ['Production URL', 'https://rmchat.vyaasai.com']
  ];

  specs.forEach((spec, i) => {
    const y = doc.y;
    doc.rect(50, y, 495, 22).strokeColor('#e5e7eb').stroke();
    if (i % 2 === 0) {
      doc.rect(50, y, 495, 22).fillColor('#f9fafb').fill();
    }
    doc.fillColor(darkGray).fontSize(10).text(spec[0], 60, y + 6);
    doc.fillColor(mediumGray).text(spec[1], 250, y + 6);
    doc.moveDown(0.1);
  });

  // Footer
  doc.moveDown(2);
  doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor(darkGray).text('RMOne AI Agents', { align: 'center' });
  doc.fontSize(9).fillColor(lightGray).text('Natural Language Database Query System', { align: 'center' });
  doc.text('Confidential - For Internal Use Only', { align: 'center' });
  doc.text('Document Version 2.0 | January 2026', { align: 'center' });

  doc.end();
  });
}
