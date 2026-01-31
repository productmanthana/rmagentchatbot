/**
 * MS SQL Server Storage Implementation
 * Replaces Drizzle ORM storage when using MS SQL for app data
 */

import { getAppPool, queryAppDb } from './mssql-app-db';
import type { Chat, Message, InsertChat, InsertMessage, User, UpsertUser, UpdateMessageFAQ, FAQSampleQuestion, ErrorLog, InsertErrorLog, UpdateErrorLog, EmbedLink, InsertEmbedLink } from '@shared/schema';

// Helper to generate UUID
function generateId(): string {
  return crypto.randomUUID();
}

/**
 * MS SQL Storage class - replaces Drizzle-based ChatStorage
 */
export class MssqlStorage {
  private ensurePool() {
    const pool = getAppPool();
    if (!pool) {
      throw new Error('MS SQL app database not connected');
    }
    return pool;
  }

  // ═══════════════════════════════════════════════════════════════
  // CHAT OPERATIONS
  // ═══════════════════════════════════════════════════════════════

  async listChats(sessionId: string): Promise<Chat[]> {
    const pool = this.ensurePool();
    const result = await pool.request()
      .input('sessionId', sessionId)
      .query(`
        SELECT id, session_id, title, created_at, updated_at, faq_category
        FROM chats
        WHERE session_id = @sessionId
        ORDER BY updated_at DESC
      `);
    return result.recordset.map(this.mapChat);
  }

  async getChat(chatId: string): Promise<Chat | undefined> {
    const pool = this.ensurePool();
    const result = await pool.request()
      .input('chatId', chatId)
      .query(`
        SELECT TOP 1 id, session_id, title, created_at, updated_at, faq_category
        FROM chats
        WHERE id = @chatId
      `);
    return result.recordset[0] ? this.mapChat(result.recordset[0]) : undefined;
  }

  async createChat(chat: InsertChat): Promise<Chat> {
    const pool = this.ensurePool();
    const now = new Date();
    await pool.request()
      .input('id', chat.id)
      .input('session_id', chat.session_id)
      .input('title', chat.title)
      .input('faq_category', chat.faq_category || null)
      .input('created_at', now)
      .input('updated_at', now)
      .query(`
        INSERT INTO chats (id, session_id, title, faq_category, created_at, updated_at)
        VALUES (@id, @session_id, @title, @faq_category, @created_at, @updated_at)
      `);
    
    return {
      id: chat.id,
      session_id: chat.session_id,
      title: chat.title,
      faq_category: chat.faq_category || null,
      created_at: now,
      updated_at: now,
    };
  }

  async updateChatTitle(chatId: string, title: string): Promise<Chat | undefined> {
    const pool = this.ensurePool();
    const now = new Date();
    await pool.request()
      .input('chatId', chatId)
      .input('title', title)
      .input('updated_at', now)
      .query(`
        UPDATE chats
        SET title = @title, updated_at = @updated_at
        WHERE id = @chatId
      `);
    
    return this.getChat(chatId);
  }

  async deleteChat(chatId: string): Promise<void> {
    const pool = this.ensurePool();
    // Delete messages first
    await pool.request()
      .input('chatId', chatId)
      .query('DELETE FROM messages WHERE chat_id = @chatId');
    // Then delete chat
    await pool.request()
      .input('chatId', chatId)
      .query('DELETE FROM chats WHERE id = @chatId');
  }

  // ═══════════════════════════════════════════════════════════════
  // MESSAGE OPERATIONS
  // ═══════════════════════════════════════════════════════════════

  async listMessages(chatId: string): Promise<Message[]> {
    const pool = this.ensurePool();
    const result = await pool.request()
      .input('chatId', chatId)
      .query(`
        SELECT id, chat_id, type, content, timestamp, response, ai_analysis_messages, is_faq, faq_category, faq_display_text
        FROM messages
        WHERE chat_id = @chatId
        ORDER BY timestamp ASC
      `);
    return result.recordset.map(this.mapMessage);
  }

