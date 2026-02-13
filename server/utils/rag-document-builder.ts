/**
 * RAG Document Builder
 * Converts query templates into atomic vector documents
 */

import { VectorDocument } from './rag-store';

// ═══════════════════════════════════════════════════════════════
// FUNCTION DOCUMENT BUILDER
// ═══════════════════════════════════════════════════════════════

export function buildFunctionDocuments(queryTemplates: Record<string, any>): VectorDocument[] {
  const documents: VectorDocument[] = [];

  // Function descriptions and examples
  const functionMetadata: Record<string, { description: string; examples: string[] }> = {
    get_projects_by_year: {
      description: 'Retrieves all projects that started in a specific year',
      examples: [
        'Show me projects from 2024',
        'What projects started in 2023?',
        'All 2025 projects'
      ]
    },
    get_projects_by_date_range: {
      description: 'Retrieves projects within a specific date range',
      examples: [
        'Projects between January and March 2024',
        'Show me projects from Q1 2025',
        'Projects starting from 2023-01-01 to 2023-12-31'
      ]
    },
    get_projects_by_quarter: {
      description: 'Retrieves projects that started in a specific quarter of a year',
      examples: [
        'Show me Q4 2024 projects',
        'Projects in the first quarter of 2025',
        'Q2 projects'
      ]
    },
    get_projects_by_years: {
      description: 'Retrieves projects from multiple specific years',
      examples: [
        'Projects from 2023 and 2024',
        'Show me projects from 2022, 2023, and 2024'
      ]
    },
    get_largest_projects: {
      description: 'Returns the largest projects sorted by fee amount',
      examples: [
        'Top 10 largest projects',
        'Show me the biggest projects',
        'Most expensive projects'
      ]
    },
    get_smallest_projects: {
      description: 'Returns the smallest projects sorted by fee amount',
      examples: [
        'Smallest projects',
        'Cheapest projects',
        'Projects with lowest fees'
      ]
    },
    get_largest_in_region: {
      description: 'Returns largest projects in a specific state or region',
      examples: [
        'Largest projects in California',
        'Top projects in NY',
        'Biggest projects in Texas'
      ]
    },
    get_largest_by_category: {
      description: 'Returns largest projects in a specific category',
      examples: [
        'Largest healthcare projects',
        'Top education projects',
        'Biggest commercial projects'
      ]
    },
    get_projects_by_category: {
      description: 'Retrieves all projects in a specific category',
      examples: [
        'Healthcare projects',
        'Show me education projects',
        'All commercial projects'
      ]
    },
    get_projects_by_project_type: {
      description: 'Retrieves projects of a specific type',
      examples: [
        'Hospital projects',
        'School building projects',
        'Office tower projects'
      ]
    },
    get_projects_by_multiple_categories: {
      description: 'Retrieves projects from multiple categories',
      examples: [
        'Healthcare and education projects',
        'Commercial or residential projects'
      ]
    },
    get_largest_by_tags: {
      description: 'Returns largest projects with specific tags',
      examples: [
        'Largest Rail projects',
        'Top Transit tagged projects'
      ]
    },
    get_projects_by_tags: {
      description: 'Retrieves projects with specific tags',
      examples: [
        'Rail projects',
        'Transit projects',
        'Projects tagged with Infrastructure'
      ]
    },
    get_projects_by_multiple_tags: {
      description: 'Retrieves projects with multiple specific tags',
      examples: [
        'Projects with Rail and Transit tags',
        'Infrastructure and Urban projects'
      ]
    },
    get_projects_by_combined_filters: {
      description: 'Retrieves projects using multiple filters: size, date, status, location, category',
      examples: [
        'Mega projects starting in the next 6 months',
        'Large healthcare projects in California',
        'Medium sized projects in Q4 2024'
      ]
    },
    get_projects_by_status: {
      description: 'Retrieves projects by their current status',
      examples: [
        'Lead projects',
        'Awarded projects',
        'Active projects'
      ]
    },
    get_projects_by_company: {
      description: 'Retrieves projects associated with a specific company',
      examples: [
        'Projects by Company A',
        'All Company B projects'
      ]
    },
    get_projects_by_client: {
      description: 'Retrieves projects for a specific client',
      examples: [
        'Projects for Client XYZ',
        'All ABC client projects'
      ]
    },
    count_projects: {
      description: 'Counts total number of projects matching criteria',
      examples: [
        'How many projects?',
        'Count of healthcare projects',
        'Total number of projects in 2024'
      ]
    },
    get_projects_by_location: {
      description: 'Retrieves projects in a specific state or location',
      examples: [
        'Projects in California',
        'NY projects',
        'Texas construction projects'
      ]
    }
  };

  // Build atomic function documents
  for (const [funcName, template] of Object.entries(queryTemplates)) {
    const metadata = functionMetadata[funcName] || {
      description: `Query function: ${funcName}`,
      examples: []
    };

    documents.push({
      id: `func_${funcName}`,
      type: 'function',
      content: {
        function_name: funcName,
        description: metadata.description,
        parameters: template.params || [],
        param_types: template.param_types || [],
        optional_params: template.optional_params || [],
        chart_type: template.chart_type,
        examples: metadata.examples
      },
      metadata: {
        atomic: true,
        complete: true,
        category: 'query_function'
      }
    });
  }

  return documents;
}

