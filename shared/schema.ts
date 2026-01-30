import { z } from "zod";
import { sql } from "drizzle-orm";
import { pgTable, varchar, text, timestamp, jsonb, index, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// Default FAQ Categories (users can create custom ones too)
export const DEFAULT_FAQ_CATEGORIES = ["Time-Based", "Rankings", "Categories", "Analysis"] as const;
export type DefaultFAQCategory = typeof DEFAULT_FAQ_CATEGORIES[number];

// FAQ Category can be any string (allowing custom categories)
export type FAQCategory = string;

// Keep legacy alias for backward compatibility
export const FAQ_CATEGORIES = DEFAULT_FAQ_CATEGORIES;

// ═══════════════════════════════════════════════════════════════
// AUTH TABLES (Simple Email/Password Authentication)
// ═══════════════════════════════════════════════════════════════

// Session storage table for express-session
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User roles for access control
export const USER_ROLES = ["superadmin", "admin", "user"] as const;
export type UserRole = typeof USER_ROLES[number];

// User storage table for authenticated users
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  passwordHash: varchar("password_hash").notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").default("user"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Schema for user registration
export const registerUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

// Schema for user login
export const loginUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// ═══════════════════════════════════════════════════════════════
// DATABASE TABLES (Drizzle ORM)
// ═══════════════════════════════════════════════════════════════

export const chats = pgTable("chats", {
  id: varchar("id").primaryKey(),
  session_id: varchar("session_id").notNull(),
  title: text("title").notNull(),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
  faq_category: varchar("faq_category"),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey(),
  chat_id: varchar("chat_id").notNull(),
  type: varchar("type").notNull(),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  response: jsonb("response"),
  ai_analysis_messages: jsonb("ai_analysis_messages"),
  is_faq: boolean("is_faq").default(false),
  faq_category: varchar("faq_category"),
  faq_display_text: text("faq_display_text"),
  user_id: varchar("user_id"), // User who created this FAQ (for per-user visibility)
});

export const insertChatSchema = createInsertSchema(chats).omit({ 
  created_at: true, 
  updated_at: true 
});

export const insertMessageSchema = createInsertSchema(messages).omit({ 
  timestamp: true 
});

// ═══════════════════════════════════════════════════════════════
// ERROR LOGS TABLE
// ═══════════════════════════════════════════════════════════════

// Error log status types
export const ERROR_LOG_STATUSES = ["pending", "in_progress", "resolved", "completed", "results_sent"] as const;
export type ErrorLogStatus = typeof ERROR_LOG_STATUSES[number];

export const errorLogs = pgTable("error_logs", {
  id: varchar("id").primaryKey(),
  session_id: varchar("session_id").notNull(),
  user_id: varchar("user_id"),
  user_email: varchar("user_email"),
  chat_id: varchar("chat_id").notNull(),
  message_id: varchar("message_id"),
  question: text("question").notNull(),
  error_message: text("error_message"),
  user_comment: text("user_comment").notNull(),
  developer_comment: text("developer_comment"),
  status: varchar("status").default("pending"),
  screenshot_filename: varchar("screenshot_filename"),
  screenshot_url: varchar("screenshot_url"),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const insertErrorLogSchema = createInsertSchema(errorLogs).omit({
  created_at: true
});

export const updateErrorLogSchema = z.object({
  developer_comment: z.string().nullable().optional(),
  status: z.enum(ERROR_LOG_STATUSES).optional(),
});

export type ErrorLog = typeof errorLogs.$inferSelect;
export type InsertErrorLog = z.infer<typeof insertErrorLogSchema>;
export type UpdateErrorLog = z.infer<typeof updateErrorLogSchema>;

// ═══════════════════════════════════════════════════════════════
// USER ACTIVITY LOGS TABLE (Time Tracking)
// ═══════════════════════════════════════════════════════════════

export const ACTIVITY_EVENT_TYPES = ["login", "query", "follow_up", "logout"] as const;
export type ActivityEventType = typeof ACTIVITY_EVENT_TYPES[number];

export const userActivityLogs = pgTable("user_activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  user_id: varchar("user_id"),
  user_email: varchar("user_email").notNull(),
  event_type: varchar("event_type").notNull(),
  metadata: jsonb("metadata"),
  created_at: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_activity_user_email").on(table.user_email),
  index("idx_activity_created_at").on(table.created_at),
]);

export const insertUserActivityLogSchema = createInsertSchema(userActivityLogs).omit({
  id: true,
  created_at: true,
});

export type UserActivityLog = typeof userActivityLogs.$inferSelect;
export type InsertUserActivityLog = z.infer<typeof insertUserActivityLogSchema>;

// Admin email that can view activity logs
export const ADMIN_EMAIL = "drsampathkumarpatil@gmail.com";

// Schema for updating message FAQ fields
export const updateMessageFAQSchema = z.object({
  is_faq: z.boolean(),
  faq_category: z.string().min(1).max(50).nullable().optional(), // Allow custom categories
  faq_display_text: z.string().nullable().optional(),
});

export type UpdateMessageFAQ = z.infer<typeof updateMessageFAQSchema>;

// FAQ sample question for home page display
export interface FAQSampleQuestion {
  id: string;
  chatId: string;
  question: string;
  category: string; // Can be default or custom category
  displayText?: string;
  userId?: string; // User who created this FAQ (for per-user visibility)
}

export type Chat = typeof chats.$inferSelect;
export type InsertChat = z.infer<typeof insertChatSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

// ═══════════════════════════════════════════════════════════════
// QUERY TYPES
// ═══════════════════════════════════════════════════════════════

export const QueryRequestSchema = z.object({
  question: z.string().min(1, "Question is required"),
  previousContext: z.object({
    question: z.string(),
    function_name: z.string(),
    arguments: z.record(z.string(), z.any()),
    result_data: z.array(z.record(z.string(), z.any())).optional(),
  }).optional(),
  originalContext: z.object({
    question: z.string(),
    function_name: z.string(),
    arguments: z.record(z.string(), z.any()),
    result_data: z.array(z.record(z.string(), z.any())).optional(),
  }).optional(),
});

export type QueryRequest = z.infer<typeof QueryRequestSchema>;

// ═══════════════════════════════════════════════════════════════
// CHART CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const ChartPointSchema = z.object({
  x: z.number(),
  y: z.number(),
  r: z.number().optional(),
});