  async getMessageById(chatId: string, messageId: string): Promise<Message | null> {
    const pool = this.ensurePool();
    const result = await pool.request()
      .input('chatId', chatId)
      .input('messageId', messageId)
      .query(`
        SELECT TOP 1 id, chat_id, type, content, timestamp, response, ai_analysis_messages, is_faq, faq_category, faq_display_text
        FROM messages
        WHERE id = @messageId AND chat_id = @chatId
      `);
    return result.recordset[0] ? this.mapMessage(result.recordset[0]) : null;
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const pool = this.ensurePool();
    const now = new Date();
    await pool.request()
      .input('id', message.id)
      .input('chat_id', message.chat_id)
      .input('type', message.type)
      .input('content', message.content)
      .input('timestamp', now)
      .input('response', message.response ? JSON.stringify(message.response) : null)
      .input('ai_analysis_messages', message.ai_analysis_messages ? JSON.stringify(message.ai_analysis_messages) : null)
      .input('is_faq', message.is_faq || false)
      .input('faq_category', message.faq_category || null)
      .input('faq_display_text', message.faq_display_text || null)
      .input('user_id', message.user_id || null)
      .query(`
        INSERT INTO messages (id, chat_id, type, content, timestamp, response, ai_analysis_messages, is_faq, faq_category, faq_display_text, user_id)
        VALUES (@id, @chat_id, @type, @content, @timestamp, @response, @ai_analysis_messages, @is_faq, @faq_category, @faq_display_text, @user_id)
      `);

    // Update chat's updated_at
    await pool.request()
      .input('chatId', message.chat_id)
      .input('updated_at', now)
      .query('UPDATE chats SET updated_at = @updated_at WHERE id = @chatId');

    return {
      id: message.id,
      chat_id: message.chat_id,
      type: message.type,
      content: message.content,
      timestamp: now,
      response: message.response || null,
      ai_analysis_messages: message.ai_analysis_messages || null,
      is_faq: message.is_faq || false,
      faq_category: message.faq_category || null,
      faq_display_text: message.faq_display_text || null,
      user_id: message.user_id || null,
    };
  }

  async updateMessageAIAnalysis(chatId: string, messageId: string, aiAnalysisMessages: any[]): Promise<Message> {
    const pool = this.ensurePool();
    const now = new Date();
    await pool.request()
      .input('messageId', messageId)
      .input('chatId', chatId)
      .input('ai_analysis_messages', JSON.stringify(aiAnalysisMessages))
      .query(`
        UPDATE messages
        SET ai_analysis_messages = @ai_analysis_messages
        WHERE id = @messageId AND chat_id = @chatId
      `);

    await pool.request()
      .input('chatId', chatId)
      .input('updated_at', now)
      .query('UPDATE chats SET updated_at = @updated_at WHERE id = @chatId');

    const msg = await this.getMessageById(chatId, messageId);
    if (!msg) throw new Error('Message not found');
    return msg;
  }

  async deleteMessage(messageId: string): Promise<void> {
    const pool = this.ensurePool();
    await pool.request()
      .input('messageId', messageId)
      .query('DELETE FROM messages WHERE id = @messageId');
  }

  async updateMessageFAQ(chatId: string, messageId: string, update: UpdateMessageFAQ, userId?: string): Promise<Message> {
    const pool = this.ensurePool();
    await pool.request()
      .input('messageId', messageId)
      .input('chatId', chatId)
      .input('is_faq', update.is_faq)
      .input('faq_category', update.faq_category || null)
      .input('faq_display_text', update.faq_display_text || null)
      .input('user_id', update.is_faq ? (userId || null) : null)
      .query(`
        UPDATE messages
        SET is_faq = @is_faq, faq_category = @faq_category, faq_display_text = @faq_display_text, user_id = @user_id
        WHERE id = @messageId AND chat_id = @chatId
      `);

    const msg = await this.getMessageById(chatId, messageId);
    if (!msg) throw new Error('Message not found');
    return msg;
  }

  async getFirstUserMessage(chatId: string): Promise<Message | null> {
    const pool = this.ensurePool();
    const result = await pool.request()
      .input('chatId', chatId)
      .query(`
        SELECT TOP 1 id, chat_id, type, content, timestamp, response, ai_analysis_messages, is_faq, faq_category, faq_display_text, user_id
        FROM messages
        WHERE chat_id = @chatId AND type = 'user'
        ORDER BY timestamp ASC
      `);
    return result.recordset[0] ? this.mapMessage(result.recordset[0]) : null;
  }

  // ═══════════════════════════════════════════════════════════════
  // FAQ OPERATIONS
  // ═══════════════════════════════════════════════════════════════

  async getFAQMessages(userId?: string): Promise<FAQSampleQuestion[]> {
    const pool = this.ensurePool();
    
    // If userId is provided, only return FAQs created by that user
    // Otherwise return all FAQs (for backward compatibility/admin use)
    let result;
    if (userId) {
      result = await pool.request()
        .input('userId', userId)
        .query(`
          SELECT id, chat_id, content, faq_category, faq_display_text, user_id
          FROM messages
          WHERE is_faq = 1 AND type = 'user' AND user_id = @userId
          ORDER BY timestamp DESC
        `);
    } else {
      result = await pool.request()
        .query(`
          SELECT id, chat_id, content, faq_category, faq_display_text, user_id
          FROM messages
          WHERE is_faq = 1 AND type = 'user'
          ORDER BY timestamp DESC
        `);
    }
    
    return result.recordset.map(row => ({
      id: row.id,
      chatId: row.chat_id,
      question: row.content,
      category: row.faq_category || 'General',
      displayText: row.faq_display_text || undefined,
      userId: row.user_id,
    }));
  }