// ═══════════════════════════════════════════════════════════════
// SCHEMA DOCUMENT BUILDER
// ═══════════════════════════════════════════════════════════════

export function buildSchemaDocuments(): VectorDocument[] {
  return [
    {
      id: 'schema_field_Fee',
      type: 'schema',
      content: {
        field: 'Fee',
        meaning: 'Project cost, budget, or contract value in dollars',
        categories: {
          'Micro': 'Less than $35,000',
          'Small': '$35,000 - $90,000',
          'Medium': '$90,000 - $250,000',
          'Large': '$250,000 - $1,319,919',
          'Mega': 'Greater than $1,319,919'
        },
        examples: ['$100,000', '$2.5M', '$925M']
      },
      metadata: {
        atomic: true,
        complete: true,
        category: 'database_schema'
      }
    },
    {
      id: 'schema_field_StartDate',
      type: 'schema',
      content: {
        field: 'Start Date',
        meaning: 'Date when the project begins or is scheduled to start',
        examples: ['2024-01-15', '2025-06-30']
      },
      metadata: {
        atomic: true,
        complete: true,
        category: 'database_schema'
      }
    },
    {
      id: 'schema_field_Status',
      type: 'schema',
      content: {
        field: 'Status',
        meaning: 'Current stage or state of the project',
        values: ['Lead', 'Awarded', 'Active', 'Completed', 'On Hold'],
        examples: ['Lead status means potential project', 'Awarded means contract signed']
      },
      metadata: {
        atomic: true,
        complete: true,
        category: 'database_schema'
      }
    },
    {
      id: 'schema_field_Category',
      type: 'schema',
      content: {
        field: 'Request Category',
        meaning: 'Industry or sector classification of the project',
        examples: ['Healthcare', 'Education', 'Commercial', 'Residential', 'Infrastructure']
      },
      metadata: {
        atomic: true,
        complete: true,
        category: 'database_schema'
      }
    },
    {
      id: 'schema_field_ProjectType',
      type: 'schema',
      content: {
        field: 'Project Type',
        meaning: 'Specific type or classification of construction project',
        examples: ['Hospitals', 'Schools', 'Office Buildings', 'Roads', 'Bridges']
      },
      metadata: {
        atomic: true,
        complete: true,
        category: 'database_schema'
      }
    },
    {
      id: 'schema_field_State',
      type: 'schema',
      content: {
        field: 'State',
        meaning: 'US state abbreviation where project is located',
        examples: ['CA (California)', 'NY (New York)', 'TX (Texas)']
      },
      metadata: {
        atomic: true,
        complete: true,
        category: 'database_schema'
      }
    }
  ];
}

// ═══════════════════════════════════════════════════════════════
// PARAMETER MAPPING DOCUMENTS
// ═══════════════════════════════════════════════════════════════

