import { COLUMN_REFERENCE_PROMPT } from "./column-reference";

/**
 * OpenAI Client
 * Direct OpenAI API integration (not Azure)
 * 
 * Supports multiple models:
 * - gpt-4o-mini: Fast classification (~1-2 seconds)
 * - gpt-4o: Latest model with superior reasoning and accuracy
 * 
 * GPT-5.2 Features:
 * - 400K context window (vs 128K for GPT-4o)
 * - 128K max output tokens
 * - 6.2% hallucination rate (lowest in industry)
 * - reasoning.effort parameter: "none" | "low" | "medium" | "high" | "xhigh"
 * 
 * Supports multiple API keys with automatic failover:
 * - Primary key: OPENAI_API_KEY
 * - Backup key: OPENAI_API_KEY_BACKUP (optional - from different organization)
 * - When primary hits rate limits, automatically switches to backup
 */

import OpenAI from 'openai';

export interface FunctionDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

export interface Classification {
  function_name: string;
  arguments: Record<string, any>;
  error?: string;
  retryAfter?: number;
}

export class OpenAIClient {
  private client: OpenAI;
  private backupClient: OpenAI | null = null;
  private model: string;
  private usingBackup: boolean = false;
  private primaryRateLimitedUntil: number = 0; // Timestamp when primary can be used again
  private backupRateLimitedUntil: number = 0; // Timestamp when backup can be used again

  constructor(apiKey: string, model: string = 'gpt-5.1') {
    // Always use direct OpenAI API with user's API key
    console.log(`[OpenAI] Using direct OpenAI API with model: ${model}`);
    this.client = new OpenAI({ apiKey, timeout: 120000 });
    this.model = model;
    
    // Check for backup API key (from different organization for rate limit resilience)
    const backupKey = process.env.OPENAI_API_KEY_BACKUP;
    if (backupKey && backupKey !== apiKey) {
      this.backupClient = new OpenAI({ apiKey: backupKey, timeout: 120000 });
      console.log('[OpenAI] ✓ Backup API key configured for failover');
    }
  }
  
  // Get the active client (primary or backup based on rate limit status)
  private getActiveClient(): { client: OpenAI; isBackup: boolean } {
    const now = Date.now();
    const primaryAvailable = this.primaryRateLimitedUntil <= now;
    const backupAvailable = this.backupClient && this.backupRateLimitedUntil <= now;
    
    // If primary is available and not rate limited, use primary
    if (primaryAvailable && !this.usingBackup) {
      return { client: this.client, isBackup: false };
    }
    
    // If backup is available and primary is rate limited, use backup
    if (backupAvailable && !primaryAvailable) {
      if (!this.usingBackup) {
        console.log('[OpenAI] Using backup API key (primary still rate limited)');
      }
      this.usingBackup = true;
      return { client: this.backupClient!, isBackup: true };
    }
    
    // If backup is available and we were using backup, continue with backup
    if (backupAvailable && this.usingBackup) {
      return { client: this.backupClient!, isBackup: true };
    }
    
    // If primary is available now, switch back
    if (primaryAvailable && this.usingBackup) {
      this.usingBackup = false;
      console.log('[OpenAI] Switching back to primary API key');
      return { client: this.client, isBackup: false };
    }
    
    // Both rate limited - use whichever has shorter wait time
    if (this.backupClient && this.backupRateLimitedUntil < this.primaryRateLimitedUntil) {
      return { client: this.backupClient, isBackup: true };
    }
    
    return { client: this.client, isBackup: false };
  }
  
  // Mark primary as rate limited
  private markPrimaryRateLimited(retryAfterSeconds: number): void {
    this.primaryRateLimitedUntil = Date.now() + (retryAfterSeconds * 1000);
    console.log(`[OpenAI] Primary API key rate limited for ${retryAfterSeconds}s`);
  }
  
  // Mark backup as rate limited
  private markBackupRateLimited(retryAfterSeconds: number): void {
    this.backupRateLimitedUntil = Date.now() + (retryAfterSeconds * 1000);
    console.log(`[OpenAI] Backup API key rate limited for ${retryAfterSeconds}s`);
  }
  