  async removeFAQStatus(messageId: string): Promise<void> {
    const pool = this.ensurePool();
    await pool.request()
      .input('messageId', messageId)
      .query(`
        UPDATE messages
        SET is_faq = 0, faq_category = NULL, faq_display_text = NULL
        WHERE id = @messageId
      `);
  }

  // ═══════════════════════════════════════════════════════════════
  // USER OPERATIONS
  // ═══════════════════════════════════════════════════════════════

  async getUserByEmail(email: string): Promise<User | null> {
    const pool = this.ensurePool();
    const result = await pool.request()
      .input('email', email)
      .query(`
        SELECT TOP 1 id, email, password_hash as passwordHash, first_name as firstName, last_name as lastName, 
               profile_image_url as profileImageUrl, role, created_at as createdAt, updated_at as updatedAt
        FROM users
        WHERE email = @email
      `);
    return result.recordset[0] || null;
  }

  async getUserById(id: string): Promise<User | null> {
    const pool = this.ensurePool();
    const result = await pool.request()
      .input('id', id)
      .query(`
        SELECT TOP 1 id, email, password_hash as passwordHash, first_name as firstName, last_name as lastName,
               profile_image_url as profileImageUrl, role, created_at as createdAt, updated_at as updatedAt
        FROM users
        WHERE id = @id
      `);
    return result.recordset[0] || null;
  }

  async createUser(user: UpsertUser): Promise<User> {
    const pool = this.ensurePool();
    const id = user.id || generateId();
    const now = new Date();
    await pool.request()
      .input('id', id)
      .input('email', user.email)
      .input('passwordHash', user.passwordHash)
      .input('firstName', user.firstName || null)
      .input('lastName', user.lastName || null)
      .input('profileImageUrl', user.profileImageUrl || null)
      .input('role', user.role || 'user')
      .input('createdAt', now)
      .input('updatedAt', now)
      .query(`
        INSERT INTO users (id, email, password_hash, first_name, last_name, profile_image_url, role, created_at, updated_at)
        VALUES (@id, @email, @passwordHash, @firstName, @lastName, @profileImageUrl, @role, @createdAt, @updatedAt)
      `);

    return {
      id,
      email: user.email,
      passwordHash: user.passwordHash,
      firstName: user.firstName || null,
      lastName: user.lastName || null,
      profileImageUrl: user.profileImageUrl || null,
      role: user.role || 'user',
      createdAt: now,
      updatedAt: now,
    };
  }

  async updateUserRole(email: string, role: string): Promise<void> {
    const pool = this.ensurePool();
    await pool.request()
      .input('email', email)
      .input('role', role)
      .input('updatedAt', new Date())
      .query(`
        UPDATE users SET role = @role, updated_at = @updatedAt WHERE email = @email
      `);
  }

  // ═══════════════════════════════════════════════════════════════
  // ERROR LOG OPERATIONS
  // ═══════════════════════════════════════════════════════════════

  async createErrorLog(log: InsertErrorLog): Promise<ErrorLog> {
    const pool = this.ensurePool();
    const now = new Date();
    await pool.request()
      .input('id', log.id)
      .input('session_id', log.session_id)
      .input('user_id', log.user_id || null)
      .input('user_email', log.user_email || null)
      .input('chat_id', log.chat_id)
      .input('message_id', log.message_id || null)
      .input('question', log.question)
      .input('error_message', log.error_message || null)
      .input('user_comment', log.user_comment)
      .input('status', log.status || 'pending')
      .input('screenshot_filename', log.screenshot_filename || null)
      .input('screenshot_url', log.screenshot_url || null)
      .input('created_at', now)
      .query(`
        INSERT INTO error_logs (id, session_id, user_id, user_email, chat_id, message_id, question, error_message, user_comment, status, screenshot_filename, screenshot_url, created_at)
        VALUES (@id, @session_id, @user_id, @user_email, @chat_id, @message_id, @question, @error_message, @user_comment, @status, @screenshot_filename, @screenshot_url, @created_at)
      `);

    return {
      id: log.id,
      session_id: log.session_id,
      user_id: log.user_id || null,
      user_email: log.user_email || null,
      chat_id: log.chat_id,
      message_id: log.message_id || null,
      question: log.question,
      error_message: log.error_message || null,
      user_comment: log.user_comment,
      developer_comment: null,
      status: log.status || 'pending',
      screenshot_filename: log.screenshot_filename || null,
      screenshot_url: log.screenshot_url || null,
      created_at: now,
    };
  }