export function buildParameterDocuments(): VectorDocument[] {
  return [
    {
      id: 'param_size_mega',
      type: 'parameter',
      content: {
        user_term: 'mega',
        meaning: 'Projects with fee greater than $1,319,919',
        aliases: ['huge', 'massive', 'largest', 'biggest', 'giant']
      },
      metadata: {
        atomic: true,
        complete: true,
        category: 'parameter_mapping'
      }
    },
    {
      id: 'param_size_large',
      type: 'parameter',
      content: {
        user_term: 'large',
        meaning: 'Projects with fee between $250,000 and $1,319,919',
        aliases: ['big', 'major']
      },
      metadata: {
        atomic: true,
        complete: true,
        category: 'parameter_mapping'
      }
    },
    {
      id: 'param_size_medium',
      type: 'parameter',
      content: {
        user_term: 'medium',
        meaning: 'Projects with fee between $90,000 and $250,000',
        aliases: ['mid-sized', 'moderate']
      },
      metadata: {
        atomic: true,
        complete: true,
        category: 'parameter_mapping'
      }
    },
    {
      id: 'param_size_small',
      type: 'parameter',
      content: {
        user_term: 'small',
        meaning: 'Projects with fee between $35,000 and $90,000',
        aliases: ['minor', 'little']
      },
      metadata: {
        atomic: true,
        complete: true,
        category: 'parameter_mapping'
      }
    },
    {
      id: 'param_size_micro',
      type: 'parameter',
      content: {
        user_term: 'micro',
        meaning: 'Projects with fee less than $35,000',
        aliases: ['tiny', 'smallest', 'minimal']
      },
      metadata: {
        atomic: true,
        complete: true,
        category: 'parameter_mapping'
      }
    },
    {
      id: 'param_time_q1',
      type: 'parameter',
      content: {
        user_term: 'Q1',
        meaning: 'First quarter: January, February, March (months 1-3)',
        aliases: ['first quarter', 'Q1', 'quarter 1', 'Jan-Mar']
      },
      metadata: {
        atomic: true,
        complete: true,
        category: 'parameter_mapping'
      }
    },
    {
      id: 'param_time_q2',
      type: 'parameter',
      content: {
        user_term: 'Q2',
        meaning: 'Second quarter: April, May, June (months 4-6)',
        aliases: ['second quarter', 'Q2', 'quarter 2', 'Apr-Jun']
      },
      metadata: {
        atomic: true,
        complete: true,
        category: 'parameter_mapping'
      }
    },
    {
      id: 'param_time_q3',
      type: 'parameter',
      content: {
        user_term: 'Q3',
        meaning: 'Third quarter: July, August, September (months 7-9)',
        aliases: ['third quarter', 'Q3', 'quarter 3', 'Jul-Sep']
      },
      metadata: {
        atomic: true,
        complete: true,
        category: 'parameter_mapping'
      }
    },
    {
      id: 'param_time_q4',
      type: 'parameter',
      content: {
        user_term: 'Q4',
        meaning: 'Fourth quarter: October, November, December (months 10-12)',
        aliases: ['fourth quarter', 'Q4', 'quarter 4', 'Oct-Dec']
      },
      metadata: {
        atomic: true,
        complete: true,
        category: 'parameter_mapping'
      }
    },
    {
      id: 'param_time_next_months',
      type: 'parameter',
      content: {
        user_term: 'next months',
        meaning: 'Time period starting from today extending forward',
        aliases: ['upcoming months', 'coming months', 'next few months']
      },
      metadata: {
        atomic: true,
        complete: true,
        category: 'parameter_mapping'
      }
    },
    {
      id: 'param_time_last_months',
      type: 'parameter',
      content: {
        user_term: 'last months',
        meaning: 'Time period going backwards from today',
        aliases: ['past months', 'previous months', 'recent months']
      },
      metadata: {
        atomic: true,
        complete: true,
        category: 'parameter_mapping'
      }
    }
  ];
}

// ═══════════════════════════════════════════════════════════════
// EXAMPLE QUERY DOCUMENTS
// ═══════════════════════════════════════════════════════════════

