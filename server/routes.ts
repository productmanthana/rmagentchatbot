import * as fs from "fs";
import type { Express, Request } from "express";
import { queryExternalDb } from "./mssql-db";
import { QueryEngine } from "./utils/query-engine";
import { OpenAIClient } from "./utils/openai-client";
import { RAGVectorStore } from "./utils/rag-store";
import { openaiQueue } from "./utils/request-queue";
import { QueryRequestSchema, insertChatSchema, insertMessageSchema, AIAnalysisMessageSchema, updateMessageFAQSchema, insertErrorLogSchema, insertEmbedLinkSchema } from "@shared/schema";
import { z } from "zod";
import { nanoid } from "nanoid";
import multer from "multer";
import { unifiedStorage as chatStorage } from "./unified-storage";
import { mssqlStorage } from "./mssql-storage";
import { setupAuth, isAuthenticated, getUserId, getUserEmail, getUserRole, embedTokenStore } from "./simpleAuth";
import * as XLSX from "xlsx";
import { generateIntegrationPDF } from "./generate-pdf";
import { generateTechnicalArchitecturePDF } from "./generate-tech-pdf";
import { generateTechnicalArchitectureDOCX } from "./generate-tech-docx";
import { decodeAndExtractJWT } from "./utils/jwt-extractor";

let queryEngine: QueryEngine | null = null;
let ragStore: RAGVectorStore | null = null;
let ragInitPromise: Promise<void> | null = null; // Track RAG initialization

async function initializeRAG(openaiClient: OpenAIClient): Promise<RAGVectorStore | null> {
  const pineconeKey = process.env.PINECONE_API_KEY;
  
  if (!pineconeKey) {
    console.log('[RAG] ⚠️  Pinecone API key not configured - RAG disabled');
    console.log('[RAG] 💡 Set PINECONE_API_KEY in Secrets to enable RAG for improved accuracy');
    return null;
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiKey) {
    console.log('[RAG] ⚠️  OpenAI API key not configured - RAG disabled');
    console.log('[RAG] 💡 Set OPENAI_API_KEY in Secrets to enable RAG embeddings');
    return null;
  }

  try {
    console.log('[RAG] 🚀 Initializing RAG vector store with OpenAI embeddings...');
    const store = new RAGVectorStore(
      pineconeKey,
      'query-functions',
      'default',
      openaiClient,
      {
        openaiApiKey: openaiKey,
        model: 'text-embedding-3-large'
      }
    );
    
    await store.initialize();
    console.log('[RAG] ✅ RAG vector store initialized successfully');
    console.log('[RAG] 📊 Using OpenAI text-embedding-3-large (3072 dimensions)');
    console.log('[RAG] 📊 Enhanced query classification with semantic search enabled');
    return store;
  } catch (error) {
    console.error('[RAG] ❌ Failed to initialize RAG:', error);
    console.log('[RAG] ⚠️  Continuing without RAG - queries will use standard classification');
    return null;
  }
}

async function getQueryEngine(): Promise<QueryEngine> {
  if (!queryEngine) {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error("OpenAI API key is required. Please set OPENAI_API_KEY in environment secrets.");
    }

    // Using GPT-5.2 for classification with 400K context and xhigh reasoning
    console.log('[QueryEngine] 🚀 Initializing with GPT-5.2...');
    const openaiClient = new OpenAIClient(apiKey, 'gpt-5.1');

    // Initialize RAG and WAIT for it to complete before creating QueryEngine
    if (!ragInitPromise && process.env.PINECONE_API_KEY) {
      console.log('[QueryEngine] ⏳ Initializing RAG...');
      ragInitPromise = initializeRAG(openaiClient).then(store => {
        ragStore = store;
      }).catch(error => {
        console.error('[RAG] Initialization error:', error);
        ragInitPromise = null; // Reset on failure
      });
    }

    // Wait for RAG to finish before creating QueryEngine
    if (ragInitPromise) {
      await ragInitPromise;
    }

    // Create QueryEngine with RAG store (or null if unavailable)
    queryEngine = new QueryEngine(openaiClient, ragStore);
    
    if (ragStore) {
      console.log('[QueryEngine] ✅ GPT-5.2 initialized with RAG support');
    } else {
      console.log('[QueryEngine] ⚠️  GPT-5.2 initialized without RAG');
    }
  }

  return queryEngine;
}