  async getErrorLogs(userEmail?: string): Promise<ErrorLog[]> {
    const pool = this.ensurePool();
    let query = `
      SELECT id, session_id, user_id, user_email, chat_id, message_id, question, error_message, user_comment, developer_comment, status, screenshot_filename, screenshot_url, created_at
      FROM error_logs
    `;
    
    const request = pool.request();
    if (userEmail) {
      query += ' WHERE user_email = @userEmail';
      request.input('userEmail', userEmail);
    }
    query += ' ORDER BY created_at DESC';
    
    const result = await request.query(query);
    return result.recordset;
  }

  async updateErrorLog(id: string, update: UpdateErrorLog): Promise<ErrorLog | null> {
    const pool = this.ensurePool();
    const setClauses: string[] = [];
    const request = pool.request().input('id', id);

    if (update.developer_comment !== undefined) {
      setClauses.push('developer_comment = @developer_comment');
      request.input('developer_comment', update.developer_comment);
    }
    if (update.status !== undefined) {
      setClauses.push('status = @status');
      request.input('status', update.status);
    }

    if (setClauses.length === 0) return null;

    await request.query(`
      UPDATE error_logs SET ${setClauses.join(', ')} WHERE id = @id
    `);

    const result = await pool.request()
      .input('id', id)
      .query('SELECT * FROM error_logs WHERE id = @id');
    
    return result.recordset[0] || null;
  }

  async deleteErrorLog(id: string): Promise<void> {
    const pool = this.ensurePool();
    await pool.request()
      .input('id', id)
      .query('DELETE FROM error_logs WHERE id = @id');
  }

  async listErrorLogs(): Promise<ErrorLog[]> {
    const pool = this.ensurePool();
    const result = await pool.request().query(`
      SELECT id, session_id, user_id, user_email, chat_id, message_id, question, error_message, user_comment, developer_comment, status, screenshot_filename, screenshot_url, created_at
      FROM error_logs
      ORDER BY created_at DESC
    `);
    return result.recordset;
  }

  async listErrorLogsByChat(chatId: string): Promise<ErrorLog[]> {
    const pool = this.ensurePool();
    const result = await pool.request()
      .input('chatId', chatId)
      .query(`
        SELECT id, session_id, user_id, user_email, chat_id, message_id, question, error_message, user_comment, developer_comment, status, screenshot_filename, screenshot_url, created_at
        FROM error_logs
        WHERE chat_id = @chatId
        ORDER BY created_at DESC
      `);
    return result.recordset;
  }

  async listErrorLogsByUser(userId: string): Promise<ErrorLog[]> {
    const pool = this.ensurePool();
    const result = await pool.request()
      .input('userId', userId)
      .query(`
        SELECT id, session_id, user_id, user_email, chat_id, message_id, question, error_message, user_comment, developer_comment, status, screenshot_filename, screenshot_url, created_at
        FROM error_logs
        WHERE user_id = @userId
        ORDER BY created_at DESC
      `);
    return result.recordset;
  }

  async updateErrorLogScreenshot(id: string, screenshotFilename: string, screenshotUrl: string): Promise<ErrorLog | null> {
    const pool = this.ensurePool();
    await pool.request()
      .input('id', id)
      .input('screenshotFilename', screenshotFilename)
      .input('screenshotUrl', screenshotUrl)
      .query(`
        UPDATE error_logs 
        SET screenshot_filename = @screenshotFilename, screenshot_url = @screenshotUrl 
        WHERE id = @id
      `);

    const result = await pool.request()
      .input('id', id)
      .query('SELECT * FROM error_logs WHERE id = @id');
    
    return result.recordset[0] || null;
  }

  // ═══════════════════════════════════════════════════════════════
  // USER HIDDEN FAQS OPERATIONS
  // ═══════════════════════════════════════════════════════════════

  async getHiddenFAQs(userId: string): Promise<string[]> {
    const pool = this.ensurePool();
    const result = await pool.request()
      .input('userId', userId)
      .query(`
        SELECT faq_text FROM user_hidden_faqs WHERE user_id = @userId
      `);
    return result.recordset.map(row => row.faq_text);
  }

  async addHiddenFAQ(userId: string, faqText: string): Promise<void> {
    const pool = this.ensurePool();
    // Check if already hidden
    const existing = await pool.request()
      .input('userId', userId)
      .input('faqText', faqText)
      .query(`
        SELECT TOP 1 id FROM user_hidden_faqs WHERE user_id = @userId AND faq_text = @faqText
      `);
    
    if (existing.recordset.length === 0) {
      await pool.request()
        .input('userId', userId)
        .input('faqText', faqText)
        .query(`
          INSERT INTO user_hidden_faqs (user_id, faq_text) VALUES (@userId, @faqText)
        `);
    }
  }