export function buildExampleDocuments(): VectorDocument[] {
  return [
    {
      id: 'example_1',
      type: 'example',
      content: {
        question: 'Show me all mega sized projects starting in the next ten months',
        function: 'get_projects_by_combined_filters',
        params: { size: 'Mega', time_reference: 'next ten months' },
        success: true
      },
      metadata: {
        atomic: true,
        complete: true,
        category: 'successful_query'
      }
    },
    {
      id: 'example_2',
      type: 'example',
      content: {
        question: 'Top 10 largest healthcare projects',
        function: 'get_largest_by_category',
        params: { category: 'Healthcare', limit: 10 },
        success: true
      },
      metadata: {
        atomic: true,
        complete: true,
        category: 'successful_query'
      }
    },
    {
      id: 'example_3',
      type: 'example',
      content: {
        question: 'Projects in California in Q4 2024',
        function: 'get_projects_by_combined_filters',
        params: { state_code: 'CA', year: 2024, quarter: 4 },
        success: true
      },
      metadata: {
        atomic: true,
        complete: true,
        category: 'successful_query'
      }
    },
    {
      id: 'example_4',
      type: 'example',
      content: {
        question: 'Large projects starting next year',
        function: 'get_projects_by_combined_filters',
        params: { size: 'Large', time_reference: 'next year' },
        success: true
      },
      metadata: {
        atomic: true,
        complete: true,
        category: 'successful_query'
      }
    },
    {
      id: 'example_5',
      type: 'example',
      content: {
        question: 'How many healthcare projects are there?',
        function: 'count_projects',
        params: { category: 'Healthcare' },
        success: true
      },
      metadata: {
        atomic: true,
        complete: true,
        category: 'successful_query'
      }
    },
    {
      id: 'example_active_opp_1',
      type: 'example',
      content: {
        question: 'Which clients represent more than 5% of our total active opportunity value in 2026, and what sectors are they concentrated in 2025',
        function: 'ai_data_analysis',
        params: { analysis_question: 'Identify which clients represent more than 5% of total active opportunity fee value in 2026, and analyze sector concentration in 2025', status: null, start_date: '2025-01-01', end_date: '2026-12-31', min_fee: null, max_fee: null },
        success: true,
        notes: 'active opportunity = no specific status filter (system expands to all open statuses). Multi-year = date range spans both 2025 and 2026. No fee filter needed.'
      },
      metadata: {
        atomic: true,
        complete: true,
        category: 'successful_query'
      }
    },
    {
      id: 'example_active_opp_2',
      type: 'example',
      content: {
        question: 'What is the total pipeline value of active opportunities',
        function: 'ai_data_analysis',
        params: { analysis_question: 'Calculate total pipeline value of all active opportunities', status: null, min_fee: null, max_fee: null },
        success: true,
        notes: 'active opportunities = no specific status. No fee constraint. System expands to all open statuses.'
      },
      metadata: {
        atomic: true,
        complete: true,
        category: 'successful_query'
      }
    },
    {
      id: 'example_multi_year_1',
      type: 'example',
      content: {
        question: 'Compare revenue by category in 2024 versus 2025',
        function: 'ai_data_analysis',
        params: { analysis_question: 'Compare revenue by category between 2024 and 2025', start_date: '2024-01-01', end_date: '2025-12-31' },
        success: true,
        notes: 'Multi-year comparison: date range must cover both years mentioned.'
      },
      metadata: {
        atomic: true,
        complete: true,
        category: 'successful_query'
      }
    },
    {
      id: 'example_multi_year_2',
      type: 'example',
      content: {
        question: 'How has win rate changed from 2023 to 2026',
        function: 'ai_data_analysis',
        params: { analysis_question: 'Analyze win rate trends from 2023 to 2026', start_date: '2023-01-01', end_date: '2026-12-31' },
        success: true,
        notes: 'Multi-year range: covers all years from 2023 through 2026.'
      },
      metadata: {
        atomic: true,
        complete: true,
        category: 'successful_query'
      }
    },
    {
      id: 'example_no_fee_filter',
      type: 'example',
      content: {
        question: 'Predict which projects will close this quarter',
        function: 'ai_data_analysis',
        params: { analysis_question: 'Predict which projects are most likely to close this quarter', min_fee: null, max_fee: null, time_reference: 'this quarter' },
        success: true,
        notes: 'No fee mentioned in question = no fee filter. Never default min_fee/max_fee to 0.'
      },
      metadata: {
        atomic: true,
        complete: true,
        category: 'successful_query'
      }
    },
    {
      id: 'example_active_pipeline',
      type: 'example',
      content: {
        question: 'Analyze our active pipeline by region',
        function: 'ai_data_analysis',
        params: { analysis_question: 'Analyze the active pipeline by region', status: null },
        success: true,
        notes: 'active pipeline = no specific status (system expands to all open statuses). No fee constraint.'
      },
      metadata: {
        atomic: true,
        complete: true,
        category: 'successful_query'
      }
    },
    {
      id: 'example_percentage_share',
      type: 'example',
      content: {
        question: 'Which companies account for the largest share of total revenue in 2025',
        function: 'ai_data_analysis',
        params: { analysis_question: 'Identify which companies account for the largest share of total revenue in 2025', start_date: '2025-01-01', end_date: '2025-12-31', min_fee: null, max_fee: null },
        success: true,
        notes: 'Percentage/share analysis. No fee filter needed - analyzing all projects for share calculation.'
      },
      metadata: {
        atomic: true,
        complete: true,
        category: 'successful_query'
      }
    }
  ];
}

// ═══════════════════════════════════════════════════════════════
// MAIN BUILDER
// ═══════════════════════════════════════════════════════════════

export function buildAllDocuments(queryTemplates: Record<string, any>): VectorDocument[] {
  const functionDocs = buildFunctionDocuments(queryTemplates);
  const schemaDocs = buildSchemaDocuments();
  const paramDocs = buildParameterDocuments();
  const exampleDocs = buildExampleDocuments();

  const allDocs = [
    ...functionDocs,
    ...schemaDocs,
    ...paramDocs,
    ...exampleDocs
  ];

  console.log(`[RAG] Built ${allDocs.length} atomic documents:`);
  console.log(`  - ${functionDocs.length} function definitions`);
  console.log(`  - ${schemaDocs.length} schema definitions`);
  console.log(`  - ${paramDocs.length} parameter mappings`);
  console.log(`  - ${exampleDocs.length} example queries`);

  return allDocs;
}