export const ChartDatasetSchema = z.object({
  label: z.string().optional(),
  data: z.union([
    z.array(z.number()),
    z.array(ChartPointSchema),
  ]),
  backgroundColor: z.union([z.string(), z.array(z.string())]).optional(),
  borderColor: z.union([z.string(), z.array(z.string())]).optional(),
  borderWidth: z.number().optional(),
});

export const ChartConfigSchema = z.object({
  type: z.enum(["bar", "line", "pie", "doughnut", "scatter", "area", "radar", "bubble"]),
  title: z.string(),
  labels: z.array(z.string()),
  datasets: z.array(ChartDatasetSchema),
  tooltipFormat: z.enum(["currency", "percentage", "number", "custom"]).optional(),
  showLegend: z.boolean().optional(),
  legendPosition: z.enum(["top", "bottom", "left", "right"]).optional(),
  colorScheme: z.enum(["default", "vibrant", "pastel", "monochrome"]).optional(),
});

export type ChartDataset = z.infer<typeof ChartDatasetSchema>;
export type ChartConfig = z.infer<typeof ChartConfigSchema>;

// ═══════════════════════════════════════════════════════════════
// QUERY RESPONSE
// ═══════════════════════════════════════════════════════════════

export const SummaryStatsSchema = z.object({
  total_records: z.number().optional(),
  total_value: z.number().optional(),
  avg_fee: z.number().optional(),
  median_fee: z.number().optional(),
  min_fee: z.number().optional(),
  max_fee: z.number().optional(),
  avg_win_rate: z.number().optional(),
  status_breakdown: z.record(z.string(), z.number()).optional(),
  top_companies: z.record(z.string(), z.number()).optional(),
});

export type SummaryStats = z.infer<typeof SummaryStatsSchema>;