  async removeHiddenFAQ(userId: string, faqText: string): Promise<void> {
    const pool = this.ensurePool();
    await pool.request()
      .input('userId', userId)
      .input('faqText', faqText)
      .query(`
        DELETE FROM user_hidden_faqs WHERE user_id = @userId AND faq_text = @faqText
      `);
  }

  async clearHiddenFAQs(userId: string): Promise<void> {
    const pool = this.ensurePool();
    await pool.request()
      .input('userId', userId)
      .query(`
        DELETE FROM user_hidden_faqs WHERE user_id = @userId
      `);
  }

  // ═══════════════════════════════════════════════════════════════
  // ACTIVITY LOGS (Stub - not used in MS SQL implementation)
  // ═══════════════════════════════════════════════════════════════

  async createActivityLog(log: { user_id?: string; user_email: string; event_type: string; metadata?: any }): Promise<void> {
    // Activity logs not implemented in MS SQL - silently skip
    console.log(`[Activity] ${log.event_type} by ${log.user_email}`);
  }

  async getActivityLogs(limit: number = 100): Promise<any[]> {
    // Activity logs not implemented in MS SQL
    return [];
  }

  // ═══════════════════════════════════════════════════════════════
  // IMPORT OPERATIONS
  // ═══════════════════════════════════════════════════════════════