  // Switch to backup client when primary hits rate limit
  private switchToBackup(retryAfterSeconds: number): boolean {
    if (!this.backupClient) {
      return false;
    }
    
    // Mark primary as rate limited
    this.markPrimaryRateLimited(retryAfterSeconds);
    
    // Check if backup is available
    const now = Date.now();
    if (this.backupRateLimitedUntil <= now) {
      this.usingBackup = true;
      console.log(`[OpenAI] ⚡ Switching to backup API key`);
      return true;
    }
    
    console.log(`[OpenAI] Backup also rate limited, waiting...`);
    return false;
  }
  
  // Handle rate limit error - track which key was rate limited
  private handleRateLimit(isBackup: boolean, retryAfterSeconds: number): void {
    if (isBackup) {
      this.markBackupRateLimited(retryAfterSeconds);
    } else {
      this.markPrimaryRateLimited(retryAfterSeconds);
    }
  }

  async classifyQuery(
    userQuestion: string,
    functions: FunctionDefinition[]
  ): Promise<Classification> {
    const today = new Date().toISOString().split('T')[0];
    const systemPrompt = `You are an expert function classifier for a database query system containing project/proposal data.

TODAY'S DATE: ${today}

Your job is to select the BEST function and extract parameters from user questions.
CRITICAL: For relative time phrases like "last N years", "past N months", calculate actual dates using today's date.

${COLUMN_REFERENCE_PROMPT}

═══════════════════════════════════════════════════════════════
CRITICAL INSTRUCTIONS:
═══════════════════════════════════════════════════════════════
1. CALCULATE DATES: For "last N years/months", calculate actual start_date and end_date using today's date
2. EXTRACT ALL: Extract ALL mentioned filters - entities, status, dates, amounts, categories
3. "limit" extraction: If user says "top N", "first N", extract limit: N
4. "YEAR or later" → start_date: "YEAR-01-01" (inclusive)
5. "after YEAR" → start_date: "YEAR+1-01-01" (exclusive)
6. PRESERVE EXACT TEXT: Keep entity names, keywords exactly as user stated them

═══════════════════════════════════════════════════════════════
COMPREHENSIVE FEW-SHOT EXAMPLES:
═══════════════════════════════════════════════════════════════

--- PROJECT LOOKUPS ---
User: "Show me project PID19" or "get PID 19"
→ {"function_name": "get_project_by_id", "arguments": {"project_name": "PID19"}}

User: "projects between PID 1 to PID 50"
→ {"function_name": "get_project_by_id", "arguments": {"pid_start": 1, "pid_end": 50}}

--- STATUS FILTERING ---
User: "Show won projects"
→ {"function_name": "get_projects_by_status", "arguments": {"status": "Won"}}

User: "projects that are submitted or pursuing"
→ {"function_name": "get_projects_by_status", "arguments": {"status": ["Submitted", "Pursuing"]}}

--- SIZE FILTERING ---
User: "mega sized projects" or "large projects"
→ {"function_name": "get_projects_by_combined_filters", "arguments": {"size": "Mega"}}

User: "small projects under 1 million"
→ {"function_name": "get_projects_by_fee_range", "arguments": {"max_fee": 1000000}}

--- FEE/VALUE FILTERING ---
User: "projects over 10 million"
→ {"function_name": "get_projects_by_fee_range", "arguments": {"min_fee": 10000000}}

User: "projects between 5 and 20 million"
→ {"function_name": "get_projects_by_fee_range", "arguments": {"min_fee": 5000000, "max_fee": 20000000}}

--- WIN RATE FILTERING ---
User: "projects with 80% win rate"
→ {"function_name": "get_projects_by_win_range", "arguments": {"min_win": 80, "max_win": 80}}

User: "high probability projects above 70%"
→ {"function_name": "get_projects_by_win_range", "arguments": {"min_win": 70}}

--- CATEGORY FILTERING ---
User: "Transportation projects"
→ {"function_name": "get_projects_by_category", "arguments": {"category": "Transportation"}}

User: "Healthcare and Education projects"
→ {"function_name": "get_projects_by_combined_filters", "arguments": {"categories": ["Healthcare", "Education"]}}

--- GEOGRAPHIC FILTERING ---
User: "projects in California"
→ {"function_name": "get_projects_by_state", "arguments": {"state_code": "California"}}

User: "projects in the midwest" or "western region projects"
→ {"function_name": "get_projects_by_combined_filters", "arguments": {"region": "midwest"}}

--- DATE FILTERING ---
User: "projects starting in 2025 or later"
→ {"function_name": "get_projects_by_combined_filters", "arguments": {"start_date": "2025-01-01"}}

User: "projects from last 6 months"
→ {"function_name": "get_projects_by_combined_filters", "arguments": {"start_date": "2025-07-20", "end_date": "2026-01-20"}}

User: "projects from last 10 years" or "past 10 years"
→ {"function_name": "get_projects_by_combined_filters", "arguments": {"start_date": "2016-01-20", "end_date": "2026-01-20"}}

CRITICAL DATE RULE: For relative time like "last N years/months/days", CALCULATE the actual dates:
- start_date = today's date minus N years/months/days
- end_date = today's date
Example: If today is 2026-01-20, then "last 10 years" → start_date="2016-01-20", end_date="2026-01-20"

--- AGGREGATION/BREAKDOWN ---
User: "breakdown by category" or "group projects by category"
→ {"function_name": "get_category_breakdown", "arguments": {}}

User: "breakdown by state" or "projects by region"
→ {"function_name": "compare_states", "arguments": {}}

User: "group by year" or "yearly breakdown"
→ {"function_name": "compare_years", "arguments": {}}

User: "status breakdown" or "group by status"
→ {"function_name": "get_status_breakdown", "arguments": {}}

User: "project size distribution" or "breakdown by size"
→ {"function_name": "get_size_distribution", "arguments": {}}

--- RANKING/TOP N ---
User: "top 10 largest projects"
→ {"function_name": "get_largest_projects", "arguments": {"limit": 10}}

User: "top 5 clients by revenue"
→ {"function_name": "get_top_clients", "arguments": {"limit": 5}}

User: "most common project titles" or "top titles"
→ {"function_name": "get_top_titles", "arguments": {}}

--- TAGS ---
User: "projects with Rail and Transit tags"
→ {"function_name": "get_projects_by_multiple_tags", "arguments": {"tags": ["Rail", "Transit"]}}

User: "show me aviation projects"
→ {"function_name": "get_projects_by_project_type", "arguments": {"project_type": "Aviation"}}

--- POC/SALES REP ---
User: "projects managed by John Smith"
→ {"function_name": "get_projects_by_poc", "arguments": {"poc": "John Smith"}}

User: "top sales reps"
→ {"function_name": "get_top_pocs", "arguments": {}}

--- CLIENT/COMPANY/POC ---
User: "projects for ABC Company" or "ABC Company projects"
→ {"function_name": "get_projects_by_client", "arguments": {"client": "ABC Company"}}

User: "show me Google projects" or "projects by Google"
→ {"function_name": "search_projects_by_keyword", "arguments": {"keyword": "Google"}}

User: "John's projects" or "projects handled by John Smith"
→ {"function_name": "get_projects_by_poc", "arguments": {"poc": "John Smith"}}

User: "top clients" or "best clients"
→ {"function_name": "get_top_clients", "arguments": {}}

--- KEYWORD/ENTITY SEARCH ---
User: "search for highway" or "find highway projects"
→ {"function_name": "search_projects_by_keyword", "arguments": {"keyword": "highway"}}

User: "waste water projects" or "wastewater treatment"
→ {"function_name": "search_projects_by_keyword", "arguments": {"keyword": "waste water"}}

User: "list Residential: Affordable Housing" or "affordable housing projects"
→ {"function_name": "get_projects_by_project_type", "arguments": {"project_type": "Residential: Affordable Housing"}}

--- COMPLEX/COMBINED MULTI-FILTER ---
User: "won Transportation projects in California over 5 million"
→ {"function_name": "get_projects_by_combined_filters", "arguments": {"status": "Won", "category": "Transportation", "state_code": "California", "min_fee": 5000000}}

User: "open Healthcare projects in Texas from 2024"
→ {"function_name": "get_projects_by_combined_filters", "arguments": {"status": ["Submitted", "Proposal", "Pursuing"], "category": "Healthcare", "state_code": "Texas", "start_date": "2024-01-01"}}

User: "Acme Corp projects that are won in the last 2 years"
→ {"function_name": "search_projects_by_keyword", "arguments": {"keyword": "Acme Corp", "status": "Won", "start_date": "<calculated_2_years_ago>", "end_date": "<today>"}}

═══════════════════════════════════════════════════════════════
COMPREHENSIVE UNDERSTANDING RULES:
═══════════════════════════════════════════════════════════════
1. EXTRACT ALL FILTERS mentioned in the question - status, category, location, dates, amounts, entities
2. PRESERVE EXACT ENTITY NAMES - Use the exact company/client/POC names as stated by user
3. HANDLE SYNONYMS:
   - "open/active" → status: ["Submitted", "Proposal", "Pursuing"]
   - "closed" → status: ["Won", "Lost"]
   - "value/worth/amount" → fee range
   - "probability/chance/likelihood" → win rate
   - "region/area" → state or geographic area
4. UNDERSTAND CONTEXT: If user says "show me XYZ" where XYZ is not a known category, treat it as keyword search
5. COMBINE MULTIPLE FILTERS: When user mentions multiple criteria, include ALL in arguments

Return ONLY valid JSON with "function_name" and "arguments" fields.`;

    const maxRetries = 5; // Increased for better rate limit handling with 200+ concurrent users
    let lastError: any;
    let triedBackup = false; // Track if we've already tried switching to backup

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      let responseText = ""; // Declare outside try block for error logging
      try {
        // Use the active client (primary or backup based on rate limit status)
        const { client: activeClient, isBackup } = this.getActiveClient();
        
        // Build request with GPT-5.2 reasoning parameter for xhigh accuracy
        const requestParams: any = {
          model: this.model,
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Question: "${userQuestion}"\n\nAvailable functions: ${JSON.stringify(functions, null, 2)}\n\nSelect the best function and extract parameters.`,
            },
          ],
          // Increased to 2500 to ensure GPT-5.2 has enough tokens for complex reasoning + JSON output
          max_completion_tokens: 2500,
        };
        
        // Log which model is being used
        console.log(`[OpenAI] Using model: ${this.model} for query classification`);
        
        // Note: reasoning.effort parameter may require specific SDK version
        // Commenting out for now until SDK compatibility is verified
        // if (this.model.startsWith('gpt-5.2')) {
        //   requestParams.reasoning = { effort: "xhigh" };
        // } else if (this.model.startsWith('gpt-5.1')) {
        //   requestParams.reasoning = { effort: "high" };
        // }
        
        const response = await activeClient.chat.completions.create(requestParams);

        responseText = response.choices?.[0]?.message?.content || "";
        
        // Debug logging for GPT-5 empty responses
        if (!responseText || responseText.trim().length === 0) {
          console.error(`[GPT-5] Empty response received for question: "${userQuestion}"`);
          console.error(`[GPT-5] Response object:`, JSON.stringify(response.choices?.[0], null, 2));
          console.error(`[GPT-5] Finish reason:`, response.choices?.[0]?.finish_reason);
        }

        // Clean up response (remove markdown code blocks)
        if (responseText.includes("```json")) {
          const jsonStart = responseText.indexOf("```json") + 7;
          const jsonEnd = responseText.indexOf("```", jsonStart);
          responseText = responseText.substring(jsonStart, jsonEnd).trim();
        } else if (responseText.includes("```")) {
          const jsonStart = responseText.indexOf("```") + 3;
          const jsonEnd = responseText.indexOf("```", jsonStart);
          responseText = responseText.substring(jsonStart, jsonEnd).trim();
        }

        // Check for empty response - GPT-5 sometimes returns empty content
        if (!responseText || responseText.trim().length === 0) {
          throw new SyntaxError("Empty response from GPT-5");
        }

        // Extract JSON object
        if (responseText.includes("{") && responseText.includes("}")) {
          const jsonStart = responseText.indexOf("{");
          const jsonEnd = responseText.lastIndexOf("}") + 1;
          responseText = responseText.substring(jsonStart, jsonEnd);
        } else {
          // No JSON object found in response
          throw new SyntaxError(`No JSON object found in response: ${responseText.substring(0, 100)}`);
        }

        const result = JSON.parse(responseText);

        return {
          function_name: result.function_name || "none",
          arguments: result.arguments || {},
        };
      } catch (error: any) {
        lastError = error;
        const { isBackup } = this.getActiveClient();

        // Check for auth errors (401) - try backup key immediately
        if (error.status === 401 && !triedBackup && this.backupClient) {
          triedBackup = true;
          this.usingBackup = true;
          console.log(`[OpenAI] Primary API key auth failed (401), switching to backup API key...`);
          continue;
        }

        // Check for rate limit errors - try backup first, then exponential backoff
        if (error.status === 429) {
          const retryAfter = error.headers?.['retry-after'] 
            ? parseInt(error.headers['retry-after']) 
            : Math.min(2 ** attempt * 2, 30); // Exponential backoff: 2s, 4s, 8s... max 30s
          
          // Track which key was rate limited
          this.handleRateLimit(isBackup, retryAfter);
          
          // Try switching to backup API key if available and haven't tried yet
          if (!triedBackup && this.backupClient) {
            triedBackup = true;
            // Check if backup is available
            const now = Date.now();
            if (this.backupRateLimitedUntil <= now) {
              this.usingBackup = true;
              console.log(`[OpenAI] Primary rate limited, immediately trying backup API key...`);
              continue; // Retry immediately with backup key (no wait)
            }
          }
          
          // Find the shortest wait time between both keys
          const now = Date.now();
          const primaryWait = Math.max(0, this.primaryRateLimitedUntil - now) / 1000;
          const backupWait = this.backupClient ? Math.max(0, this.backupRateLimitedUntil - now) / 1000 : Infinity;
          const minWait = Math.min(primaryWait, backupWait, retryAfter);
          
          console.warn(`[OpenAI] Both keys rate limited (attempt ${attempt + 1}/${maxRetries}), waiting ${Math.ceil(minWait)}s...`);
          
          // Auto-retry after waiting
          if (attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, Math.max(minWait * 1000, 1000)));
            continue; // Retry the request
          }
          
          // Last attempt - return rate limit error to user
          return {
            function_name: "none",
            arguments: {},
            error: "rate_limit",
            retryAfter: Math.ceil(minWait),
          };
        }
        