export async function registerRoutes(app: Express): Promise<Express> {
  // ═══════════════════════════════════════════════════════════════
  // AUTHENTICATION SETUP
  // ═══════════════════════════════════════════════════════════════
  
  await setupAuth(app);

  // ═══════════════════════════════════════════════════════════════
  // MAIN QUERY ENDPOINT
  // ═══════════════════════════════════════════════════════════════

  app.post("/api/query", async (req, res) => {
    try {
      const validation = QueryRequestSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: "invalid_request",
          message: "Please provide a valid question",
          data: [],
        });
      }

      const { question, previousContext, originalContext } = validation.data;
      
      // Check for general/off-domain queries that are not related to RMOne data
      const generalTopicPatterns = [
        // Weather
        /\b(weather|temperature|rain|sunny|cloudy|forecast|climate)\b/i,
        // News/Politics
        /\b(president|election|vote|politician|congress|senate|government|news|headline)\b/i,
        // Entertainment
        /\b(movie|film|actor|actress|celebrity|song|music|singer|band|concert|tv show|netflix|youtube)\b/i,
        // Sports (general, not business)
        /\b(football|soccer|basketball|baseball|cricket|tennis|match|score|team won|playoff)\b/i,
        // General knowledge
        /\b(capital of|population of|who invented|when was .* born|how old is|history of)\b/i,
        // Personal assistant
        /\b(tell me a joke|write a poem|translate|recipe|cook|restaurant|food recommendation)\b/i,
        // Math/calculations (simple) - only pure math like "what is 2+2"
        /^what is \d+[\s]*[\+\-\*\/][\s]*\d+/i,
        // Greetings/chitchat (short non-questions)
        /^(hi|hello|hey|good morning|good afternoon|good evening|how are you|what's up|sup)\s*[?!.]*$/i,
        // Generic "what is" for non-data topics
        /\bwhat is (a |an |the )?(love|life|happiness|meaning|universe|god|time|space|atom)\b/i,
        // Technology (general, not RMOne)
        /\b(iphone|android|laptop|computer|gaming|playstation|xbox|bitcoin|crypto)\b/i,
      ];
      
      // RMOne business keywords that indicate valid queries (include plurals with s?)
      const rmoneKeywords = [
        /\b(projects?|proposals?|contracts?|clients?|status|won|lost|submitted|pipeline|revenue|fees?|pocs?|bids?|rfps?|categor(y|ies)|segments?|states?|cit(y|ies)|regions?|agenc(y|ies)|architects?|engineers?|consultants?|construction|buildings?|infrastructure)\b/i,
      ];
      
      const isGeneralQuery = generalTopicPatterns.some(pattern => pattern.test(question));
      const hasRmoneKeywords = rmoneKeywords.some(pattern => pattern.test(question));
      
      // If it matches general patterns AND doesn't have RMOne keywords, it's off-topic
      if (isGeneralQuery && !hasRmoneKeywords) {
        return res.json({
          success: false,
          error: "off_topic",
          question: question, // Include original question for "Your Query" display
          message: "I am the RMOne Proprietary AI Agent, designed specifically for RMOne database queries. I can help you analyze projects, contracts, proposals, pipeline data, and other business metrics. Please ask me questions about your RMOne data!",
          data: [],
        });
      }
      
      // Check for dangerous SQL keywords - these indicate attempts to modify data
      const dangerousKeywords = [
        'insert', 'update', 'delete', 'drop', 'truncate', 'alter', 'create', 
        'grant', 'revoke', 'exec', 'execute', 'merge', 'replace', 'call'
      ];
      const questionLower = question.toLowerCase();
      const foundDangerousKeyword = dangerousKeywords.find(keyword => {
        // Check for the keyword as a standalone word (not part of another word)
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        return regex.test(questionLower);
      });
      
      if (foundDangerousKeyword) {
        return res.json({
          success: false,
          error: "restricted_operation",
          question: question, // Include original question for "Your Query" display
          message: `I am the RMOne Proprietary AI Agent, designed to help you retrieve and analyze data, not modify it. For data changes like "${foundDangerousKeyword}", please contact your database administrator or use the appropriate data management tools.`,
          data: [],
        });
      }
      
      const engine = await getQueryEngine();

      const response = await engine.processQuery(question, queryExternalDb, previousContext, originalContext);

      // Generate AI insights automatically for all successful queries
      // Skip for AI analysis responses since they already have narrative
      const isAIAnalysis = response.data?.[0]?.type === 'ai_analysis';
      if (response.success && response.data && response.data.length > 0 && !isAIAnalysis) {
        try {
          console.log("[API] Starting AI insights generation with OpenAI GPT-5.2...");
          
          const openaiKey = process.env.OPENAI_API_KEY;
          if (!openaiKey) {
            throw new Error("OpenAI API key not configured");
          }
          
          // Use GPT-5.2 for high-quality insights with enhanced reasoning
          const openaiClient = new OpenAIClient(openaiKey, 'gpt-5.1');
          
          const dataContext = `
Question: ${question}
Number of Results: ${response.row_count || response.data.length}
Summary Statistics: ${JSON.stringify(response.summary, null, 2)}
Sample Data (first 3 rows): ${JSON.stringify(response.data.slice(0, 3), null, 2)}
          `.trim();
          
          // Add timeout to prevent infinite spinning (15 seconds max)
          const AI_INSIGHTS_TIMEOUT = 15000;
          const timeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('AI insights timeout')), AI_INSIGHTS_TIMEOUT)
          );
          
          // Use request queue to prevent rate limiting with concurrent users
          const insights = await Promise.race([
            openaiQueue.enqueue(() => 
              openaiClient.chat([
                {
                  role: "system",
                  content: "You are a data analyst providing concise, actionable insights. Keep responses brief (2-3 sentences max) and focus on the most important patterns and findings."
                },
                {
                  role: "user",
                  content: `Based on this query result, provide 2-3 key insights in plain language:\n\n${dataContext}`
                }
              ])
            ),
            timeoutPromise
          ]);
          
          response.ai_insights = insights;
          console.log("[API] ✓ AI insights generated successfully");
        } catch (aiError: any) {
          console.error("[API] ⚠️  Error generating AI insights:", aiError?.message || aiError);
          // Don't fail the whole query if insights generation fails or times out
        }
      }

      // Always include the original question in the response
      res.json({ ...response, question });
    } catch (error) {
      console.error("Error processing query:", error);
      const question = req.body?.question;
      res.status(500).json({
        success: false,
        error: "internal_error",
        message: String(error),
        data: [],
        question,
      });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // CHAT MANAGEMENT ENDPOINTS (Protected by authentication)
  // ═══════════════════════════════════════════════════════════════

  // List all chats for authenticated user
  app.get("/api/chats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "unauthorized",
          message: "Authentication required",
        });
      }

      const chats = await chatStorage.listChats(userId);
      res.json({ success: true, data: chats });
    } catch (error) {
      console.error("Error listing chats:", error);
      res.status(500).json({
        success: false,
        error: "internal_error",
        message: String(error),
      });
    }
  });

  // Create a new chat
  app.post("/api/chats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "unauthorized",
          message: "Authentication required",
        });
      }

      // Generate ID server-side
      const chatId = nanoid();
      
      const validation = insertChatSchema.safeParse({
        id: chatId,
        title: req.body.title || "New Chat",
        session_id: userId,
      });

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: "invalid_request",
          message: "Invalid chat data",
          details: validation.error,
        });
      }

      const chat = await chatStorage.createChat(validation.data);
      res.json({ success: true, data: chat });
    } catch (error) {
      console.error("Error creating chat:", error);
      res.status(500).json({
        success: false,
        error: "internal_error",
        message: String(error),
      });
    }
  });

  // Get a single chat
  app.get("/api/chats/:chatId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "unauthorized",
          message: "Authentication required",
        });
      }

      const chat = await chatStorage.getChat(req.params.chatId);
      
      if (!chat) {
        return res.status(404).json({
          success: false,
          error: "not_found",
          message: "Chat not found",
        });
      }

      if (chat.session_id !== userId) {
        return res.status(403).json({
          success: false,
          error: "forbidden",
          message: "Access denied",
        });
      }

      res.json({ success: true, data: chat });
    } catch (error) {
      console.error("Error getting chat:", error);
      res.status(500).json({
        success: false,
        error: "internal_error",
        message: String(error),
      });
    }
  });

  // Update chat title
  app.patch("/api/chats/:chatId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "unauthorized",
          message: "Authentication required",
        });
      }

      const chat = await chatStorage.getChat(req.params.chatId);
      
      if (!chat) {
        return res.status(404).json({
          success: false,
          error: "not_found",
          message: "Chat not found",
        });
      }

      if (chat.session_id !== userId) {
        return res.status(403).json({
          success: false,
          error: "forbidden",
          message: "Access denied",
        });
      }

      const { title } = req.body;
      if (!title || typeof title !== 'string') {
        return res.status(400).json({
          success: false,
          error: "invalid_request",
          message: "Title is required",
        });
      }

      const updatedChat = await chatStorage.updateChatTitle(req.params.chatId, title);
      res.json({ success: true, data: updatedChat });
    } catch (error) {
      console.error("Error updating chat:", error);
      res.status(500).json({
        success: false,
        error: "internal_error",
        message: String(error),
      });
    }
  });

  // Delete a chat
  app.delete("/api/chats/:chatId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "unauthorized",
          message: "Authentication required",
        });
      }

      const chat = await chatStorage.getChat(req.params.chatId);
      
      if (!chat) {
        return res.status(404).json({
          success: false,
          error: "not_found",
          message: "Chat not found",
        });
      }

      if (chat.session_id !== userId) {
        return res.status(403).json({
          success: false,
          error: "forbidden",
          message: "Access denied",
        });
      }

      await chatStorage.deleteChat(req.params.chatId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting chat:", error);
      res.status(500).json({
        success: false,
        error: "internal_error",
        message: String(error),
      });
    }
  });

  // List messages for a chat - OPTIMIZED for speed
  app.get("/api/chats/:chatId/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "unauthorized",
          message: "Authentication required",
        });
      }

      // Run both queries in PARALLEL for faster response
      const [chat, messages] = await Promise.all([
        chatStorage.getChat(req.params.chatId),
        chatStorage.listMessages(req.params.chatId)
      ]);
      
      if (!chat) {
        return res.status(404).json({
          success: false,
          error: "not_found",
          message: "Chat not found",
        });
      }

      if (chat.session_id !== userId) {
        return res.status(403).json({
          success: false,
          error: "forbidden",
          message: "Access denied",
        });
      }
      
      // Map snake_case database fields to camelCase for frontend
      const serializedMessages = messages.map(msg => ({
        ...msg,
        aiAnalysisMessages: msg.ai_analysis_messages,
        ai_analysis_messages: undefined,
      }));
      
      res.json({ success: true, data: serializedMessages });
    } catch (error) {
      console.error("Error listing messages:", error);
      res.status(500).json({
        success: false,
        error: "internal_error",
        message: String(error),
      });
    }
  });

  // Create a new message
  app.post("/api/chats/:chatId/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "unauthorized",
          message: "Authentication required",
        });
      }

      const chat = await chatStorage.getChat(req.params.chatId);
      
      if (!chat) {
        return res.status(404).json({
          success: false,
          error: "not_found",
          message: "Chat not found",
        });
      }

      if (chat.session_id !== userId) {
        return res.status(403).json({
          success: false,
          error: "forbidden",
          message: "Access denied",
        });
      }

      // Generate ID server-side
      const messageId = nanoid();
      
      // Store full response data without any row limits
      const response = req.body.response || null;
      
      const validation = insertMessageSchema.safeParse({
        id: messageId,
        chat_id: req.params.chatId,
        type: req.body.type,
        content: req.body.content,
        response: response,
      });

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: "invalid_request",
          message: "Invalid message data",
          details: validation.error,
        });
      }

      const message = await chatStorage.createMessage(validation.data);
      res.json({ success: true, data: message });
    } catch (error) {
      console.error("Error creating message:", error);
      res.status(500).json({
        success: false,
        error: "internal_error",
        message: String(error),
      });
    }
  });

  // Update a message (for AI Analysis follow-ups)
  app.patch("/api/chats/:chatId/messages/:messageId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "unauthorized",
          message: "Authentication required",
        });
      }

      const { chatId, messageId } = req.params;

      // Verify chat ownership first
      const chat = await chatStorage.getChat(chatId);
      if (!chat) {
        return res.status(404).json({
          success: false,
          error: "not_found",
          message: "Chat not found",
        });
      }

      if (chat.session_id !== userId) {
        return res.status(403).json({
          success: false,
          error: "forbidden",
          message: "Access denied",
        });
      }

      // Get the message and verify it belongs to this chat
      const message = await chatStorage.getMessageById(chatId, messageId);
      if (!message) {
        return res.status(404).json({
          success: false,
          error: "not_found",
          message: "Message not found",
        });
      }

      if (message.chat_id !== chatId) {
        return res.status(403).json({
          success: false,
          error: "forbidden",
          message: "Message does not belong to this chat",
        });
      }

      // Check if this is an FAQ update request
      const { ai_analysis_messages, is_faq, faq_category, faq_display_text } = req.body;
      
      // Handle FAQ updates
      if (is_faq !== undefined) {
        const faqValidation = updateMessageFAQSchema.safeParse({ 
          is_faq, 
          faq_category, 
          faq_display_text 
        });
        
        if (!faqValidation.success) {
          return res.status(400).json({
            success: false,
            error: "invalid_request",
            message: "Invalid FAQ data format",
            details: faqValidation.error,
          });
        }
        
        // Pass userId to associate FAQ with the current user for per-user visibility
        const currentUserId = getUserId(req);
        const updated = await chatStorage.updateMessageFAQ(chatId, messageId, faqValidation.data, currentUserId || undefined);
        return res.json({ success: true, data: updated });
      }
      
      // Handle AI analysis messages update
      if (ai_analysis_messages === undefined) {
        return res.status(400).json({
          success: false,
          error: "invalid_request",
          message: "ai_analysis_messages or is_faq field is required",
        });
      }
      
      const validation = z.array(AIAnalysisMessageSchema).safeParse(ai_analysis_messages);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: "invalid_request",
          message: "Invalid AI analysis messages format",
          details: validation.error,
        });
      }

      // Update the message with validated AI Analysis follow-ups
      const updated = await chatStorage.updateMessageAIAnalysis(chatId, messageId, ai_analysis_messages);
      
      res.json({ success: true, data: updated });
    } catch (error) {
      console.error("Error updating message:", error);
      res.status(500).json({
        success: false,
        error: "internal_error",
        message: String(error),
      });
    }
  });

  // Delete a message
  app.delete("/api/chats/:chatId/messages/:messageId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "unauthorized",
          message: "Authentication required",
        });
      }

      const chat = await chatStorage.getChat(req.params.chatId);
      
      if (!chat) {
        return res.status(404).json({
          success: false,
          error: "not_found",
          message: "Chat not found",
        });
      }

      if (chat.session_id !== userId) {
        return res.status(403).json({
          success: false,
          error: "forbidden",
          message: "Access denied",
        });
      }

      await chatStorage.deleteMessage(req.params.messageId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting message:", error);
      res.status(500).json({
        success: false,
        error: "internal_error",
        message: String(error),
      });
    }
  });

  // Bulk import chats from localStorage (legacy support)
  app.post("/api/chats/import", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "unauthorized",
          message: "Authentication required",
        });
      }

      const { chats: chatsData } = req.body;
      
      if (!Array.isArray(chatsData)) {
        return res.status(400).json({
          success: false,
          error: "invalid_request",
          message: "Chats data must be an array",
        });
      }

      // Parse ISO date strings to Date objects
      const normalizedChats = chatsData.map(chat => ({
        ...chat,
        created_at: new Date(chat.created_at),
        updated_at: new Date(chat.updated_at),
        messages: chat.messages?.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        })) || [],
      }));

      await chatStorage.importChats(userId, normalizedChats);
      res.json({ success: true, imported: normalizedChats.length });
    } catch (error) {
      console.error("Error importing chats:", error);
      res.status(500).json({
        success: false,
        error: "internal_error",
        message: String(error),
      });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // FAQ SAMPLE QUESTIONS ENDPOINT (Authenticated)
  // ═══════════════════════════════════════════════════════════════

  app.get("/api/faq-samples", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      // For logged-in users (admin/superadmin), use their email as userId
      // This ensures FAQs persist across browsers when they log in with same account
      // For embed users without login, FAQs are tied to browser session
      const faqQuestions = await chatStorage.getFAQSampleQuestions(userId || undefined);
      res.json({ success: true, data: faqQuestions });
    } catch (error) {
      console.error("Error fetching FAQ samples:", error);
      res.status(500).json({
        success: false,
        error: "internal_error",
        message: String(error),
      });
    }
  });

  // Delete an FAQ sample by message ID (removes FAQ status from the message)
  app.delete("/api/faq-samples/:messageId", isAuthenticated, async (req, res) => {
    try {
      const { messageId } = req.params;
      const userId = getUserId(req);
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "unauthorized",
          message: "User not authenticated",
        });
      }
      
      // Remove FAQ status from the message
      await chatStorage.removeFAQStatus(messageId);
      
      res.json({ success: true, message: "FAQ sample removed" });
    } catch (error) {
      console.error("Error removing FAQ sample:", error);
      res.status(500).json({
        success: false,
        error: "internal_error",
        message: String(error),
      });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // HIDDEN FAQS ENDPOINTS - Persist user's hidden FAQ preferences
  // ═══════════════════════════════════════════════════════════════

  // Get hidden FAQs for current user
  app.get("/api/hidden-faqs", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ success: false, error: "unauthorized" });
      }
      const hiddenFaqs = await mssqlStorage.getHiddenFAQs(userId);
      res.json({ success: true, data: hiddenFaqs });
    } catch (error) {
      console.error("Error fetching hidden FAQs:", error);
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // Add a hidden FAQ for current user
  app.post("/api/hidden-faqs", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ success: false, error: "unauthorized" });
      }
      const { faqText } = req.body;
      if (!faqText || typeof faqText !== 'string') {
        return res.status(400).json({ success: false, error: "faqText is required" });
      }
      await mssqlStorage.addHiddenFAQ(userId, faqText);
      res.json({ success: true, message: "FAQ hidden successfully" });
    } catch (error) {
      console.error("Error adding hidden FAQ:", error);
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // Remove a hidden FAQ for current user
  app.delete("/api/hidden-faqs", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ success: false, error: "unauthorized" });
      }
      const { faqText } = req.body;
      if (!faqText || typeof faqText !== 'string') {
        return res.status(400).json({ success: false, error: "faqText is required" });
      }
      await mssqlStorage.removeHiddenFAQ(userId, faqText);
      res.json({ success: true, message: "FAQ unhidden successfully" });
    } catch (error) {
      console.error("Error removing hidden FAQ:", error);
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // Clear all hidden FAQs for current user
  app.delete("/api/hidden-faqs/all", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ success: false, error: "unauthorized" });
      }
      await mssqlStorage.clearHiddenFAQs(userId);
      res.json({ success: true, message: "All hidden FAQs cleared" });
    } catch (error) {
      console.error("Error clearing hidden FAQs:", error);
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // Get the first user message of a chat (for FAQ marking from sidebar)
  app.get("/api/chats/:chatId/first-user-message", isAuthenticated, async (req, res) => {
    try {
      const { chatId } = req.params;
      const userId = getUserId(req);
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "unauthorized",
          message: "User not authenticated",
        });
      }
      
      // Verify ownership - check that chat belongs to this user
      const chat = await chatStorage.getChat(chatId);
      if (!chat || chat.session_id !== userId) {
        return res.status(403).json({
          success: false,
          error: "forbidden",
          message: "You do not have access to this chat",
        });
      }
      
      const firstUserMessage = await chatStorage.getFirstUserMessage(chatId);
      
      if (!firstUserMessage) {
        return res.json({ success: true, data: null });
      }
      
      res.json({ 
        success: true, 
        data: {
          id: firstUserMessage.id,
          content: firstUserMessage.content,
          is_faq: firstUserMessage.is_faq || false,
          faq_category: firstUserMessage.faq_category || null,
          faq_display_text: firstUserMessage.faq_display_text || null,
        }
      });
    } catch (error) {
      console.error("Error fetching first user message:", error);
      res.status(500).json({
        success: false,
        error: "internal_error",
        message: String(error),
      });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // ERROR LOG ENDPOINTS (Authenticated)
  // ═══════════════════════════════════════════════════════════════

  // Create an error log
  app.post("/api/error-logs", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const userEmail = getUserEmail(req);
      
      console.log("[Error Log] Creating error log - userId:", userId, "userEmail:", userEmail);
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "unauthorized",
          message: "User not authenticated",
        });
      }

      const validation = insertErrorLogSchema.safeParse({
        ...req.body,
        id: nanoid(),
        session_id: userId,
        user_id: userId,
        user_email: userEmail,
      });

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: "invalid_request",
          message: validation.error.errors[0]?.message || "Invalid request data",
        });
      }

      const errorLog = await chatStorage.createErrorLog(validation.data);
      res.json({ success: true, data: errorLog });
    } catch (error) {
      console.error("Error creating error log:", error);
      res.status(500).json({
        success: false,
        error: "internal_error",
        message: String(error),
      });
    }
  });

  // Get error logs - superadmin sees all, others see only their own
  // Special privacy: shivanimathad@vyaasai.com logs are ONLY visible to that user
  app.get("/api/error-logs", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const userEmail = getUserEmail(req);
      const chatId = req.query.chatId as string | undefined;
      const { getUserRole } = await import("./simpleAuth");
      const userRole = await getUserRole(req);
      
      console.log('[error-logs] Request - userId:', userId, 'userEmail:', userEmail, 'role:', userRole, 'embedData:', (req as any).embedData);
      // Write to file for debugging
      const fs = await import('fs');
      const debugLog = `[${new Date().toISOString()}] error-logs - userId: ${userId}, userEmail: ${userEmail}, role: ${userRole}, embedData: ${JSON.stringify((req as any).embedData)}\n`;
      fs.appendFileSync('/tmp/debug-logs.txt', debugLog);
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "unauthorized",
          message: "User not authenticated",
        });
      }
      
      // Private user emails - their logs are only visible to themselves
      const PRIVATE_LOG_USERS = ['shivanimathad@vyaasai.com'];
      const isPrivateUser = userEmail && PRIVATE_LOG_USERS.includes(userEmail.toLowerCase());
      
      let errorLogs;
      
      // Superadmin sees ALL logs from ALL users (except private users' logs)
      if (userRole === 'superadmin') {
        console.log('[error-logs] Superadmin access - fetching ALL logs');
        if (chatId) {
          errorLogs = await chatStorage.listErrorLogsByChat(chatId);
        } else {
          errorLogs = await chatStorage.listErrorLogs();
        }
        console.log('[error-logs] Superadmin fetched', errorLogs?.length || 0, 'total logs');
        
        // Filter out private users' logs unless the superadmin IS that private user
        if (!isPrivateUser) {
          errorLogs = errorLogs.filter(log => {
            const logEmail = log.user_email?.toLowerCase();
            return !logEmail || !PRIVATE_LOG_USERS.includes(logEmail);
          });
        }
      } else {
        // Non-superadmin only sees their own logs
        if (chatId) {
          const allChatLogs = await chatStorage.listErrorLogsByChat(chatId);
          errorLogs = allChatLogs.filter(log => log.user_id === userId);
        } else {
          errorLogs = await chatStorage.listErrorLogsByUser(userId);
        }
      }
      
      res.json({ success: true, data: errorLogs });
    } catch (error) {
      console.error("Error fetching error logs:", error);
      res.status(500).json({
        success: false,
        error: "internal_error",
        message: String(error),
      });
    }
  });

  // Delete an error log (any authenticated user can delete)
  app.delete("/api/error-logs/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;

      await chatStorage.deleteErrorLog(id);
      res.json({ success: true, message: "Error log deleted" });
    } catch (error) {
      console.error("Error deleting error log:", error);
      res.status(500).json({
        success: false,
        error: "internal_error",
        message: String(error),
      });
    }
  });

  // Bulk delete error logs
  app.post("/api/error-logs/bulk-delete", isAuthenticated, async (req, res) => {
    try {
      const { ids } = req.body;
      
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: "invalid_request",
          message: "Please provide an array of log IDs to delete",
        });
      }

      let deletedCount = 0;
      for (const id of ids) {
        try {
          await chatStorage.deleteErrorLog(id);
          deletedCount++;
        } catch (err) {
          console.error(`Failed to delete log ${id}:`, err);
        }
      }
      
      res.json({ 
        success: true, 
        message: `${deletedCount} log(s) deleted`,
        deletedCount 
      });
    } catch (error) {
      console.error("Error bulk deleting error logs:", error);
      res.status(500).json({
        success: false,
        error: "internal_error",
        message: String(error),
      });
    }
  });

  // Update an error log (developer comment and status)
  app.patch("/api/error-logs/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const { developer_comment, status } = req.body;

      const updated = await chatStorage.updateErrorLog(id, { developer_comment, status });
      
      if (!updated) {
        return res.status(404).json({
          success: false,
          error: "not_found",
          message: "Error log not found",
        });
      }
      
      res.json({ success: true, data: updated });
    } catch (error) {
      console.error("Error updating error log:", error);
      res.status(500).json({
        success: false,
        error: "internal_error",
        message: String(error),
      });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // ERROR LOG SCREENSHOT UPLOAD
  // ═══════════════════════════════════════════════════════════════

  
  const path = await import("path");
  
  const uploadsDir = path.join(process.cwd(), "uploads", "error-logs");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log("📁 Created uploads directory:", uploadsDir);
  }

  const screenshotStorage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${nanoid(8)}`;
      const ext = path.extname(file.originalname) || ".jpg";
      cb(null, `screenshot-${uniqueSuffix}${ext}`);
    },
  });

  const screenshotUpload = multer({
    storage: screenshotStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (_req, file, cb) => {
      const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error("Only image files (JPEG, PNG, GIF, WebP) are allowed"));
      }
    },
  });

  // Upload screenshot for error log
  app.post("/api/error-logs/:id/screenshot", isAuthenticated, screenshotUpload.single("screenshot"), async (req, res) => {
    try {
      const { id } = req.params;
      
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "no_file",
          message: "No screenshot file uploaded",
        });
      }

      const screenshotUrl = `/uploads/error-logs/${req.file.filename}`;
      const screenshotFilename = req.file.filename;
      
      const updated = await chatStorage.updateErrorLogScreenshot(id, screenshotFilename, screenshotUrl);
      
      if (!updated) {
        // Clean up the uploaded file if error log not found
        fs.unlinkSync(req.file.path);
        return res.status(404).json({
          success: false,
          error: "not_found",
          message: "Error log not found",
        });
      }
      
      res.json({ 
        success: true, 
        data: {
          screenshot_url: screenshotUrl,
          screenshot_filename: screenshotFilename,
        }
      });
    } catch (error) {
      console.error("Error uploading screenshot:", error);
      res.status(500).json({
        success: false,
        error: "internal_error",
        message: String(error),
      });
    }
  });

  // Serve uploaded screenshots (authenticated)
  app.use("/uploads/error-logs", isAuthenticated, (await import("express")).static(uploadsDir));

  // ═══════════════════════════════════════════════════════════════
  // AI ANALYSIS ENDPOINT
  // ═══════════════════════════════════════════════════════════════

  app.post("/api/ai-analysis", async (req, res) => {
    try {
      const { question, originalQuestion, followUpQuestion, queryData } = req.body;

      if (!question || !queryData) {
        return res.status(400).json({
          success: false,
          error: "invalid_request",
          message: "Please provide a question and query data",
        });
      }

      const apiKey = process.env.OPENAI_API_KEY;

      if (!apiKey) {
        return res.status(500).json({
          success: false,
          error: "configuration_error",
          message: "OpenAI API key not configured",
        });
      }

      const openaiClient = new OpenAIClient(apiKey, 'gpt-5.1');

      // Create context from query data
      const dataContext = `
