/**
 * Query Processing Utilities - Ported from Python
 * All calculations done in TypeScript (dates, numbers, ranges)
 * Azure OpenAI used for text understanding only
 */

import { PercentileData } from "@shared/schema";

// ═══════════════════════════════════════════════════════════════
// SEMANTIC TIME PARSER
// ═══════════════════════════════════════════════════════════════

export class SemanticTimeParser {
  private today: Date;

  constructor() {
    this.today = new Date();
  }

  parse(timeReference: string): [string, string] | null {
    if (!timeReference) return null;

    const timeRef = timeReference.toLowerCase().trim();

    // CATEGORY 0A: DIRECTIONAL DATE PHRASES (before/after/until/since)
    // Must check BEFORE other patterns to capture "before 2023" correctly
    const directionalResult = this.parseDirectionalDate(timeRef);
    if (directionalResult) return directionalResult;

    // CATEGORY 0B: SPECIFIC DATE FORMATS (check first before year extraction)
    const specificDate = this.parseSpecificDate(timeReference);
    if (specificDate) return specificDate;

    // CATEGORY 0C: CALENDAR YEAR REFERENCES - must check BEFORE relative "next/last" patterns
    // "next year" = next calendar year (e.g., 2026 if current is 2025)
    if (timeRef.includes("next year")) {
      const year = this.today.getFullYear() + 1;
      console.log(`[TimeParser] "next year" → calendar year ${year}`);
      return [`${year}-01-01`, `${year}-12-31`];
    }

    // "previous year" / "last year" = previous calendar year (e.g., 2024 if current is 2025)
    if (timeRef.includes("previous year") || timeRef.includes("last year") || timeRef.includes("prior year")) {
      const year = this.today.getFullYear() - 1;
      console.log(`[TimeParser] "previous/last year" → calendar year ${year}`);
      return [`${year}-01-01`, `${year}-12-31`];
    }

    // "current year" / "this year" = current calendar year (e.g., 2025)
    if (timeRef.includes("this year") || timeRef.includes("current year")) {
      const year = this.today.getFullYear();
      console.log(`[TimeParser] "this/current year" → calendar year ${year}`);
      return [`${year}-01-01`, `${year}-12-31`];
    }

    // "this quarter" = current calendar quarter
    if (timeRef.includes("this quarter") || timeRef.includes("current quarter")) {
      console.log(`[TimeParser] "this/current quarter" detected`);
      return this.getCurrentQuarterDates();
    }

    // "this month" / "current month" = current calendar month
    if (timeRef.includes("this month") || timeRef.includes("current month")) {
      const year = this.today.getFullYear();
      const month = this.today.getMonth() + 1;
      const lastDay = new Date(year, month, 0).getDate();
      console.log(`[TimeParser] "this/current month" → ${year}-${String(month).padStart(2, '0')}-01 to ${year}-${String(month).padStart(2, '0')}-${lastDay}`);
      return [`${year}-${String(month).padStart(2, '0')}-01`, `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`];
    }

    // "this week" / "current week" = current calendar week (Monday to Sunday)
    if (timeRef.includes("this week") || timeRef.includes("current week")) {
      const dayOfWeek = this.today.getDay();
      const monday = this.addDays(this.today, -(dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      const sunday = this.addDays(monday, 6);
      console.log(`[TimeParser] "this/current week" → ${this.formatDate(monday)} to ${this.formatDate(sunday)}`);
      return [this.formatDate(monday), this.formatDate(sunday)];
    }

    // "last month" / "previous month" = previous calendar month (exact boundaries)
    if (timeRef === "last month" || timeRef === "previous month" || timeRef === "prior month") {
      const firstOfThisMonth = new Date(this.today.getFullYear(), this.today.getMonth(), 1);
      const lastOfPrevMonth = this.addDays(firstOfThisMonth, -1);
      const firstOfPrevMonth = new Date(lastOfPrevMonth.getFullYear(), lastOfPrevMonth.getMonth(), 1);
      console.log(`[TimeParser] "last/previous month" → ${this.formatDate(firstOfPrevMonth)} to ${this.formatDate(lastOfPrevMonth)}`);
      return [this.formatDate(firstOfPrevMonth), this.formatDate(lastOfPrevMonth)];
    }

    // "last week" / "previous week" = previous calendar week (Monday to Sunday)
    if (timeRef === "last week" || timeRef === "previous week" || timeRef === "prior week") {
      const dayOfWeek = this.today.getDay();
      const thisMonday = this.addDays(this.today, -(dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      const lastMonday = this.addDays(thisMonday, -7);
      const lastSunday = this.addDays(lastMonday, 6);
      console.log(`[TimeParser] "last/previous week" → ${this.formatDate(lastMonday)} to ${this.formatDate(lastSunday)}`);
      return [this.formatDate(lastMonday), this.formatDate(lastSunday)];
    }

    // "last quarter" / "previous quarter" = previous calendar quarter (exact boundaries)
    if (timeRef === "last quarter" || timeRef === "previous quarter" || timeRef === "prior quarter") {
      return this.getPreviousQuarterDates();
    }

    // "next month" = next calendar month (exact boundaries)
    if (timeRef === "next month" || timeRef === "coming month") {
      const nextMonth = new Date(this.today.getFullYear(), this.today.getMonth() + 1, 1);
      const lastDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
      console.log(`[TimeParser] "next month" → ${this.formatDate(nextMonth)} to ${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);
      return [this.formatDate(nextMonth), `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`];
    }

    // "next quarter" = next calendar quarter (exact boundaries)
    if (timeRef === "next quarter" || timeRef === "coming quarter") {
      return this.getNextQuarterDates();
    }

    // "next week" = next calendar week (Monday to Sunday)
    if (timeRef === "next week" || timeRef === "coming week") {
      const dayOfWeek = this.today.getDay();
      const thisMonday = this.addDays(this.today, -(dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      const nextMonday = this.addDays(thisMonday, 7);
      const nextSunday = this.addDays(nextMonday, 6);
      console.log(`[TimeParser] "next week" → ${this.formatDate(nextMonday)} to ${this.formatDate(nextSunday)}`);
      return [this.formatDate(nextMonday), this.formatDate(nextSunday)];
    }

    // CATEGORY 1: RELATIVE TIME PERIODS (e.g., "next 3 months", "last 6 months")
    // These should NOT match "next year" since we already handled that above
    if (
      timeRef.includes("next") ||
      timeRef.includes("coming") ||
      timeRef.includes("upcoming") ||
      timeRef.includes("future")
    ) {
      return this.parseFutureReference(timeRef);
    }

    if (
      timeRef.includes("last") ||
      timeRef.includes("past") ||
      timeRef.includes("previous") ||
      timeRef.includes("recent")
    ) {
      return this.parsePastReference(timeRef);
    }

    // CATEGORY 2: VAGUE TIME REFERENCES
    const vagueMappings: Record<string, [number, number]> = {
      soon: [0, 90],
      "near future": [0, 180],
      "short term": [0, 180],
      "medium term": [180, 730],
      "long term": [730, 1825],
      immediately: [0, 30],
      recently: [-90, 0],
      shortly: [0, 60],
      "little while": [0, 90],
    };

    for (const [phrase, [startDays, endDays]] of Object.entries(vagueMappings)) {
      if (timeRef.includes(phrase)) {
        const startDate = this.addDays(this.today, startDays);
        const endDate = this.addDays(this.today, endDays);
        return [this.formatDate(startDate), this.formatDate(endDate)];
      }
    }

    const quarterResult = this.parseSpecificQuarter(timeRef);
    if (quarterResult) return quarterResult;

    const yearResult = this.parseSpecificYear(timeRef);
    if (yearResult) return yearResult;

    const monthRange = this.parseMonthRange(timeRef);
    if (monthRange) return monthRange;

    const specificMonth = this.parseSpecificMonth(timeRef);
    if (specificMonth) return specificMonth;

    // CATEGORY 4: NUMERIC + UNIT PATTERNS
    const numericResult = this.extractNumericTimeframe(timeRef);
    if (numericResult) return numericResult;

    return null;
  }

  private parseFutureReference(text: string): [string, string] | null {
    const result = this.extractNumericTimeframe(text);
    if (result) return result;

    // Handle specific time unit keywords (order matters - check smaller units first)
    const futureDefaults: Record<string, number> = {
      'week': 7,        // "next week" = 7 days
      'month': 30,      // "next month" = 30 days
      'months': 180,    // "next few months" = 180 days
      'quarter': 90,    // "next quarter" = 90 days
      'year': 365,      // "next year" = 365 days
    };

    for (const [unit, days] of Object.entries(futureDefaults)) {
      if (text.includes(unit)) {
        const startDate = this.formatDate(this.today);
        const endDate = this.formatDate(this.addDays(this.today, days));
        return [startDate, endDate];
      }
    }

    // Default fallback for unrecognized future references: 30 days (1 month, not 6 months)
    const startDate = this.formatDate(this.today);
    const endDate = this.formatDate(this.addDays(this.today, 30));
    return [startDate, endDate];
  }

  private parsePastReference(text: string): [string, string] | null {
    const result = this.extractNumericTimeframe(text);
    if (result) return result;

    // Handle specific time unit keywords (order matters - check smaller units first)
    const pastDefaults: Record<string, number> = {
      'week': 7,        // "last week" = 7 days
      'month': 30,      // "last month" = 30 days
      'months': 180,    // "past few months" = 180 days
      'quarter': 90,    // "last quarter" = 90 days
      'year': 365,      // "last year" = 365 days
    };

    for (const [unit, days] of Object.entries(pastDefaults)) {
      if (text.includes(unit)) {
        const startDate = this.formatDate(this.addDays(this.today, -days));
        const endDate = this.formatDate(this.today);
        return [startDate, endDate];
      }
    }

    // Default fallback for unrecognized past references: 30 days (1 month, not 6 months)
    const startDate = this.formatDate(this.addDays(this.today, -30));
    const endDate = this.formatDate(this.today);
    return [startDate, endDate];
  }

  /**
   * Parse directional date phrases like "before 2023", "after 2020", "until 2025", "since 2021"
   * Returns open-ended date ranges:
   * - "before 2023" → ["", "2022-12-31"] (everything up to end of 2022)
   * - "after 2023" → ["2024-01-01", ""] (everything from start of 2024)
   * - "until 2023" → ["", "2023-12-31"] (everything up to end of 2023)
   * - "since 2023" → ["2023-01-01", ""] (everything from start of 2023)
   * Empty string "" indicates an open-ended boundary
   */
  private parseDirectionalDate(text: string): [string, string] | null {
    // Pattern: "before/prior to/until YEAR" - everything UP TO (but not including) that year
    const beforePatterns = [
      /\b(?:before|prior\s+to)\s+(20\d{2})\b/i,
    ];
    
    for (const pattern of beforePatterns) {
      const match = text.match(pattern);
      if (match) {
        const year = parseInt(match[1]);
        // "before 2023" means end of 2022
        return ["", `${year - 1}-12-31`];
      }
    }
    
    // Pattern: "until/through YEAR" - everything UP TO AND INCLUDING that year
    const untilPatterns = [
      /\b(?:until|through|up\s+to)\s+(20\d{2})\b/i,
    ];
    
    for (const pattern of untilPatterns) {
      const match = text.match(pattern);
      if (match) {
        const year = parseInt(match[1]);
        // "until 2023" means end of 2023
        return ["", `${year}-12-31`];
      }
    }
    
    // Pattern: "after YEAR" - everything AFTER (not including) that year
    const afterPatterns = [
      /\b(?:after)\s+(20\d{2})\b/i,
    ];
    
    for (const pattern of afterPatterns) {
      const match = text.match(pattern);
      if (match) {
        const year = parseInt(match[1]);
        // "after 2023" means start of 2024
        return [`${year + 1}-01-01`, ""];
      }
    }
    
    // Pattern: "since/from YEAR" - everything FROM that year onwards
    const sincePatterns = [
      /\b(?:since|from)\s+(20\d{2})\b/i,
    ];
    
    for (const pattern of sincePatterns) {
      const match = text.match(pattern);
      if (match) {
        const year = parseInt(match[1]);
        // "since 2023" means start of 2023
        return [`${year}-01-01`, ""];
      }
    }
    
    return null;
  }

  private extractNumericTimeframe(text: string): [string, string] | null {
    const convertedText = this.convertWrittenNumbers(text);
    const pattern = /(\d+)\s*(month|months|day|days|year|years|week|weeks|quarter|quarters)/;
    const match = convertedText.match(pattern);

    if (match) {
      const quantity = parseInt(match[1]);
      const unit = match[2].replace(/s$/, "");
      const days = this.unitToDays(quantity, unit);

      const isFuture =
        text.includes("next") ||
        text.includes("coming") ||
        text.includes("upcoming") ||
        text.includes("future");
      const isPast =
        text.includes("last") ||
        text.includes("past") ||
        text.includes("previous") ||
        text.includes("recent");

      if (isFuture) {
        const startDate = this.formatDate(this.today);
        const endDate = this.formatDate(this.addDays(this.today, days));
        return [startDate, endDate];
      } else if (isPast) {
        const startDate = this.formatDate(this.addDays(this.today, -days));
        const endDate = this.formatDate(this.today);
        return [startDate, endDate];
      } else {
        const startDate = this.formatDate(this.today);
        const endDate = this.formatDate(this.addDays(this.today, days));
        return [startDate, endDate];
      }
    }

    return null;
  }

  private convertWrittenNumbers(text: string): string {
    const wordToNumber: Record<string, string> = {
      one: "1",
      two: "2",
      three: "3",
      four: "4",
      five: "5",
      six: "6",
      seven: "7",
      eight: "8",
      nine: "9",
      ten: "10",
      eleven: "11",
      twelve: "12",
      thirteen: "13",
      fourteen: "14",
      fifteen: "15",
      sixteen: "16",
      seventeen: "17",
      eighteen: "18",
      nineteen: "19",
      twenty: "20",
      thirty: "30",
      forty: "40",
      fifty: "50",
      sixty: "60",
      seventy: "70",
      eighty: "80",
      ninety: "90",
    };

    let result = text;
    for (const [word, number] of Object.entries(wordToNumber)) {
      const regex = new RegExp(`\\b${word}\\b`, "gi");
      result = result.replace(regex, number);
    }
    return result;
  }

  private unitToDays(quantity: number, unit: string): number {
    const unitLower = unit.toLowerCase();
    if (unitLower === "day") return quantity;
    if (unitLower === "week") return quantity * 7;
    if (unitLower === "month") return quantity * 30;
    if (unitLower === "quarter") return quantity * 90;
    if (unitLower === "year") return quantity * 365;
    return 0;
  }

  private getCurrentQuarterDates(): [string, string] {
    const month = this.today.getMonth() + 1;
    const year = this.today.getFullYear();

    if (month <= 3) return [`${year}-01-01`, `${year}-03-31`];
    if (month <= 6) return [`${year}-04-01`, `${year}-06-30`];
    if (month <= 9) return [`${year}-07-01`, `${year}-09-30`];
    return [`${year}-10-01`, `${year}-12-31`];
  }

  private getPreviousQuarterDates(): [string, string] {
    const month = this.today.getMonth() + 1;
    const year = this.today.getFullYear();
    if (month <= 3) {
      console.log(`[TimeParser] "last quarter" → Q4 ${year - 1}`);
      return [`${year - 1}-10-01`, `${year - 1}-12-31`];
    }
    if (month <= 6) {
      console.log(`[TimeParser] "last quarter" → Q1 ${year}`);
      return [`${year}-01-01`, `${year}-03-31`];
    }
    if (month <= 9) {
      console.log(`[TimeParser] "last quarter" → Q2 ${year}`);
      return [`${year}-04-01`, `${year}-06-30`];
    }
    console.log(`[TimeParser] "last quarter" → Q3 ${year}`);
    return [`${year}-07-01`, `${year}-09-30`];
  }

  private getNextQuarterDates(): [string, string] {
    const month = this.today.getMonth() + 1;
    const year = this.today.getFullYear();
    if (month <= 3) {
      console.log(`[TimeParser] "next quarter" → Q2 ${year}`);
      return [`${year}-04-01`, `${year}-06-30`];
    }
    if (month <= 6) {
      console.log(`[TimeParser] "next quarter" → Q3 ${year}`);
      return [`${year}-07-01`, `${year}-09-30`];
    }
    if (month <= 9) {
      console.log(`[TimeParser] "next quarter" → Q4 ${year}`);
      return [`${year}-10-01`, `${year}-12-31`];
    }
    console.log(`[TimeParser] "next quarter" → Q1 ${year + 1}`);
    return [`${year + 1}-01-01`, `${year + 1}-03-31`];
  }

  private parseSpecificQuarter(text: string): [string, string] | null {
    let match = text.match(/q(\d)\s+(\d{4})/);
    if (match) {
      const quarter = parseInt(match[1]);
      const year = parseInt(match[2]);
      if (quarter >= 1 && quarter <= 4) {
        console.log(`[TimeParser] Specific quarter "Q${quarter} ${year}"`);
        return this.getQuarterDates(year, quarter);
      }
    }

    match = text.match(/(\d{4})\s+q(\d)/);
    if (match) {
      const year = parseInt(match[1]);
      const quarter = parseInt(match[2]);
      if (quarter >= 1 && quarter <= 4) {
        console.log(`[TimeParser] Specific quarter "${year} Q${quarter}"`);
        return this.getQuarterDates(year, quarter);
      }
    }

    match = text.match(/\bq(\d)\b/);
    if (match && !text.match(/\d{4}/)) {
      const quarter = parseInt(match[1]);
      if (quarter >= 1 && quarter <= 4) {
        const year = this.today.getFullYear();
        console.log(`[TimeParser] Quarter "Q${quarter}" (no year) → assumed ${year}`);
        return this.getQuarterDates(year, quarter);
      }
    }

    const quarterNames: Record<string, number> = {
      first: 1,
      second: 2,
      third: 3,
      fourth: 4,
    };

    for (const [name, num] of Object.entries(quarterNames)) {
      const withYear = new RegExp(`${name}\\s+quarter\\s+(\\d{4})`);
      match = text.match(withYear);
      if (match) {
        const year = parseInt(match[1]);
        console.log(`[TimeParser] "${name} quarter ${year}"`);
        return this.getQuarterDates(year, num);
      }
    }

    for (const [name, num] of Object.entries(quarterNames)) {
      const withoutYear = new RegExp(`${name}\\s+quarter\\b`);
      if (text.match(withoutYear) && !text.match(/\d{4}/)) {
        const year = this.today.getFullYear();
        console.log(`[TimeParser] "${name} quarter" (no year) → assumed ${year}`);
        return this.getQuarterDates(year, num);
      }
    }

    return null;
  }

  private getQuarterDates(year: number, quarter: number): [string, string] {
    const quarters: Record<number, [string, string]> = {
      1: [`${year}-01-01`, `${year}-03-31`],
      2: [`${year}-04-01`, `${year}-06-30`],
      3: [`${year}-07-01`, `${year}-09-30`],
      4: [`${year}-10-01`, `${year}-12-31`],
    };
    return quarters[quarter] || [`${year}-01-01`, `${year}-12-31`];
  }

  private parseSpecificYear(text: string): [string, string] | null {
    // First try to match year ranges: "from 2026 and 2027", "2026-2027", "2026 to 2027", "between 2020 and 2025", etc.
    const rangePatterns = [
      /between\s+(20\d{2})\s+(?:and|to|through|thru)\s+(20\d{2})\b/i,  // "between 2020 and 2025"
      /\b(20\d{2})\s+(?:and|to|through|thru|-|–)\s+(20\d{2})\b/,  // "2026 and 2027", "2026 to 2027", "2026-2027"
      /from\s+(20\d{2})\s+(?:and|to|through|thru)\s+(20\d{2})\b/,  // "from 2026 and 2027"
    ];
    
    for (const pattern of rangePatterns) {
      const match = text.match(pattern);
      if (match) {
        const startYear = parseInt(match[1]);
        const endYear = parseInt(match[2]);
        // Return start of first year to end of last year
        return [`${startYear}-01-01`, `${endYear}-12-31`];
      }
    }
    
    // Single year match: "2026", "in 2025", etc.
    const singleMatch = text.match(/\b(20\d{2})\b/);
    if (singleMatch) {
      const year = parseInt(singleMatch[1]);
      return [`${year}-01-01`, `${year}-12-31`];
    }
    
    return null;
  }

  private parseMonthRange(text: string): [string, string] | null {
    const monthMap: Record<string, number> = {
      january: 1,
      jan: 1,
      february: 2,
      feb: 2,
      march: 3,
      mar: 3,
      april: 4,
      apr: 4,
      may: 5,
      june: 6,
      jun: 6,
      july: 7,
      jul: 7,
      august: 8,
      aug: 8,
      september: 9,
      sep: 9,
      october: 10,
      oct: 10,
      november: 11,
      nov: 11,
      december: 12,
      dec: 12,
    };

    const pattern = /between\s+(\w+)\s+and\s+(\w+)\s+(\d{4})/;
    const match = text.match(pattern);

    if (match) {
      const startMonth = monthMap[match[1].toLowerCase()];
      const endMonth = monthMap[match[2].toLowerCase()];
      const year = parseInt(match[3]);

      if (startMonth && endMonth) {
        const startDate = `${year}-${String(startMonth).padStart(2, "0")}-01`;

        let endDate: string;
        if (endMonth === 12) {
          endDate = `${year}-12-31`;
        } else {
          const nextMonth = new Date(year, endMonth, 0);
          const lastDay = nextMonth.getDate();
          endDate = `${year}-${String(endMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
        }

        return [startDate, endDate];
      }
    }

    return null;
  }

  private parseSpecificMonth(text: string): [string, string] | null {
    const monthMap: Record<string, number> = {
      january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3,
      april: 4, apr: 4, may: 5, june: 6, jun: 6, july: 7, jul: 7,
      august: 8, aug: 8, september: 9, sep: 9, october: 10, oct: 10,
      november: 11, nov: 11, december: 12, dec: 12,
    };

    for (const [name, monthNum] of Object.entries(monthMap)) {
      const withYear = new RegExp(`\\b${name}\\s+(\\d{4})\\b`, 'i');
      const matchWithYear = text.match(withYear);
      if (matchWithYear) {
        const year = parseInt(matchWithYear[1]);
        const lastDay = new Date(year, monthNum, 0).getDate();
        console.log(`[TimeParser] Specific month "${name} ${year}" → ${year}-${String(monthNum).padStart(2, '0')}-01 to ${year}-${String(monthNum).padStart(2, '0')}-${lastDay}`);
        return [`${year}-${String(monthNum).padStart(2, '0')}-01`, `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`];
      }
    }

    for (const [name, monthNum] of Object.entries(monthMap)) {
      if (name.length < 4) continue;
      const standalone = new RegExp(`\\b(?:in\\s+)?${name}\\b`, 'i');
      if (text.match(standalone)) {
        const year = this.today.getFullYear();
        const lastDay = new Date(year, monthNum, 0).getDate();
        console.log(`[TimeParser] Specific month "${name}" (no year) → assumed ${year}-${String(monthNum).padStart(2, '0')}-01 to ${year}-${String(monthNum).padStart(2, '0')}-${lastDay}`);
        return [`${year}-${String(monthNum).padStart(2, '0')}-01`, `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`];
      }
    }

    return null;
  }

  /**
   * Parse specific date formats like MM-DD-YYYY, MM/DD/YYYY, YYYY-MM-DD
   * Handles "from DATE" (open-ended) vs "on DATE" (single day)
   */
  private parseSpecificDate(text: string): [string, string] | null {
    const lowerText = text.toLowerCase();
    
    // Check if it's an open-ended "from" query (from DATE onwards)
    const isFromQuery = lowerText.includes('from ') || lowerText.includes('starting from') || lowerText.includes('after ') || lowerText.includes('since ');
    // Check if it's a "to/until/before" query (up to DATE)
    const isToQuery = lowerText.includes(' to ') || lowerText.includes('until ') || lowerText.includes('before ') || lowerText.includes('ending ');
    // Check if it's explicitly "on" a specific date
    const isOnQuery = lowerText.includes(' on ');
    
    // MM-DD-YYYY or MM/DD/YYYY format (US format)
    const usDatePattern = /\b(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})\b/;
    const usMatch = text.match(usDatePattern);
    if (usMatch) {
      const month = parseInt(usMatch[1]);
      const day = parseInt(usMatch[2]);
      const year = parseInt(usMatch[3]);
      
      // Validate date components
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2000 && year <= 2100) {
        const isoDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        
        if (isFromQuery && !isToQuery) {
          // "from DATE" = DATE to far future
          console.log(`[TimeParser] Parsed "from" date: "${text}" → ${isoDate} to 2099-12-31`);
          return [isoDate, "2099-12-31"];
        } else if (isToQuery && !isFromQuery) {
          // "until DATE" = beginning to DATE
          console.log(`[TimeParser] Parsed "to" date: "${text}" → 2000-01-01 to ${isoDate}`);
          return ["2000-01-01", isoDate];
        } else {
          // "on DATE" or just DATE = single day
          console.log(`[TimeParser] Parsed specific date: "${text}" → ${isoDate}`);
          return [isoDate, isoDate];
        }
      }
    }

    // YYYY-MM-DD format (ISO format)
    const isoDatePattern = /\b(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})\b/;
    const isoMatch = text.match(isoDatePattern);
    if (isoMatch) {
      const year = parseInt(isoMatch[1]);
      const month = parseInt(isoMatch[2]);
      const day = parseInt(isoMatch[3]);
      
      // Validate date components
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2000 && year <= 2100) {
        const isoDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        
        if (isFromQuery && !isToQuery) {
          console.log(`[TimeParser] Parsed "from" date (ISO): "${text}" → ${isoDate} to 2099-12-31`);
          return [isoDate, "2099-12-31"];
        } else if (isToQuery && !isFromQuery) {
          console.log(`[TimeParser] Parsed "to" date (ISO): "${text}" → 2000-01-01 to ${isoDate}`);
          return ["2000-01-01", isoDate];
        } else {
          console.log(`[TimeParser] Parsed specific date (ISO): "${text}" → ${isoDate}`);
          return [isoDate, isoDate];
        }
      }
    }

    return null;
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}

// ═══════════════════════════════════════════════════════════════
// NUMBER CALCULATOR
// ═══════════════════════════════════════════════════════════════

export class NumberCalculator {
  static parseNumber(text: string): number | null {
    const patterns = [
      /(\d+)\s*million/i,
      /(\d+)m\b/i,
      /(\d+)\s*thousand/i,
      /(\d+)k\b/i,
      /(\d+)/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const num = parseFloat(match[1]);
        if (pattern.source.includes("million") || pattern.source.includes("m\\b")) {
          return num * 1_000_000;
        }
        if (pattern.source.includes("thousand") || pattern.source.includes("k\\b")) {
          return num * 1_000;
        }
        return num;
      }
    }

    return null;
  }

  static parseRange(text: string): [number, number] | null {
    const pattern = /between\s+(\d+)\s+and\s+(\d+)/i;
    const match = text.match(pattern);

    if (match) {
      return [parseFloat(match[1]), parseFloat(match[2])];
    }

    return null;
  }

  static parseLimit(text: string): number | null {
    const patterns = [
      /top\s+(\d+)/i,
      /first\s+(\d+)/i,
      /(\d+)\s+largest/i,
      /(\d+)\s+biggest/i,
      /limit\s+(\d+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return parseInt(match[1]);
      }
    }

    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// PROJECT SIZE CALCULATOR
// ═══════════════════════════════════════════════════════════════

export class ProjectSizeCalculator {
  private percentiles: PercentileData | null = null;
  private lastCalculated: Date | null = null;
  private cacheDuration = 24 * 60 * 60 * 1000; // 24 hours

  async calculatePercentiles(
    dbQuery: (sql: string) => Promise<any[]>,
    forceRefresh = false,
    tableName: string = "POR"
  ): Promise<PercentileData | null> {
    if (
      !forceRefresh &&
      this.percentiles &&
      this.lastCalculated &&
      Date.now() - this.lastCalculated.getTime() < this.cacheDuration
    ) {
      console.log("[ProjectSizeCalculator] Using cached percentiles:", this.percentiles);
      return this.percentiles;
    }

    try {
      // MS SQL syntax for PERCENTILE_CONT requires OVER() clause
      // Use subquery to get distinct percentile values
      const sql = `
        SELECT TOP 1
          PERCENTILE_CONT(0.20) WITHIN GROUP (ORDER BY numeric_fee) OVER () as p20,
          PERCENTILE_CONT(0.40) WITHIN GROUP (ORDER BY numeric_fee) OVER () as p40,
          PERCENTILE_CONT(0.60) WITHIN GROUP (ORDER BY numeric_fee) OVER () as p60,
          PERCENTILE_CONT(0.80) WITHIN GROUP (ORDER BY numeric_fee) OVER () as p80,
          MIN(numeric_fee) OVER () as min_fee,
          MAX(numeric_fee) OVER () as max_fee,
          COUNT(*) OVER () as total_projects
        FROM (
          SELECT CAST(NULLIF("Fee", '') AS NUMERIC) as numeric_fee
          FROM "${tableName}"
          WHERE "Fee" IS NOT NULL 
          AND "Fee" != ''
          AND TRY_CAST("Fee" AS NUMERIC) > 10000
        ) fee_data
      `;
      
      console.log("[ProjectSizeCalculator] Calculating percentiles from table:", tableName);

      const result = await dbQuery(sql);

      if (result && result[0]) {
        const row = result[0];
        
        // Parse and validate all percentile values
        const p20 = parseFloat(row.p20);
        const p40 = parseFloat(row.p40);
        const p60 = parseFloat(row.p60);
        const p80 = parseFloat(row.p80);
        const min = parseFloat(row.min_fee);
        const max = parseFloat(row.max_fee);
        const total = parseInt(row.total_projects);
        
        // Validate that all values are valid numbers (not NaN)
        if (isNaN(p20) || isNaN(p40) || isNaN(p60) || isNaN(p80) || 
            isNaN(min) || isNaN(max) || isNaN(total)) {
          console.error("[ProjectSizeCalculator] Invalid percentile values (NaN detected):", {
            p20, p40, p60, p80, min, max, total
          });
          return null;
        }
        
        this.percentiles = {
          p20,
          p40,
          p60,
          p80,
          min,
          max,
          total_projects: total,
          calculated_at: new Date().toISOString(),
        };

        this.lastCalculated = new Date();
        console.log("[ProjectSizeCalculator] Successfully calculated percentiles:", this.percentiles);
        return this.percentiles;
      }

      return null;
    } catch (error) {
      console.error("Error calculating percentiles:", error);
      return null;
    }
  }

  getSqlCaseStatement(): string {
    // Use fallback if percentiles are not calculated or contain invalid values
    if (!this.percentiles || 
        isNaN(this.percentiles.p20) || 
        isNaN(this.percentiles.p40) || 
        isNaN(this.percentiles.p60) || 
        isNaN(this.percentiles.p80)) {
      console.warn("[ProjectSizeCalculator] Using fallback thresholds (percentiles not available or invalid)");
      // Fallback if calculation fails - return just category names without ranges
      return `CASE 
        WHEN CAST(NULLIF("Fee", '') AS NUMERIC) < 100000 THEN 'Micro'
        WHEN CAST(NULLIF("Fee", '') AS NUMERIC) < 1000000 THEN 'Small'
        WHEN CAST(NULLIF("Fee", '') AS NUMERIC) < 10000000 THEN 'Medium'
        WHEN CAST(NULLIF("Fee", '') AS NUMERIC) < 50000000 THEN 'Large'
        ELSE 'Mega'
      END`;
    }

    const p = this.percentiles;

    console.log(`[ProjectSizeCalculator] Using DYNAMIC thresholds from actual fee data:
      - Micro: Fee < $${(p.p20/1000000).toFixed(2)}M (bottom 20%)
      - Small: $${(p.p20/1000000).toFixed(2)}M - $${(p.p40/1000000).toFixed(2)}M (20-40%)
      - Medium: $${(p.p40/1000000).toFixed(2)}M - $${(p.p60/1000000).toFixed(2)}M (40-60%)
      - Large: $${(p.p60/1000000).toFixed(2)}M - $${(p.p80/1000000).toFixed(2)}M (60-80%)
      - Mega: Fee >= $${(p.p80/1000000).toFixed(2)}M (top 20%)`);

    // Return category names only (no fee ranges) for WHERE clause matching
    return `CASE 
      WHEN CAST(NULLIF("Fee", '') AS NUMERIC) < ${p.p20} 
        THEN 'Micro'
      WHEN CAST(NULLIF("Fee", '') AS NUMERIC) >= ${p.p20} AND CAST(NULLIF("Fee", '') AS NUMERIC) < ${p.p40} 
        THEN 'Small'
      WHEN CAST(NULLIF("Fee", '') AS NUMERIC) >= ${p.p40} AND CAST(NULLIF("Fee", '') AS NUMERIC) < ${p.p60} 
        THEN 'Medium'
      WHEN CAST(NULLIF("Fee", '') AS NUMERIC) >= ${p.p60} AND CAST(NULLIF("Fee", '') AS NUMERIC) < ${p.p80} 
        THEN 'Large'
      ELSE 'Mega'
    END`;
  }

  getSizeCategory(fee: number): string {
    if (!this.percentiles || fee <= 0) return "unknown";

    const p = this.percentiles;

    if (fee < p.p20) return "Micro";
    if (fee < p.p40) return "Small";
    if (fee < p.p60) return "Medium";
    if (fee < p.p80) return "Large";
    return "Mega";
  }
}