  async importChats(sessionId: string, chatsData: any[]): Promise<void> {
    const pool = this.ensurePool();
    
    for (const chatData of chatsData) {
      // Insert chat
      await pool.request()
        .input('id', chatData.id)
        .input('session_id', sessionId)
        .input('title', chatData.title)
        .input('created_at', chatData.created_at ? new Date(chatData.created_at) : new Date())
        .input('updated_at', chatData.updated_at ? new Date(chatData.updated_at) : new Date())
        .query(`
          IF NOT EXISTS (SELECT 1 FROM chats WHERE id = @id)
          INSERT INTO chats (id, session_id, title, created_at, updated_at)
          VALUES (@id, @session_id, @title, @created_at, @updated_at)
        `);

      // Insert messages
      if (chatData.messages && chatData.messages.length > 0) {
        for (const msg of chatData.messages) {
          await pool.request()
            .input('id', msg.id)
            .input('chat_id', chatData.id)
            .input('type', msg.type)
            .input('content', msg.content)
            .input('timestamp', msg.timestamp ? new Date(msg.timestamp) : new Date())
            .input('response', msg.response ? JSON.stringify(msg.response) : null)
            .query(`
              IF NOT EXISTS (SELECT 1 FROM messages WHERE id = @id)
              INSERT INTO messages (id, chat_id, type, content, timestamp, response)
              VALUES (@id, @chat_id, @type, @content, @timestamp, @response)
            `);
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // EMBED LINKS OPERATIONS (Domain-Restricted Iframe Embedding)
  // ═══════════════════════════════════════════════════════════════

  async ensureEmbedLinksTable(): Promise<void> {
    const pool = this.ensurePool();
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='embed_links' AND xtype='U')
      CREATE TABLE embed_links (
        id VARCHAR(255) PRIMARY KEY,
        embed_id VARCHAR(255) NOT NULL UNIQUE,
        role VARCHAR(50) NOT NULL,
        allowed_domain VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_by VARCHAR(255) NOT NULL,
        created_by_email VARCHAR(255) NOT NULL,
        is_active BIT DEFAULT 1,
        created_at DATETIME2 DEFAULT GETUTCDATE(),
        last_used_at DATETIME2 NULL
      )
    `);
  }

  async listEmbedLinks(): Promise<EmbedLink[]> {
    const pool = this.ensurePool();
    await this.ensureEmbedLinksTable();
    const result = await pool.request().query(`
      SELECT id, embed_id, role, allowed_domain, name, created_by, created_by_email, 
             is_active, created_at, last_used_at
      FROM embed_links
      ORDER BY created_at DESC
    `);
    return result.recordset.map(this.mapEmbedLink);
  }

  async getEmbedLinkByEmbedId(embedId: string): Promise<EmbedLink | null> {
    const pool = this.ensurePool();
    await this.ensureEmbedLinksTable();
    const result = await pool.request()
      .input('embedId', embedId)
      .query(`
        SELECT TOP 1 id, embed_id, role, allowed_domain, name, created_by, created_by_email,
               is_active, created_at, last_used_at
        FROM embed_links
        WHERE embed_id = @embedId AND is_active = 1
      `);
    return result.recordset[0] ? this.mapEmbedLink(result.recordset[0]) : null;
  }

  async createEmbedLink(link: InsertEmbedLink): Promise<EmbedLink> {
    const pool = this.ensurePool();
    await this.ensureEmbedLinksTable();
    const id = generateId();
    const now = new Date();
    await pool.request()
      .input('id', id)
      .input('embed_id', link.embed_id)
      .input('role', link.role)
      .input('allowed_domain', link.allowed_domain)
      .input('name', link.name)
      .input('created_by', link.created_by)
      .input('created_by_email', link.created_by_email)
      .input('created_at', now)
      .query(`
        INSERT INTO embed_links (id, embed_id, role, allowed_domain, name, created_by, created_by_email, is_active, created_at)
        VALUES (@id, @embed_id, @role, @allowed_domain, @name, @created_by, @created_by_email, 1, @created_at)
      `);
    
    return {
      id,
      embed_id: link.embed_id,
      role: link.role as any,
      allowed_domain: link.allowed_domain,
      name: link.name,
      created_by: link.created_by,
      created_by_email: link.created_by_email,
      is_active: true,
      created_at: now,
      last_used_at: null,
    };
  }

  async deleteEmbedLink(id: string): Promise<void> {
    const pool = this.ensurePool();
    await pool.request()
      .input('id', id)
      .query('DELETE FROM embed_links WHERE id = @id');
  }

  async toggleEmbedLinkActive(id: string, isActive: boolean): Promise<void> {
    const pool = this.ensurePool();
    await pool.request()
      .input('id', id)
      .input('isActive', isActive ? 1 : 0)
      .query(`
        UPDATE embed_links
        SET is_active = @isActive
        WHERE id = @id
      `);
  }

  async updateEmbedLinkLastUsed(embedId: string): Promise<void> {
    const pool = this.ensurePool();
    const now = new Date();
    await pool.request()
      .input('embedId', embedId)
      .input('now', now)
      .query(`
        UPDATE embed_links
        SET last_used_at = @now
        WHERE embed_id = @embedId
      `);
  }

  private mapEmbedLink(row: any): EmbedLink {
    return {
      id: row.id,
      embed_id: row.embed_id,
      role: row.role,
      allowed_domain: row.allowed_domain,
      name: row.name,
      created_by: row.created_by,
      created_by_email: row.created_by_email,
      is_active: row.is_active === true || row.is_active === 1,
      created_at: new Date(row.created_at),
      last_used_at: row.last_used_at ? new Date(row.last_used_at) : null,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // EMBED USER IDS (Recovery codes for embed users)
  // ═══════════════════════════════════════════════════════════════

  async ensureEmbedUserIdsTable(): Promise<void> {
    const pool = this.ensurePool();
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='embed_user_ids' AND xtype='U')
      CREATE TABLE embed_user_ids (
        id VARCHAR(255) PRIMARY KEY,
        display_id VARCHAR(50) NOT NULL,
        embed_link_id VARCHAR(255) NOT NULL,
        internal_user_id VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        created_at DATETIME2 DEFAULT GETUTCDATE(),
        last_used_at DATETIME2 DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_embed_user_display UNIQUE (display_id, embed_link_id)
      );
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_embed_user_ids_internal' AND object_id = OBJECT_ID('embed_user_ids'))
      CREATE INDEX IX_embed_user_ids_internal ON embed_user_ids(internal_user_id);
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_embed_user_ids_embed_link' AND object_id = OBJECT_ID('embed_user_ids'))
      CREATE INDEX IX_embed_user_ids_embed_link ON embed_user_ids(embed_link_id);
    `);
  }

  // Generate a unique display ID in format: role_random6
  async generateEmbedDisplayId(role: string, embedLinkId: string): Promise<string> {
    const pool = this.ensurePool();
    await this.ensureEmbedUserIdsTable();
    
    // Generate random 6-char alphanumeric (lowercase)
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let displayId: string;
    let attempts = 0;
    
    do {
      let randomPart = '';
      for (let i = 0; i < 6; i++) {
        randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      displayId = `${role}_${randomPart}`;
      
      // Check if already exists for this embed link
      const existing = await pool.request()
        .input('displayId', displayId)
        .input('embedLinkId', embedLinkId)
        .query('SELECT 1 FROM embed_user_ids WHERE display_id = @displayId AND embed_link_id = @embedLinkId');
      
      if (existing.recordset.length === 0) {
        break;
      }
      attempts++;
    } while (attempts < 10);
    
    return displayId;
  }

  // Create or get embed user ID for an internal user ID (scoped by embed link)
  async getOrCreateEmbedUserId(internalUserId: string, role: string, embedLinkId: string): Promise<{ displayId: string; isNew: boolean }> {
    const pool = this.ensurePool();
    await this.ensureEmbedUserIdsTable();
    
    // Check if this internal user ID already has a display ID for this embed link
    const existing = await pool.request()
      .input('internalUserId', internalUserId)
      .input('embedLinkId', embedLinkId)
      .query('SELECT display_id FROM embed_user_ids WHERE internal_user_id = @internalUserId AND embed_link_id = @embedLinkId');
    
    if (existing.recordset.length > 0) {
      // Update last used
      await pool.request()
        .input('internalUserId', internalUserId)
        .input('embedLinkId', embedLinkId)
        .input('now', new Date())
        .query('UPDATE embed_user_ids SET last_used_at = @now WHERE internal_user_id = @internalUserId AND embed_link_id = @embedLinkId');
      
      return { displayId: existing.recordset[0].display_id, isNew: false };
    }
    
    // Create new display ID
    const displayId = await this.generateEmbedDisplayId(role, embedLinkId);
    const id = generateId();
    
    await pool.request()
      .input('id', id)
      .input('displayId', displayId)
      .input('embedLinkId', embedLinkId)
      .input('internalUserId', internalUserId)
      .input('role', role)
      .input('now', new Date())
      .query(`
        INSERT INTO embed_user_ids (id, display_id, embed_link_id, internal_user_id, role, created_at, last_used_at)
        VALUES (@id, @displayId, @embedLinkId, @internalUserId, @role, @now, @now)
      `);
    
    return { displayId, isNew: true };
  }

  // Get internal user ID from display ID (for recovery, scoped by embed link)
  async getEmbedUserByDisplayId(displayId: string, embedLinkId: string): Promise<{ internalUserId: string; role: string } | null> {
    const pool = this.ensurePool();
    await this.ensureEmbedUserIdsTable();
    
    const result = await pool.request()
      .input('displayId', displayId.toLowerCase())
      .input('embedLinkId', embedLinkId)
      .query('SELECT internal_user_id, role FROM embed_user_ids WHERE LOWER(display_id) = @displayId AND embed_link_id = @embedLinkId');
    
    if (result.recordset.length === 0) {
      return null;
    }
    
    return {
      internalUserId: result.recordset[0].internal_user_id,
      role: result.recordset[0].role,
    };
  }

  // Join existing session - returns the original internal user ID so multiple browsers can share the same session
  async joinExistingSession(displayId: string, embedLinkId: string): Promise<{ success: boolean; originalInternalUserId?: string }> {
    await this.ensureEmbedUserIdsTable();
    
    // Get the ORIGINAL internal user ID for this display ID (scoped by embed link)
    const existingUser = await this.getEmbedUserByDisplayId(displayId, embedLinkId);
    if (!existingUser) {
      return { success: false };
    }
    
    // Just update the last_used_at timestamp
    const pool = this.ensurePool();
    await pool.request()
      .input('displayId', displayId.toLowerCase())
      .input('embedLinkId', embedLinkId)
      .input('now', new Date())
      .query(`
        UPDATE embed_user_ids 
        SET last_used_at = @now
        WHERE LOWER(display_id) = @displayId AND embed_link_id = @embedLinkId
      `);
    
    // Return the original internal user ID so the caller can update their session to use it
    return { success: true, originalInternalUserId: existingUser.internalUserId };
  }

  // Link a new internal user ID to an existing display ID (for recovery/merge, scoped by embed link)
  async linkEmbedUserToDisplayId(newInternalUserId: string, displayId: string, embedLinkId: string): Promise<boolean> {
    const pool = this.ensurePool();
    await this.ensureEmbedUserIdsTable();
    
    // Get the OLD internal user ID for this display ID (scoped by embed link)
    const oldUser = await this.getEmbedUserByDisplayId(displayId, embedLinkId);
    if (!oldUser) {
      return false;
    }
    
    const oldInternalUserId = oldUser.internalUserId;
    
    // Update the display ID record to point to the new internal user ID
    // (Keep the old one for reference, but new queries will use newInternalUserId)
    await pool.request()
      .input('displayId', displayId.toLowerCase())
      .input('embedLinkId', embedLinkId)
      .input('newInternalUserId', newInternalUserId)
      .input('now', new Date())
      .query(`
        UPDATE embed_user_ids 
        SET internal_user_id = @newInternalUserId, last_used_at = @now
        WHERE LOWER(display_id) = @displayId AND embed_link_id = @embedLinkId
      `);
    
    // Now merge chats: Update old chats to belong to new user ID
    await pool.request()
      .input('oldUserId', oldInternalUserId)
      .input('newUserId', newInternalUserId)
      .query(`
        UPDATE chats SET session_id = @newUserId WHERE session_id = @oldUserId
      `);
    
    // Merge FAQs: Update messages with user_id
    await pool.request()
      .input('oldUserId', oldInternalUserId)
      .input('newUserId', newInternalUserId)
      .query(`
        UPDATE messages SET user_id = @newUserId WHERE user_id = @oldUserId
      `);
    
    // Merge query logs if they exist
    try {
      await pool.request()
        .input('oldUserId', oldInternalUserId)
        .input('newUserId', newInternalUserId)
        .query(`
          UPDATE query_logs SET user_id = @newUserId WHERE user_id = @oldUserId
        `);
    } catch (e) {
      // Query logs table might not exist
    }
    
    return true;
  }

  // Update the display ID for an embed user (allows custom ID)
  // currentDisplayId is the user's current ID (to verify ownership)
  // newDisplayId is what they want to change it to
  // newInternalUserId is the current session's internal ID (to keep the record linked)
  async updateEmbedUserDisplayId(currentDisplayId: string, newDisplayId: string, embedLinkId: string, newInternalUserId?: string): Promise<boolean> {
    const pool = this.ensurePool();
    await this.ensureEmbedUserIdsTable();
    
    // If same ID, just update the internal_user_id if provided
    if (currentDisplayId.toLowerCase() === newDisplayId.toLowerCase()) {
      if (newInternalUserId) {
        await pool.request()
          .input('currentDisplayId', currentDisplayId.toLowerCase())
          .input('embedLinkId', embedLinkId)
          .input('newInternalUserId', newInternalUserId)
          .input('now', new Date())
          .query(`
            UPDATE embed_user_ids 
            SET internal_user_id = @newInternalUserId, last_used_at = @now
            WHERE LOWER(display_id) = @currentDisplayId AND embed_link_id = @embedLinkId
          `);
      }
      return true;
    }
    
    // Check if the new display ID is already taken by someone else
    const existing = await pool.request()
      .input('newDisplayId', newDisplayId.toLowerCase())
      .input('embedLinkId', embedLinkId)
      .query('SELECT display_id FROM embed_user_ids WHERE LOWER(display_id) = @newDisplayId AND embed_link_id = @embedLinkId');
    
    if (existing.recordset.length > 0) {
      // Display ID is already taken
      return false;
    }
    
    // Update the display ID AND internal_user_id (to keep record linked to current session)
    let query = `
      UPDATE embed_user_ids 
      SET display_id = @newDisplayId, last_used_at = @now
    `;
    
    if (newInternalUserId) {
      query = `
        UPDATE embed_user_ids 
        SET display_id = @newDisplayId, internal_user_id = @newInternalUserId, last_used_at = @now
      `;
    }
    
    query += ` WHERE LOWER(display_id) = @currentDisplayId AND embed_link_id = @embedLinkId`;
    
    const request = pool.request()
      .input('currentDisplayId', currentDisplayId.toLowerCase())
      .input('embedLinkId', embedLinkId)
      .input('newDisplayId', newDisplayId.toLowerCase())
      .input('now', new Date());
    
    if (newInternalUserId) {
      request.input('newInternalUserId', newInternalUserId);
    }
    
    const result = await request.query(query);
    
    return result.rowsAffected[0] > 0;
  }

  // Debug method to see all embed users for an embed link
  async debugGetAllEmbedUsers(embedLinkId: string): Promise<any[]> {
    const pool = this.ensurePool();
    try {
      const result = await pool.request()
        .input('embedLinkId', embedLinkId)
        .query('SELECT internal_user_id, display_id, embed_link_id FROM embed_user_ids WHERE embed_link_id = @embedLinkId');
      return result.recordset;
    } catch (error) {
      console.error('[debugGetAllEmbedUsers] Error:', error);
      return [];
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════

  private mapChat(row: any): Chat {
    return {
      id: row.id,
      session_id: row.session_id,
      title: row.title,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      faq_category: row.faq_category,
    };
  }

  private mapMessage(row: any): Message {
    return {
      id: row.id,
      chat_id: row.chat_id,
      type: row.type,
      content: row.content,
      timestamp: new Date(row.timestamp),
      response: row.response ? (typeof row.response === 'string' ? JSON.parse(row.response) : row.response) : null,
      ai_analysis_messages: row.ai_analysis_messages ? (typeof row.ai_analysis_messages === 'string' ? JSON.parse(row.ai_analysis_messages) : row.ai_analysis_messages) : null,
      is_faq: row.is_faq === true || row.is_faq === 1,
      faq_category: row.faq_category,
      faq_display_text: row.faq_display_text,
      user_id: row.user_id || null,
    };
  }
}

// Export singleton instance
export const mssqlStorage = new MssqlStorage();