Original Question: ${originalQuestion}
Follow-up Question: ${followUpQuestion}
Combined Query Context: ${question}

Number of Results: ${queryData.rowCount}
Summary Statistics: ${JSON.stringify(queryData.summary, null, 2)}
Sample Data (first 5 rows): ${JSON.stringify(queryData.data.slice(0, 5), null, 2)}
      `.trim();

      const response = await openaiClient.chat([
        {
          role: "system",
          content: `You are a data analyst helping users understand their project data. 
The user originally asked: "${originalQuestion}"
Now they have a follow-up question: "${followUpQuestion}"

Provide clear, actionable insights in plain language that addresses their follow-up question in the context of their original query. Focus on:
- Answering the follow-up question directly
- Providing context from the original query results
- Key patterns and trends relevant to the question
- Actionable recommendations

Keep responses concise (2-3 paragraphs max) and conversational.`,
        },
        {
          role: "user",
          content: `Based on this query result data:
${dataContext}

Please provide a helpful analysis for the follow-up question.`,
        },
      ]);

      res.json({
        success: true,
        analysis: response,
      });
    } catch (error) {
      console.error("Error generating AI analysis:", error);
      res.status(500).json({
        success: false,
        error: "internal_error",
        message: "Failed to generate analysis",
      });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // DATABASE CONNECTION TEST
  // ═══════════════════════════════════════════════════════════════

  app.get("/api/health", async (req, res) => {
    try {
      const result = await queryExternalDb("SELECT 1 as connected");
      res.json({
        status: "ok",
        database: result.length > 0 ? "connected" : "error",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        status: "error",
        database: "disconnected",
        error: String(error),
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // PDF DOWNLOAD ENDPOINT
  // ═══════════════════════════════════════════════════════════════

  app.get("/api/download/integration-guide.pdf", async (req, res) => {
    try {
      const pdfBuffer = await generateIntegrationPDF();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="RMOne-Embed-Integration-Guide.pdf"');
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  });

  app.get("/api/download/technical-architecture.pdf", async (req, res) => {
    try {
      const pdfBuffer = await generateTechnicalArchitecturePDF();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="RMOne-Technical-Architecture.pdf"');
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  });

  app.get("/api/download/technical-architecture.docx", async (req, res) => {
    try {
      const docxBuffer = await generateTechnicalArchitectureDOCX();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', 'attachment; filename="RMOne-Technical-Architecture.docx"');
      res.setHeader('Content-Length', docxBuffer.length);
      res.send(docxBuffer);
    } catch (error: any) {
      console.error("Error generating DOCX:", error);
      res.status(500).json({ error: "Failed to generate Word document" });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // DASHBOARD ANALYTICS ENDPOINT
  // ═══════════════════════════════════════════════════════════════

  app.get("/api/dashboard/analytics", async (req, res) => {
    try {
      // Fetch all aggregate data in parallel for dashboard
      const [
        summaryStats,
        sizeDistribution,
        statusDistribution,
        categoryDistribution,
        stateDistribution,
        monthlyTrend,
        topProjects,
        winRateByCategory,
      ] = await Promise.all([
        // Overall summary statistics
        queryExternalDb(`
          SELECT 
            COUNT(*) as total_projects,
            COALESCE(SUM(CAST(NULLIF("Fee", '') AS NUMERIC)), 0) as total_value,
            COALESCE(AVG(CAST(NULLIF("Fee", '') AS NUMERIC)), 0) as avg_fee,
            COALESCE(AVG("ChanceOfSuccess"), 0) as avg_win_rate
          FROM "POR"
        `),
        
        // Distribution by size - uses PERCENTILE_CONT for dynamic thresholds
        queryExternalDb(`
          WITH Percentiles AS (
            SELECT TOP 1
              PERCENTILE_CONT(0.20) WITHIN GROUP (ORDER BY numeric_fee) OVER () as p20,
              PERCENTILE_CONT(0.40) WITHIN GROUP (ORDER BY numeric_fee) OVER () as p40,
              PERCENTILE_CONT(0.60) WITHIN GROUP (ORDER BY numeric_fee) OVER () as p60,
              PERCENTILE_CONT(0.80) WITHIN GROUP (ORDER BY numeric_fee) OVER () as p80
            FROM (
              SELECT TRY_CAST(Fee AS NUMERIC) as numeric_fee
              FROM "POR"
              WHERE Fee IS NOT NULL AND TRY_CAST(Fee AS NUMERIC) > 0
            ) fee_data
            WHERE numeric_fee IS NOT NULL
          )
          SELECT 
            CASE 
              WHEN CAST(NULLIF(d."Fee", '') AS NUMERIC) < p.p20 THEN 'Micro'
              WHEN CAST(NULLIF(d."Fee", '') AS NUMERIC) >= p.p20 AND CAST(NULLIF(d."Fee", '') AS NUMERIC) < p.p40 THEN 'Small'
              WHEN CAST(NULLIF(d."Fee", '') AS NUMERIC) >= p.p40 AND CAST(NULLIF(d."Fee", '') AS NUMERIC) < p.p60 THEN 'Medium'
              WHEN CAST(NULLIF(d."Fee", '') AS NUMERIC) >= p.p60 AND CAST(NULLIF(d."Fee", '') AS NUMERIC) < p.p80 THEN 'Large'
              ELSE 'Mega'
            END as project_size,
            COUNT(*) as count,
            COALESCE(SUM(CAST(NULLIF(d."Fee", '') AS NUMERIC)), 0) as total_value
          FROM "POR" d
          CROSS JOIN Percentiles p
          WHERE d."Fee" IS NOT NULL AND d."Fee" != ''
          GROUP BY CASE 
              WHEN CAST(NULLIF(d."Fee", '') AS NUMERIC) < p.p20 THEN 'Micro'
              WHEN CAST(NULLIF(d."Fee", '') AS NUMERIC) >= p.p20 AND CAST(NULLIF(d."Fee", '') AS NUMERIC) < p.p40 THEN 'Small'
              WHEN CAST(NULLIF(d."Fee", '') AS NUMERIC) >= p.p40 AND CAST(NULLIF(d."Fee", '') AS NUMERIC) < p.p60 THEN 'Medium'
              WHEN CAST(NULLIF(d."Fee", '') AS NUMERIC) >= p.p60 AND CAST(NULLIF(d."Fee", '') AS NUMERIC) < p.p80 THEN 'Large'
              ELSE 'Mega'
            END
          ORDER BY MIN(CAST(NULLIF(d."Fee", '') AS NUMERIC))
        `),
        
        // Distribution by status
        queryExternalDb(`
          SELECT 
            "StatusChoice" as "Status",
            COUNT(*) as count,
            COALESCE(SUM(CAST(NULLIF("Fee", '') AS NUMERIC)), 0) as total_value
          FROM "POR"
          WHERE "StatusChoice" IS NOT NULL AND "StatusChoice" != ''
          GROUP BY "StatusChoice"
          ORDER BY count DESC
          OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY
        `),
        
        // Distribution by category
        queryExternalDb(`
          SELECT 
            "RequestCategory" as category,
            COUNT(*) as count,
            COALESCE(SUM(CAST(NULLIF("Fee", '') AS NUMERIC)), 0) as total_value
          FROM "POR"
          WHERE "RequestCategory" IS NOT NULL AND "RequestCategory" != ''
          GROUP BY "RequestCategory"
          ORDER BY count DESC
          OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY
        `),
        
        // Geographic distribution
        queryExternalDb(`
          SELECT 
            "State" as state,
            COUNT(*) as count,
            COALESCE(SUM(CAST(NULLIF("Fee", '') AS NUMERIC)), 0) as total_value
          FROM "POR"
          WHERE "State" IS NOT NULL AND "State" != ''
          GROUP BY "State"
          ORDER BY count DESC
          OFFSET 0 ROWS FETCH NEXT 15 ROWS ONLY
        `),
        
        // Monthly trend (last 12 months)
        queryExternalDb(`
          SELECT 
            FORMAT(TRY_CONVERT(DATE, "ConstStartDate"), 'yyyy-MM') as month,
            COUNT(*) as count,
            COALESCE(SUM(CAST(NULLIF("Fee", '') AS NUMERIC)), 0) as total_value
          FROM "POR"
          WHERE TRY_CONVERT(DATE, "ConstStartDate") >= DATEADD(MONTH, -12, CAST(GETDATE() AS DATE))
            AND "ConstStartDate" IS NOT NULL
          GROUP BY FORMAT(TRY_CONVERT(DATE, "ConstStartDate"), 'yyyy-MM')
          ORDER BY month
        `),
        
        // Top 10 projects by fee
        queryExternalDb(`
          SELECT 
            "Title" as "Project Name",
            CAST(NULLIF("Fee", '') AS NUMERIC) as fee,
            "StatusChoice" as "Status",
            "RequestCategory" as category
          FROM "POR"
          WHERE "Fee" IS NOT NULL AND "Fee" != ''
          ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC) DESC
          OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY
        `),
        
        // Win rate by category
        queryExternalDb(`
          SELECT 
            "RequestCategory" as category,
            COUNT(*) as total_projects,
            COALESCE(AVG("ChanceOfSuccess"), 0) as avg_win_rate,
            COALESCE(SUM(CAST(NULLIF("Fee", '') AS NUMERIC)), 0) as total_value
          FROM "POR"
          WHERE "RequestCategory" IS NOT NULL 
            AND "RequestCategory" != ''
            AND "ChanceOfSuccess" IS NOT NULL
          GROUP BY "RequestCategory"
          ORDER BY avg_win_rate DESC
          OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY
        `)
      ]);

      res.json({
        success: true,
        data: {
          summary: summaryStats[0] || {},
          sizeDistribution: sizeDistribution || [],
          statusDistribution: statusDistribution || [],
          categoryDistribution: categoryDistribution || [],
          stateDistribution: stateDistribution || [],
          monthlyTrend: monthlyTrend || [],
          topProjects: topProjects || [],
          winRateByCategory: winRateByCategory || [],
        }
      });
    } catch (error) {
      console.error("Error fetching dashboard analytics:", error);
      res.status(500).json({
        success: false,
        error: "internal_error",
        message: String(error),
      });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // EXAMPLE QUERIES
  // ═══════════════════════════════════════════════════════════════

  app.get("/api/examples", (req, res) => {
    res.json({
      examples: [
        {
          category: "Date Queries",
          queries: [
            "Show me all mega sized projects starting in the next ten months which are transportation related",
            "Top 10 projects in last 6 months",
            "Projects in Q1 2026",
            "What projects are coming soon?",
          ],
        },
        {
          category: "Rankings",
          queries: [
            "Top 5 largest projects",
            "Biggest projects in California",
            "Smallest projects this year",
          ],
        },
        {
          category: "Filters & Analysis",
          queries: [
            "Projects with Rail and Transit tags",
            "Healthcare category projects with Win% > 70%",
            "Compare revenue between OPCOs",
            "Status breakdown of all projects",
          ],
        },
        {
          category: "Predictions",
          queries: [
            "What if projections for revenue",
            "Top predicted wins",
            "Overoptimistic losses",
          ],
        },
      ],
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // EMBEDDING SNIPPET GENERATION
  // ═══════════════════════════════════════════════════════════════

  app.get("/api/embed/snippet", (req, res) => {
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const embedUrl = `${baseUrl}/embed`;

    const iframeSnippet = `<!-- Natural Language Database Query Chatbot -->
