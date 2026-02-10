const { google } = require('googleapis');
const Lead = require('../models/Lead');
const EmailLog = require('../models/EmailLog');
const templateService = require('./templateService');
require('dotenv').config();

class ReplyDetectionService {
  constructor() {
    this.gmailClient = null;
    this.oauth2Client = null;
  }
  
  /**
   * Initialize Gmail API
   */
  async initialize() {
    try {
      const credentials = require('../gmail_credentials.json');
      const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;
      
      this.oauth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        redirect_uris[0]
      );
      
      // Load tokens
      const tokens = require('../gmail_token.json');
      this.oauth2Client.setCredentials(tokens);
      
      this.gmailClient = google.gmail({ version: 'v1', auth: this.oauth2Client });
      
      console.log('✓ Reply Detection Service initialized');
      return true;
    } catch (error) {
      console.error('✗ Reply Detection Service initialization failed:', error.message);
      console.log('   Manual reply marking will be required');
      return false;
    }
  }
  
  /**
   * Check for replies in Gmail threads
   * Scans all active leads and checks if their threads have new replies
   */
  async checkForReplies() {
    try {
      if (!this.gmailClient) {
        throw new Error('Gmail client not initialized');
      }
      
      // Get leads that might have replies (contacted but not yet replied)
      const activeLeads = await Lead.find({
        thread_id: { $exists: true, $ne: null },
        reply_detected: false,
        status: { $in: ['contacted', 'followup_1', 'followup_2', 'followup_3'] }
      });
      
      console.log(`🔍 Checking ${activeLeads.length} threads for replies...`);
      
      const stats = {
        checked: 0,
        repliesFound: 0,
        errors: 0
      };
      
      for (const lead of activeLeads) {
        try {
          const hasReply = await this.checkThreadForReply(lead.thread_id, lead.last_message_id);
          
          if (hasReply) {
            await this.markAsReplied(lead);
            stats.repliesFound++;
          }
          
          stats.checked++;
          
          // Small delay to avoid API rate limits
          await this.sleep(500);
          
        } catch (error) {
          console.error(`Error checking thread for ${lead.email}:`, error.message);
          stats.errors++;
        }
      }
      
      console.log('\n📊 Reply Detection Results:');
      console.log(`   Threads checked: ${stats.checked}`);
      console.log(`   Replies found: ${stats.repliesFound}`);
      console.log(`   Errors: ${stats.errors}\n`);
      
      return stats;
      
    } catch (error) {
      console.error('Error in reply detection:', error.message);
      throw error;
    }
  }
  
  /**
   * Check if a specific Gmail thread has a reply
   * @param {String} threadId - Gmail thread ID
   * @param {String} lastMessageId - Our last sent message ID
   * @returns {Boolean} True if reply detected
   */
  async checkThreadForReply(threadId, lastMessageId) {
    try {
      const thread = await this.gmailClient.users.threads.get({
        userId: 'me',
        id: threadId
      });
      
      const messages = thread.data.messages || [];
      
      // Check if there are messages after our last sent message
      const ourMessageIndex = messages.findIndex(m => m.id === lastMessageId);
      
      if (ourMessageIndex === -1) {
        return false; // Our message not found
      }
      
      // If there are messages after ours, it's a reply
      const hasReply = ourMessageIndex < messages.length - 1;
      
      return hasReply;
      
    } catch (error) {
      if (error.code === 404) {
        console.warn(`Thread ${threadId} not found`);
        return false;
      }
      throw error;
    }
  }
  
  /**
   * Mark a lead as replied
   */
  async markAsReplied(lead) {
    try {
      // Update lead
      await Lead.findByIdAndUpdate(lead._id, {
        $set: {
          reply_detected: true,
          reply_detected_at: new Date(),
          status: 'replied',
          followup_due_date: null // Stop follow-ups
        }
      });
      
      // Update email log
      await EmailLog.updateMany(
        { lead_id: lead._id },
        {
          $set: {
            replied: true,
            replied_at: new Date()
          }
        }
      );
      
      // Update template stats
      const lastEmail = await EmailLog.findOne({ lead_id: lead._id })
        .sort({ sent_at: -1 });
      
      if (lastEmail && lastEmail.template_used) {
        await templateService.updateTemplateStats(lastEmail.template_used, true);
      }
      
      console.log(`✓ Reply detected for ${lead.email} - sequence stopped`);
      
    } catch (error) {
      console.error(`Error marking lead as replied:`, error.message);
      throw error;
    }
  }
  
  /**
   * Manual reply marking (for when Gmail API is not available)
   * @param {String} email - Lead email
   */
  async manualMarkAsReplied(email) {
    try {
      const lead = await Lead.findOne({ email: email.toLowerCase() });
      
      if (!lead) {
        throw new Error(`Lead not found: ${email}`);
      }
      
      await this.markAsReplied(lead);
      
      return { success: true, lead };
      
    } catch (error) {
      console.error('Error in manual reply marking:', error.message);
      throw error;
    }
  }
  
  /**
   * Get recent replies (for dashboard)
   */
  async getRecentReplies(days = 7) {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);
      
      const replies = await Lead.find({
        reply_detected: true,
        reply_detected_at: { $gte: since }
      })
      .sort({ reply_detected_at: -1 })
      .select('first_name last_name email company reply_detected_at status');
      
      return replies;
      
    } catch (error) {
      console.error('Error fetching recent replies:', error.message);
      throw error;
    }
  }
  
  /**
   * Utility: Sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new ReplyDetectionService();