        // Check if it's a JSON parsing error - GPT sometimes returns malformed JSON
        const isJSONError = error instanceof SyntaxError && error.message?.includes('JSON');
        
        // Check if it's a transient error worth retrying
        const isTransientError = 
          error.name === 'APIConnectionError' ||
          error.message?.includes('timeout') ||
          error.message?.includes('ECONNRESET') ||
          error.message?.includes('ETIMEDOUT') ||
          error.message?.includes('network') ||
          isJSONError; // Add JSON parsing errors to retry list
        
        // If it's the last attempt or not a transient error, bail out
        if (attempt === maxRetries - 1 || !isTransientError) {
          // Log the raw response for debugging JSON issues (only if we have it)
          if (isJSONError && responseText) {
            console.error(`[GPT-5] JSON parsing failed after ${attempt + 1} attempt(s)`);
            console.error(`[GPT-5] Raw response (first 500 chars): ${responseText.substring(0, 500)}`);
          } else {
            console.error(`OpenAI classification failed after ${attempt + 1} attempt(s):`, error);
          }
          return {
            function_name: "none",
            arguments: {},
            error: String(error),
          };
        }
        
        // Log retry and wait before next attempt
        if (isJSONError) {
          console.warn(`[GPT-5] Attempt ${attempt + 1} returned malformed JSON, retrying...`);
          if (responseText) {
            console.warn(`[GPT-5] Malformed response (first 200 chars): ${responseText.substring(0, 200)}`);
          }
        } else {
          console.warn(`OpenAI attempt ${attempt + 1} failed, retrying...`, error.message);
        }
        await new Promise(resolve => setTimeout(resolve, Math.min(1000 * (attempt + 1), 3000)));
      }
    }

    // Fallback (should never reach here)
    return {
      function_name: "none",
      arguments: {},
      error: String(lastError),
    };
  }

  async chat(
    messages: Array<{ role: string; content: string }>, 
    options?: { max_completion_tokens?: number; model?: string }
  ): Promise<string> {
    const maxRetries = 5;
    let lastError: any;
    let triedBackup = false;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Use the active client (primary or backup based on rate limit status)
        const { client: activeClient, isBackup } = this.getActiveClient();
        
        // Build request with GPT-5.2 reasoning parameter
        const chatModel = options?.model || this.model;
        const chatRequestParams: any = {
          model: chatModel,
          messages: messages as any, // Cast to satisfy OpenAI SDK types
          max_completion_tokens: options?.max_completion_tokens || 1000,
        };
        
        // Log model being used for chat
        console.log(`[OpenAI] Using model: ${chatModel} for chat`);
        
        // Note: reasoning.effort commented out until SDK compatibility verified
        // if (chatModel.startsWith('gpt-5.2')) {
        //   chatRequestParams.reasoning = { effort: "high" };
        // } else if (chatModel.startsWith('gpt-5.1')) {
        //   chatRequestParams.reasoning = { effort: "medium" };
        // }
        
        const response = await activeClient.chat.completions.create(chatRequestParams);

        const responseText = response.choices?.[0]?.message?.content || "";
        return responseText;
      } catch (error: any) {
        lastError = error;
        const { isBackup } = this.getActiveClient();
        
        // Check for auth errors (401) - try backup key immediately
        if (error.status === 401 && !triedBackup && this.backupClient) {
          triedBackup = true;
          this.usingBackup = true;
          console.log(`[OpenAI Chat] Primary API key auth failed (401), switching to backup API key...`);
          continue;
        }

        // Check for rate limit errors - try backup first, then exponential backoff
        if (error.status === 429) {
          const retryAfter = error.headers?.['retry-after'] 
            ? parseInt(error.headers['retry-after']) 
            : Math.min(2 ** attempt * 2, 30);
          
          // Track which key was rate limited
          this.handleRateLimit(isBackup, retryAfter);
          
          // Try switching to backup API key if available and haven't tried yet
          if (!triedBackup && this.backupClient) {
            triedBackup = true;
            // Check if backup is available
            const now = Date.now();
            if (this.backupRateLimitedUntil <= now) {
              this.usingBackup = true;
              console.log(`[OpenAI Chat] Primary rate limited, immediately trying backup API key...`);
              continue; // Retry immediately with backup key
            }
          }
          
          // Find the shortest wait time between both keys
          const now = Date.now();
          const primaryWait = Math.max(0, this.primaryRateLimitedUntil - now) / 1000;
          const backupWait = this.backupClient ? Math.max(0, this.backupRateLimitedUntil - now) / 1000 : Infinity;
          const minWait = Math.min(primaryWait, backupWait, retryAfter);
          
          console.warn(`[OpenAI Chat] Both keys rate limited (attempt ${attempt + 1}/${maxRetries}), waiting ${Math.ceil(minWait)}s...`);
          
          // Auto-retry after waiting
          if (attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, Math.max(minWait * 1000, 1000)));
            continue;
          }
        }
        
        // Check if it's a transient error worth retrying
        const isTransientError = 
          error.name === 'APIConnectionError' ||
          error.message?.includes('timeout') ||
          error.message?.includes('ECONNRESET') ||
          error.message?.includes('ETIMEDOUT') ||
          error.message?.includes('network');
        
        if (attempt === maxRetries - 1 || !isTransientError) {
          console.error(`[OpenAI Chat] Failed after ${attempt + 1} attempts:`, error.message);
          throw error;
        }
        
        console.warn(`[OpenAI Chat] Attempt ${attempt + 1} failed, retrying...`, error.message);
        await new Promise(resolve => setTimeout(resolve, Math.min(1000 * (attempt + 1), 3000)));
      }
    }

    throw lastError;
  }

  /**
   * Self-Correction: Re-classify a query with error feedback
   * When the initial classification fails (0 results, SQL error, etc.),
   * this method retries with explicit error feedback to help the LLM correct itself.
   */
  async reclassifyWithFeedback(
    userQuestion: string,
    functions: FunctionDefinition[],
    errorFeedback: {
      previousFunction: string;
      previousArgs: Record<string, any>;
      errorType: 'no_results' | 'sql_error' | 'classification_error';
      errorMessage: string;
      databaseHints?: {
        validStatuses?: string[];
        validCategories?: string[];
        validProjectTypes?: string[];
        validClients?: string[];
        validStates?: string[];
      };
    }
  ): Promise<Classification> {
    console.log(`[SelfCorrection] 🔄 Re-classifying with error feedback`);
    console.log(`[SelfCorrection] Previous: ${errorFeedback.previousFunction} with args: ${JSON.stringify(errorFeedback.previousArgs)}`);
    console.log(`[SelfCorrection] Error: ${errorFeedback.errorType} - ${errorFeedback.errorMessage}`);

    const selfCorrectionPrompt = `You are an expert function classifier correcting a previous mistake.

${COLUMN_REFERENCE_PROMPT}

PREVIOUS ATTEMPT FAILED:
- Function used: ${errorFeedback.previousFunction}
- Arguments: ${JSON.stringify(errorFeedback.previousArgs, null, 2)}
- Error type: ${errorFeedback.errorType}
- Error message: ${errorFeedback.errorMessage}

${errorFeedback.databaseHints ? `
VALID DATABASE VALUES (use these EXACT values):
${errorFeedback.databaseHints.validStatuses ? `- Status options: ${errorFeedback.databaseHints.validStatuses.join(', ')}` : ''}
${errorFeedback.databaseHints.validCategories ? `- Category options: ${errorFeedback.databaseHints.validCategories.join(', ')}` : ''}
${errorFeedback.databaseHints.validProjectTypes ? `- Project Type options: ${errorFeedback.databaseHints.validProjectTypes.join(', ')}` : ''}
${errorFeedback.databaseHints.validClients ? `- Sample clients: ${errorFeedback.databaseHints.validClients.slice(0, 10).join(', ')}` : ''}
${errorFeedback.databaseHints.validStates ? `- State options: ${errorFeedback.databaseHints.validStates.slice(0, 15).join(', ')}` : ''}
` : ''}

SELF-CORRECTION STRATEGIES:
1. If "no_results" - PRESERVE most filters, only relax ONE filter at a time (e.g., remove category filter but keep date and person)
2. PRIORITY: Keep person/POC filters AND date filters - only relax category/status filters first
3. If status/category doesn't match exactly - use the closest valid value from the list above
4. If SQL error - the function may not support those parameters, try a simpler function
5. DO NOT change date ranges if user explicitly asked for specific time period like "this year", "last year", "in 2025" - the dates are correct, other filters might be wrong
6. NEVER remove all filters except one - always preserve at least 2 filters if the original had 3+
7. If no results after relaxing category, return empty with suggestions rather than changing dates

User's original question: "${userQuestion}"

Select a CORRECTED function and parameters. Return ONLY valid JSON:
{"function_name": "...", "arguments": {...}}`;

    const maxRetries = 2;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const { client: activeClient } = this.getActiveClient();
        
        // Build a compact function list to fit in context (just names and descriptions)
        const functionSummary = functions.map(f => ({
          name: f.name,
          description: f.description?.substring(0, 100) || ''
        }));
        
        const response = await activeClient.chat.completions.create({
          model: this.model,
          messages: [
            { role: "system", content: selfCorrectionPrompt },
            {
              role: "user",
              content: `Available functions (${functions.length} total): ${JSON.stringify(functionSummary, null, 1)}\n\nProvide a corrected classification.`,
            },
          ],
          max_completion_tokens: 1500,
        });

        let responseText = response.choices?.[0]?.message?.content || "";

        // Clean up response
        if (responseText.includes("```json")) {
          const jsonStart = responseText.indexOf("```json") + 7;
          const jsonEnd = responseText.indexOf("```", jsonStart);
          responseText = responseText.substring(jsonStart, jsonEnd).trim();
        } else if (responseText.includes("```")) {
          const jsonStart = responseText.indexOf("```") + 3;
          const jsonEnd = responseText.indexOf("```", jsonStart);
          responseText = responseText.substring(jsonStart, jsonEnd).trim();
        }

        if (responseText.includes("{") && responseText.includes("}")) {
          const jsonStart = responseText.indexOf("{");
          const jsonEnd = responseText.lastIndexOf("}") + 1;
          responseText = responseText.substring(jsonStart, jsonEnd);
        }

        const result = JSON.parse(responseText);
        
        console.log(`[SelfCorrection] ✅ Corrected to: ${result.function_name} with args: ${JSON.stringify(result.arguments)}`);

        return {
          function_name: result.function_name || "none",
          arguments: result.arguments || {},
        };
      } catch (error: any) {
        console.error(`[SelfCorrection] Attempt ${attempt + 1} failed:`, error.message);
        if (attempt === maxRetries - 1) {
          return {
            function_name: "none",
            arguments: {},
            error: `Self-correction failed: ${error.message}`,
          };
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return {
      function_name: "none",
      arguments: {},
      error: "Self-correction exhausted retries",
    };
  }
}