<iframe 
  src="${embedUrl}"
  width="800"
  height="900"
  frameborder="0"
  style="border: 1px solid #e5e7eb; border-radius: 8px;"
  allow="clipboard-write"
></iframe>`;

    const jsSnippet = `<!-- Natural Language Database Query Chatbot -->
<div id="nlq-chatbot"></div>
<script>
  (function() {
    var iframe = document.createElement('iframe');
    iframe.src = '${embedUrl}';
    iframe.width = '800';
    iframe.height = '900';
    iframe.frameBorder = '0';
    iframe.style.border = '1px solid #e5e7eb';
    iframe.style.borderRadius = '8px';
    iframe.allow = 'clipboard-write';
    
    document.getElementById('nlq-chatbot').appendChild(iframe);
  })();
</script>`;

    res.json({
      embedUrl,
      iframeSnippet,
      jsSnippet,
      options: {
        width: "Customize width (e.g., 800, 100%)",
        height: "Customize height (e.g., 900, 100vh)",
        theme: "Auto-detects light/dark mode",
      },
    });
  });


  // ═══════════════════════════════════════════════════════════════
  // EXCEL EXPORT - Download all project data as Excel file
  // ═══════════════════════════════════════════════════════════════
  app.get("/api/export/projects", isAuthenticated, async (req, res) => {
    try {
      console.log('[Export] Starting project data export...');
      
      // Use MS SQL via queryExternalDb (table name is auto-replaced)
      const rows = await queryExternalDb('SELECT * FROM "POR"', []);
      
      console.log(`[Export] Found ${rows.length} projects`);

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Projects');

      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `projects_export_${timestamp}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      
      res.send(buffer);
      console.log(`[Export] ✅ Export complete: ${rows.length} projects, ${buffer.length} bytes`);

    } catch (error: any) {
      console.error('[Export] ❌ Export failed:', error);
      res.status(500).json({
        success: false,
        error: 'Export failed',
        details: error.message
      });
    }
  });

  // DEBUG: Test regions filter SQL
  app.get("/api/debug/test-regions", async (req, res) => {
    try {
      const regions = ["NA - West", "West"];
      
      // Build the region conditions like buildAdditionalFilters does (1-indexed)
      const regionConditions = regions.map((r, idx) => `"Region" LIKE @p${idx + 1}`);
      const whereClause = `(${regionConditions.join(' OR ')})`;
      
      const sql = `
        SELECT TOP 5 "Title", "Fee", "Region"
        FROM "POR"
        WHERE "Fee" IS NOT NULL AND "Fee" != ''
          AND ${whereClause}
        ORDER BY CAST("Fee" AS NUMERIC) DESC
      `;
      
      const params = regions.map(r => `%${r}%`);
      
      console.log('[DEBUG] Test regions SQL:', sql);
      console.log('[DEBUG] Test regions params:', params);
      
      const rows = await queryExternalDb(sql, params);
      
      res.json({
        success: true,
        sql,
        params,
        row_count: rows.length,
        sample: rows.slice(0, 5)
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // DEBUG: Trace query flow for region queries
  app.get("/api/debug/trace-query", async (req, res) => {
    try {
      const question = req.query.q as string || "top 5 projects in west region";
      const engine = await getQueryEngine();
      
      // Wrap the query with tracing
      const result = await engine.processQuery(question, queryExternalDb, undefined, undefined);
      
      res.json({
        question,
        function_name: result.function_name,
        arguments: result.arguments,
        row_count: result.row_count,
        sql_query: result.sql_query,
        sql_params: result.sql_params,
        data_sample: result.data?.slice(0, 3)
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // DEBUG: Direct test of executeQuery with regions
  app.get("/api/debug/test-execute-regions", async (req, res) => {
    try {
      const engine = await getQueryEngine();
      
      // Test 1: Simple query without regions - should work
      const testQuestion1 = "show me 5 largest projects";
      const result1 = await engine.processQuery(testQuestion1, queryExternalDb, undefined, undefined);
      
      // Test 2: Region query - this is failing
      const testQuestion2 = "top 5 projects in west region";
      const result2 = await engine.processQuery(testQuestion2, queryExternalDb, undefined, undefined);
      
      // Check what args.regions looks like in result2
      res.json({
        test_without_regions: {
          question: testQuestion1,
          function_name: result1.function_name,
          row_count: result1.row_count,
          has_sql_query: !!result1.sql_query,
          arguments_keys: Object.keys(result1.arguments || {})
        },
        test_with_regions: {
          question: testQuestion2,
          function_name: result2.function_name,
          row_count: result2.row_count,
          has_sql_query: !!result2.sql_query,
          sql_query: result2.sql_query?.substring(0, 200),
          arguments: result2.arguments,
          data_type: result2.data?.[0]?.type
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
        stack: error.stack
      });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // EMBED LINKS API (Domain-Restricted Iframe Embedding)
  // ═══════════════════════════════════════════════════════════════

  // List all embed links (superadmin only)
  app.get("/api/embed-links", isAuthenticated, async (req, res) => {
    try {
      const role = await getUserRole(req);
      if (role !== 'superadmin') {
        return res.status(403).json({ error: "Superadmin access required" });
      }
      const links = await mssqlStorage.listEmbedLinks();
      res.json(links);
    } catch (error: any) {
      console.error("Error listing embed links:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create new embed link (superadmin only)
  app.post("/api/embed-links", isAuthenticated, async (req, res) => {
    try {
      const role = await getUserRole(req);
      if (role !== 'superadmin') {
        return res.status(403).json({ error: "Superadmin access required" });
      }

      const validation = insertEmbedLinkSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: validation.error.errors[0].message });
      }

      const { role: linkRole, allowed_domain, name } = validation.data;
      const userId = getUserId(req) || "unknown";
      const userEmail = getUserEmail(req) || "unknown";

      // Generate unique embed ID
      const embedId = nanoid(16);

      const link = await mssqlStorage.createEmbedLink({
        embed_id: embedId,
        role: linkRole,
        allowed_domain: allowed_domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, ''),
        name,
        created_by: userId,
        created_by_email: userEmail,
      });

      res.json(link);
    } catch (error: any) {
      console.error("Error creating embed link:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete embed link (superadmin only)
  app.delete("/api/embed-links/:id", isAuthenticated, async (req, res) => {
    try {
      const role = await getUserRole(req);
      if (role !== 'superadmin') {
        return res.status(403).json({ error: "Superadmin access required" });
      }

      await mssqlStorage.deleteEmbedLink(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting embed link:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Toggle embed link active status (superadmin only)
  app.patch("/api/embed-links/:id/toggle", isAuthenticated, async (req, res) => {
    try {
      const role = await getUserRole(req);
      if (role !== 'superadmin') {
        return res.status(403).json({ error: "Superadmin access required" });
      }

      const { is_active } = req.body;
      if (typeof is_active !== 'boolean') {
        return res.status(400).json({ error: "is_active must be a boolean" });
      }

      await mssqlStorage.toggleEmbedLinkActive(req.params.id, is_active);
      res.json({ success: true, is_active });
    } catch (error: any) {
      console.error("Error toggling embed link:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Helper to generate a simple token
  function generateEmbedToken(): string {
    return `emb_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  // Create embed session (public - creates a session for embed users)
  // Supports JWT token for user identification (optional)
  app.post("/api/embed/session", async (req, res) => {
    try {
      const { embedId, parentOrigin, jwtToken } = req.body;
      
      if (!embedId) {
        return res.status(400).json({ error: "Embed ID required" });
      }

      const link = await mssqlStorage.getEmbedLinkByEmbedId(embedId);
      
      if (!link) {
        return res.status(404).json({ error: "Embed link not found" });
      }

      // Use parentOrigin from request body (sent by client detecting iframe parent)
      const requestDomain = (parentOrigin || '').toLowerCase();
      const allowedDomain = link.allowed_domain.toLowerCase();
      
      // Check domain restriction (same logic as validate endpoint)
      const isWildcard = allowedDomain === '*';
      const isDevelopment = process.env.NODE_ENV === 'development';
      const isDirectAccess = !parentOrigin; // Not in an iframe
      const exactMatch = requestDomain === allowedDomain;
      const subdomainMatch = requestDomain.endsWith(`.${allowedDomain}`);
      
      const isAllowed = isWildcard || isDevelopment || isDirectAccess || exactMatch || subdomainMatch;

      if (!isAllowed) {
        return res.status(403).json({ error: "Domain not authorized" });
      }

      // ═══════════════════════════════════════════════════════════════
      // JWT TOKEN EXTRACTION (REQUIRED)
      // ═══════════════════════════════════════════════════════════════
      // Client MUST pass JWT token via iframe URL for user identification
      // This enables consistent user ID across browsers/devices
      // JWT provides: username, role (mapped), tenant
      // NO FALLBACK: JWT is required for embed users
      
      if (!jwtToken) {
        return res.status(401).json({ 
          error: "JWT token is required",
          message: "Please provide a valid JWT token via URL parameter (token, jwt, or auth)"
        });
      }
      
      const jwtResult = decodeAndExtractJWT(jwtToken);
      
      if (!jwtResult.success || !jwtResult.data) {
        return res.status(401).json({ 
          error: "Invalid JWT token",
          message: jwtResult.error || "Failed to decode JWT token"
        });
      }
      
      // Check if token is expired
      if (jwtResult.data.isExpired) {
        return res.status(401).json({ error: "JWT token has expired" });
      }
      
      const jwtData = {
        username: jwtResult.data.username,
        clientRole: jwtResult.data.clientRole,  // Original role from JWT
        mappedRole: jwtResult.data.mappedRole,
        tenant: jwtResult.data.tenant,
        uniqueUserId: jwtResult.data.uniqueUserId,
      };
      console.log(`[JWT] Extracted user: ${jwtData.uniqueUserId}, clientRole: "${jwtData.clientRole}" -> mappedRole: "${jwtData.mappedRole}", tenant: ${jwtData.tenant}`);
      console.log(`[JWT] Raw payload keys:`, Object.keys(jwtResult.data.rawPayload));
      console.log(`[JWT] Raw payload:`, JSON.stringify(jwtResult.data.rawPayload, null, 2));

      // ═══════════════════════════════════════════════════════════════
      // ═══════════════════════════════════════════════════════════════
      // JWT-BASED SESSION MANAGEMENT
      // ═══════════════════════════════════════════════════════════════
      // JWT provides consistent user ID across browsers/devices
      // Same user = same session = same chat history (regardless of browser)
      // Main site login is NOT affected by embed usage
      
      const sessionUserId = `jwt_${jwtData.uniqueUserId}`;
      const effectiveRole = jwtData.mappedRole;
      // Use username as-is if it's already an email, otherwise construct email
      const userEmail = jwtData.username 
        ? (jwtData.username.includes('@') 
            ? jwtData.username  // Already an email, use as-is
            : `${jwtData.username}@${jwtData.tenant || link.allowed_domain}`)
        : `embed@${link.allowed_domain}`;
      
      // Track embed session in browser session (for debugging/analytics)
      if (req.session) {
        if (!(req.session as any).embedSessions) {
          (req.session as any).embedSessions = {};
        }
        const sessionKey = `jwt_${jwtData.uniqueUserId}`;
        (req.session as any).embedSessions[sessionKey] = {
          userId: sessionUserId,
          userEmail,
          role: effectiveRole,
          jwtUsername: jwtData.username,
          jwtTenant: jwtData.tenant,
        };
        (req.session as any).lastEmbedId = embedId;
      }

      // Generate a token for embed authentication (works without cookies)
      const token = generateEmbedToken();
      embedTokenStore.set(token, {
        embedId,
        role: effectiveRole,
        domain: link.allowed_domain,
        userId: sessionUserId,
        userEmail,
        createdAt: Date.now(),
        jwtUsername: jwtData.username,
        jwtTenant: jwtData.tenant,
      });
      
      // Clean up old tokens (older than 24 hours)
      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
      embedTokenStore.forEach((value, key) => {
        if (value.createdAt < dayAgo) {
          embedTokenStore.delete(key);
        }
      });
      
      // Generate or retrieve display ID (e.g., admin_k7m2x9)
      // Scoped by embed link ID for security isolation
      const { displayId, isNew: isNewDisplayId } = await mssqlStorage.getOrCreateEmbedUserId(sessionUserId, effectiveRole, embedId);
      
      res.json({ 
        success: true, 
        token, // Return the token for client to use
        sessionId: sessionUserId,
        displayId, // User-friendly ID for display and recovery
        role: effectiveRole,  // Role from JWT (mapped)
        clientRole: jwtData.clientRole,  // Original role from JWT (for debugging)
        isNewSession: isNewDisplayId, // New display ID = new session
        // JWT-extracted data
        jwtUsername: jwtData.username,
        jwtTenant: jwtData.tenant,
        jwtRoleExtracted: true,
      });
    } catch (error: any) {
      console.error("Error creating embed session:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Validate embed link (public - called by embed page)
  // Changed to POST to receive parentOrigin from client
  app.post("/api/embed/validate/:embedId", async (req, res) => {
    try {
      const { embedId } = req.params;
      const { parentOrigin } = req.body || {};
      
      const link = await mssqlStorage.getEmbedLinkByEmbedId(embedId);
      
      if (!link) {
        return res.status(404).json({ valid: false, error: "Embed link not found or inactive" });
      }

      // Use parentOrigin from request body (sent by client detecting iframe parent)
      const requestDomain = (parentOrigin || '').toLowerCase();
      const allowedDomain = link.allowed_domain.toLowerCase();
      
      // Check domain restriction
      // Allow if:
      // 1. Wildcard domain (*)
      // 2. Exact domain match
      // 3. Subdomain match (request is subdomain of allowed)
      // 4. No parent origin (direct access, not in iframe) - embed ID acts as token
      // 5. Development mode
      const isWildcard = allowedDomain === '*';
      const isDevelopment = process.env.NODE_ENV === 'development';
      const isDirectAccess = !parentOrigin; // Not in an iframe
      const exactMatch = requestDomain === allowedDomain;
      const subdomainMatch = requestDomain.endsWith(`.${allowedDomain}`);
      
      const isAllowed = isWildcard || isDevelopment || isDirectAccess || exactMatch || subdomainMatch;

      if (!isAllowed) {
        console.log(`[Embed] Domain mismatch: ${requestDomain} vs allowed ${allowedDomain}`);
        return res.status(403).json({ 
          valid: false, 
          error: "Domain not authorized for this embed link" 
        });
      }

      // Update last used timestamp
      await mssqlStorage.updateEmbedLinkLastUsed(embedId);

      res.json({
        valid: true,
        role: link.role,
        name: link.name,
      });
    } catch (error: any) {
      console.error("Error validating embed link:", error);
      res.status(500).json({ valid: false, error: error.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // EMBED USER ID RECOVERY
  // ═══════════════════════════════════════════════════════════════

  // Recover embed session using display ID
  // SECURITY: Requires valid embed token and scopes recovery to same embed link
  app.post("/api/embed/recover", async (req, res) => {
    try {
      // Validate embed token for authentication
      const embedToken = req.headers['x-embed-token'] as string;
      if (!embedToken) {
        return res.status(401).json({ success: false, error: "Authentication required" });
      }

      const tokenData = embedTokenStore.get(embedToken);
      if (!tokenData) {
        return res.status(401).json({ success: false, error: "Invalid or expired token" });
      }

      const { displayId } = req.body;
      
      if (!displayId) {
        return res.status(400).json({ 
          success: false, 
          error: "Missing required field: displayId" 
        });
      }

      // Use embedId from token (not from request body) for security
      const embedId = tokenData.embedId;
      
      // SECURITY: Derive currentSessionId from server-side session, not from client
      let currentSessionId: string | null = null;
      if (req.session && (req.session as any).embedSessions) {
        const embedSessions = (req.session as any).embedSessions;
        if (embedSessions[embedId]) {
          currentSessionId = embedSessions[embedId].userId;
        }
      }
      
      if (!currentSessionId) {
        return res.status(400).json({ 
          success: false, 
          error: "No active session found. Please refresh the page and try again." 
        });
      }

      // Validate embed link exists
      const link = await mssqlStorage.getEmbedLinkByEmbedId(embedId);
      if (!link) {
        return res.status(404).json({ success: false, error: "Embed link not found" });
      }

      // Look up the old user by display ID (scoped to this embed link)
      const oldUser = await mssqlStorage.getEmbedUserByDisplayId(displayId, embedId);
      if (!oldUser) {
        return res.status(404).json({ 
          success: false, 
          error: "ID not found. Please check and try again." 
        });
      }

      // Verify role consistency - prevent role escalation
      if (oldUser.role !== tokenData.role) {
        return res.status(403).json({ 
          success: false, 
          error: "Cannot recover session with different role" 
        });
      }

      // SHARED SESSION: Join the existing session instead of merging data
      // This allows multiple browsers (Chrome, Firefox, incognito) to share the same session
      const joinResult = await mssqlStorage.joinExistingSession(displayId, embedId);
      
      if (!joinResult.success || !joinResult.originalInternalUserId) {
        return res.status(500).json({ success: false, error: "Failed to join session" });
      }

      const originalInternalUserId = joinResult.originalInternalUserId;

      // Update the embed token to use the original internal user ID
      // This makes both browsers point to the same session
      tokenData.userId = originalInternalUserId;
      embedTokenStore.set(embedToken, tokenData);

      // Update session in memory to use the original internal user ID
      if (req.session && (req.session as any).embedSessions) {
        const embedSessions = (req.session as any).embedSessions;
        if (embedSessions[embedId]) {
          embedSessions[embedId].userId = originalInternalUserId;
        }
      }

      res.json({ 
        success: true, 
        message: "Session joined successfully. You are now sharing the same session across browsers.",
        displayId: displayId,
        internalUserId: originalInternalUserId,
      });
    } catch (error: any) {
      console.error("Error recovering embed session:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Get current embed user's display ID
  app.get("/api/embed/user-id", async (req, res) => {
    try {
      const embedToken = req.headers['x-embed-token'] as string;
      if (!embedToken) {
        return res.status(401).json({ error: "No embed token provided" });
      }

      const tokenData = embedTokenStore.get(embedToken);
      if (!tokenData) {
        return res.status(401).json({ error: "Invalid embed token" });
      }

      // Get the session user ID from the embed sessions map
      let internalUserId = `embed_${tokenData.embedId}`;
      
      if (req.session && (req.session as any).embedSessions) {
        const embedSessions = (req.session as any).embedSessions;
        if (embedSessions[tokenData.embedId]) {
          internalUserId = embedSessions[tokenData.embedId].userId;
        }
      }

      // Get or create display ID (scoped to embed link)
      const { displayId } = await mssqlStorage.getOrCreateEmbedUserId(internalUserId, tokenData.role, tokenData.embedId);

      res.json({ 
        displayId,
        role: tokenData.role,
      });
    } catch (error: any) {
      console.error("Error getting embed user ID:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Debug endpoint to see all embed users for an embed link
  app.get("/api/embed/debug-users/:embedId", async (req, res) => {
    try {
      const embedId = req.params.embedId;
      const users = await mssqlStorage.debugGetAllEmbedUsers(embedId);
      res.json({ embedId, users, count: users.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update embed user's display ID
  app.post("/api/embed/update-display-id", async (req, res) => {
    try {
      const { embedId, token, newDisplayId, currentDisplayId } = req.body;
      
      console.log('[update-display-id] Request:', { embedId, currentDisplayId, newDisplayId, hasToken: !!token });
      
      if (!embedId || !token || !newDisplayId || !currentDisplayId) {
        return res.status(400).json({ success: false, error: "Missing required fields" });
      }

      // Validate token
      const tokenData = embedTokenStore.get(token);
      if (!tokenData || tokenData.embedId !== embedId) {
        return res.status(401).json({ success: false, error: "Invalid token" });
      }

      // Get current session's internal user ID to keep record linked
      let currentInternalUserId: string | undefined;
      if (req.session && (req.session as any).embedSessions) {
        const embedSessions = (req.session as any).embedSessions;
        if (embedSessions[embedId]) {
          currentInternalUserId = embedSessions[embedId].userId;
        }
      }
      
      console.log('[update-display-id] Current internal user ID:', currentInternalUserId);

      // Update the display ID AND link to current session's internal user ID
      const success = await mssqlStorage.updateEmbedUserDisplayId(
        currentDisplayId.trim(), 
        newDisplayId.trim(), 
        embedId,
        currentInternalUserId
      );
      
      console.log('[update-display-id] Update result:', success);
      
      if (!success) {
        return res.status(400).json({ success: false, error: "ID already taken or current ID not found" });
      }

      res.json({ success: true, displayId: newDisplayId.trim() });
    } catch (error: any) {
      console.error("Error updating display ID:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return app;
}
