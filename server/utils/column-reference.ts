export const COLUMN_REFERENCE_PROMPT = `
═══════════════════════════════════════════════════════════════
DATABASE COLUMN REFERENCE (vw_ChatBotData) - ONLY these columns exist:
═══════════════════════════════════════════════════════════════
Column Name → Synonyms (user may say any of these)
- "Fee" → cost, revenue, price, value, amount, budget, contract value, project value, deal value, dollar amount, money, sales, income
- "ChanceOfSuccess" → win rate, success rate, win percentage, close rate, conversion rate, hit rate, win ratio, probability, likelihood, chance, odds, win%, win probability (NOTE: "WinPercentage" does NOT exist as a column)
- "State" → state, location, geography, area, territory, market, geo
- "Region" → geographic region (e.g., South, Midwest, West, Northeast, Southwest, Southeast, Pacific)
- "City" → city name
- "Country" → country name
- "RequestCategory" → category, sector, industry, vertical, segment, market segment, request type
- "ProjectType" → project type, proj type (distinct from RequestCategory)
- "ServiceType" → service type, service, service category, service line, service offering
- "Company" → company, firm, organization, business, contractor, vendor, provider, OPCO
- "Client" → client, customer, account, buyer, owner, client name, customer name
- "PointOfContact" → POC, point of contact, contact, sales rep, representative, account manager, salesperson, project manager
- "ConstStartDate" → start date, date, project date, construction start date, beginning date (NOTE: "OpportunityStartDate" and "StartDate" do NOT exist)
- "ProposalDate" → proposal date, date proposal was submitted
- "ContractDate" → contract date
- "ClosedDate" → closed date, date project was closed
- "StatusChoice" → status, stage, phase, current status, project status, deal status, pipeline status
- "Title" → project name, name, title, deal name, opportunity name
- "Tags" → tags, keywords (comma-separated values)
- "ModuleName" → module, module name, source (values: Opportunity, Tracked Work, Construction)
- "Division" → division, business unit
- "Department" → department, dept, unit
- "Description" → description, details, notes, summary, overview
- "Currency" → currency, currency code
- "ProjectDuration" → project duration, duration
- "IsStrategicProject" → strategic project, is strategic
- "InterestedUserNames" → interested users, watchers
- "IsUpdated" → is updated, updated flag (values: '0' or '1')
- "InternalId" → internal ID

CRITICAL COLUMN RULES:
- "ChanceOfSuccess" is the ONLY win rate column. NEVER use "WinPercentage" - it does NOT exist.
- "ConstStartDate" is the ONLY start date column. NEVER use "OpportunityStartDate" or "StartDate" - they do NOT exist.
- When user says "revenue", "cost", "value", "amount" → they mean the "Fee" column.
- When user says "win rate", "probability", "chance", "likelihood" → they mean the "ChanceOfSuccess" column.
- When user says "category", "sector", "industry" → they mean the "RequestCategory" column.
- When user says "type" → they typically mean "ProjectType" (unless they say "request category" explicitly).
- "opportunities" in user questions usually refers to RequestCategory values, NOT the ModuleName column.
═══════════════════════════════════════════════════════════════
`;

export const VALID_COLUMN_NAMES = new Set([
  'Client', 'Company', 'RequestCategory', 'ProjectType', 'Division', 'Department',
  'PointOfContact', 'StatusChoice', 'Fee', 'ChanceOfSuccess', 'ConstStartDate',
  'State', 'Region', 'Title', 'Tags', 'ModuleName', 'ServiceType', 'City',
  'Country', 'ProposalDate', 'ContractDate', 'ClosedDate', 'ProjectDuration',
  'Currency', 'TenantName', 'Closed', 'Deleted', 'InterestedUserNames',
  'IsStrategicProject', 'Description', 'InternalId', 'IsUpdated',
]);