export const QueryResponseSchema = z.object({
  success: z.boolean(),
  question: z.string().optional(),
  function_name: z.string().optional(),
  arguments: z.record(z.string(), z.any()).optional(),
  data: z.array(z.record(z.string(), z.any())),
  row_count: z.number().optional(),
  summary: SummaryStatsSchema.optional(),
  chart_config: ChartConfigSchema.nullable().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
  traceback: z.string().optional(),
  sql_query: z.string().optional(),
  sql_params: z.array(z.any()).optional(),
  ai_insights: z.string().optional(),
  // Storage optimization fields - for truncated data in chat history
  data_truncated: z.boolean().optional(),
  stored_row_count: z.number().optional(),
  total_row_count: z.number().optional(),
});

export type QueryResponse = z.infer<typeof QueryResponseSchema>;

// ═══════════════════════════════════════════════════════════════
// CHAT HISTORY (Full conversations with messages)
// ═══════════════════════════════════════════════════════════════

export const ChatHistorySchema = z.object({
  id: z.string(),
  title: z.string(),
  created_at: z.date(),
  updated_at: z.date(),
});

export const ChatMessageSchema = z.object({
  id: z.string(),
  chat_id: z.string(),
  type: z.enum(["user", "bot"]),
  content: z.string(),
  timestamp: z.date(),
  response: QueryResponseSchema.optional(),
});

export type ChatHistory = z.infer<typeof ChatHistorySchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

// ═══════════════════════════════════════════════════════════════
// AI ANALYSIS FOLLOW-UP MESSAGES
// ═══════════════════════════════════════════════════════════════

export const AIAnalysisMessageSchema = z.object({
  id: z.string(),
  type: z.enum(["user", "assistant"]),
  content: z.string(),
  created_at: z.string().optional(), // ISO timestamp
  response: QueryResponseSchema.optional(), // Only for assistant messages
});

export type AIAnalysisMessage = z.infer<typeof AIAnalysisMessageSchema>;

// ═══════════════════════════════════════════════════════════════
// QUERY HISTORY (In-Memory Storage - Legacy)
// ═══════════════════════════════════════════════════════════════

export interface QueryHistoryItem {
  id: string;
  question: string;
  timestamp: Date;
  success: boolean;
  row_count?: number;
  function_name?: string;
}

// ═══════════════════════════════════════════════════════════════
// PERCENTILE DATA (for ProjectSizeCalculator cache)
// ═══════════════════════════════════════════════════════════════

export interface PercentileData {
  p20: number;
  p40: number;
  p60: number;
  p80: number;
  min: number;
  max: number;
  total_projects: number;
  calculated_at: string;
}

// ═══════════════════════════════════════════════════════════════
// AZURE OPENAI TYPES
// ═══════════════════════════════════════════════════════════════

export interface AzureOpenAIConfig {
  endpoint: string;
  apiKey: string;
  apiVersion: string;
  deployment: string;
}

// ═══════════════════════════════════════════════════════════════
// EXTERNAL DATABASE CONFIG
// ═══════════════════════════════════════════════════════════════

export interface ExternalDBConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  connectTimeout?: number;
}

// ═══════════════════════════════════════════════════════════════
// EMBED LINKS TABLE (Domain-Restricted Iframe Embedding)
// ═══════════════════════════════════════════════════════════════

export interface EmbedLink {
  id: string;
  embed_id: string;
  role: UserRole;
  allowed_domain: string;
  name: string;
  created_by: string;
  created_by_email: string;
  is_active: boolean;
  created_at: Date;
  last_used_at: Date | null;
}

export interface InsertEmbedLink {
  embed_id: string;
  role: UserRole;
  allowed_domain: string;
  name: string;
  created_by: string;
  created_by_email: string;
}

export const insertEmbedLinkSchema = z.object({
  role: z.enum(USER_ROLES).optional().default('user'), // Role now comes from JWT, this is for backward compatibility
  allowed_domain: z.string().min(1, "Domain is required"),
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
});

export type InsertEmbedLinkInput = z.infer<typeof insertEmbedLinkSchema>;
