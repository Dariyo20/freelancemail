const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const Lead = require('../models/Lead');
const EmailLog = require('../models/EmailLog');
const templateService = require('./templateService');
const { classifyReply, extractEmail } = require('./replyClassifierService');
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
      let credentials;
      try {
        credentials = require('../gmail_credentials.json');
      } catch (err) {
        console.warn('\u26a0 gmail_credentials.json not found, reply detection disabled');
        console.log('   Manual reply marking will be required');
        return false;
      }
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

      console.log('\u2713 Reply Detection Service initialized');
      return true;
    } catch (error) {
      console.error('\u2717 Reply Detection Service initialization failed:', error.message);
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
        last_contacted_at: { $exists: true, $ne: null },
        reply_detected: false,
        status: { $in: ['contacted', 'followup_1', 'followup_2'] }
      });

      console.log(`\ud83d\udd0d Checking ${activeLeads.length} threads for replies...`);

      const stats = {
        checked: 0,
        repliesFound: 0,
        autoResponders: 0,
        softNos: 0,
        warm: 0,
        referrals: 0,
        errors: 0
      };

      for (const lead of activeLeads) {
        try {
          const replyData = await this.searchForReply(lead);

          if (replyData) {
            const classification = classifyReply(replyData.body);
            await this.handleClassifiedReply(lead, classification, replyData.body);

            stats.repliesFound++;
            if (classification.class === 'auto_responder') stats.autoResponders++;
            else if (classification.class === 'soft_no') stats.softNos++;
            else if (classification.class === 'warm') stats.warm++;
            else if (classification.class === 'referral') stats.referrals++;
          }

          stats.checked++;

          // Small delay to avoid API rate limits
          await this.sleep(500);

        } catch (error) {
          console.error(`Error checking thread for ${lead.email}:`, error.message);
          stats.errors++;
        }
      }

      console.log('\n\ud83d\udcca Reply Detection Results:');
      console.log(`   Threads checked: ${stats.checked}`);
      console.log(`   Replies found: ${stats.repliesFound}`);
      console.log(`     Auto-responders: ${stats.autoResponders}`);
      console.log(`     Soft nos: ${stats.softNos}`);
      console.log(`     Warm leads: ${stats.warm}`);
      console.log(`     Referrals: ${stats.referrals}`);
      console.log(`   Errors: ${stats.errors}\n`);

      return stats;

    } catch (error) {
      console.error('Error in reply detection:', error.message);
      throw error;
    }
  }

  /**
   * Search Gmail for a reply from this lead.
   * Uses sender-based search instead of thread-ID lookup because outbound
   * emails go through Resend (not Gmail), so we don't have Gmail thread IDs
   * for our sent messages. A reply counts if it was received after our last
   * contact time.
   * @param {Object} lead - Lead document
   * @returns {Object|null} { body } if reply found, null otherwise
   */
  async searchForReply(lead) {
    try {
      const fromEmail = process.env.FROM_EMAIL || 'dave@striat.dev';
      const query = `from:${lead.email} to:${fromEmail} newer_than:30d`;

      const list = await this.gmailClient.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 1
      });

      const messages = list.data.messages || [];
      if (messages.length === 0) return null;

      const msgResponse = await this.gmailClient.users.messages.get({
        userId: 'me',
        id: messages[0].id,
        format: 'full'
      });
      const msg = msgResponse.data;

      // Guard: only count replies received after our last send to this lead.
      if (lead.last_contacted_at) {
        const receivedTs = parseInt(msg.internalDate, 10);
        if (receivedTs <= lead.last_contacted_at.getTime()) return null;
      }

      const body = this.extractMessageBody(msg);
      return { body };

    } catch (error) {
      if (error.code === 404) return null;
      throw error;
    }
  }

  /**
   * Extract plain text body from a Gmail message
   */
  extractMessageBody(message) {
    try {
      const payload = message.payload;
      if (!payload) return '';

      // Check for plain text part
      if (payload.mimeType === 'text/plain' && payload.body && payload.body.data) {
        return Buffer.from(payload.body.data, 'base64').toString('utf-8');
      }

      // Check multipart
      if (payload.parts) {
        for (const part of payload.parts) {
          if (part.mimeType === 'text/plain' && part.body && part.body.data) {
            return Buffer.from(part.body.data, 'base64').toString('utf-8');
          }
        }
        // Fallback to HTML part stripped of tags
        for (const part of payload.parts) {
          if (part.mimeType === 'text/html' && part.body && part.body.data) {
            const html = Buffer.from(part.body.data, 'base64').toString('utf-8');
            return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          }
        }
      }

      // Snippet fallback
      return message.snippet || '';
    } catch (error) {
      return message.snippet || '';
    }
  }

  /**
   * Handle a classified reply according to its type
   */
  async handleClassifiedReply(lead, classification, replyBody) {
    switch (classification.class) {
      case 'auto_responder':
        await this.handleAutoResponder(lead);
        break;
      case 'soft_no':
        await this.handleSoftNo(lead, classification);
        break;
      case 'warm':
        await this.handleWarm(lead, classification, replyBody);
        break;
      case 'referral':
        await this.handleReferral(lead, classification, replyBody);
        break;
    }
  }

  /**
   * AUTO_RESPONDER: Don't mark as replied. Push followup_due_date forward 7 days.
   */
  async handleAutoResponder(lead) {
    const newDueDate = new Date();
    newDueDate.setDate(newDueDate.getDate() + 7);

    await Lead.findByIdAndUpdate(lead._id, {
      $set: {
        followup_due_date: newDueDate,
        reply_class: 'auto_responder'
      }
    });

    // Log auto-responder in EmailLog
    await EmailLog.updateMany(
      { lead_id: lead._id },
      { $set: { auto_responder_detected: true } }
    );

    console.log(`  \u2709 Auto-responder from ${lead.email} \u2014 pushed follow-up +7 days`);
  }

  /**
   * SOFT_NO: Mark as replied, set status unresponsive. No alert.
   */
  async handleSoftNo(lead, classification) {
    await Lead.findByIdAndUpdate(lead._id, {
      $set: {
        reply_detected: true,
        reply_detected_at: new Date(),
        status: 'unresponsive',
        followup_due_date: null,
        reply_class: 'soft_no'
      }
    });

    await this.updateEmailLogs(lead);
    await this.updateTemplateStats(lead);

    console.log(`  \u274c Soft no from ${lead.email} \u2014 marked unresponsive`);
  }

  /**
   * WARM: Mark as replied, set status engaged, send alert to Dave.
   */
  async handleWarm(lead, classification, replyBody) {
    await Lead.findByIdAndUpdate(lead._id, {
      $set: {
        reply_detected: true,
        reply_detected_at: new Date(),
        status: 'engaged',
        followup_due_date: null,
        reply_class: 'warm'
      }
    });

    await this.updateEmailLogs(lead);
    await this.updateTemplateStats(lead);

    // Send alert email
    await this.sendAlert(
      `\ud83d\udd25 WARM LEAD: ${lead.first_name} at ${lead.company} replied`,
      `Warm reply detected from ${lead.first_name} ${lead.last_name || ''} at ${lead.company}.\n\nEmail: ${lead.email}\nClassification confidence: ${classification.confidence}\nMatched keywords: ${classification.matched_keywords.join(', ')}\n\n--- Reply Body ---\n${replyBody}\n---\n\nRespond ASAP.`
    );

    console.log(`  \ud83d\udd25 WARM lead: ${lead.email} \u2014 alert sent to Dave`);
  }

  /**
   * REFERRAL: Mark as replied, parse email, create new lead, alert Dave.
   */
  async handleReferral(lead, classification, replyBody) {
    await Lead.findByIdAndUpdate(lead._id, {
      $set: {
        reply_detected: true,
        reply_detected_at: new Date(),
        status: 'replied',
        followup_due_date: null,
        reply_class: 'referral'
      }
    });

    await this.updateEmailLogs(lead);
    await this.updateTemplateStats(lead);

    // Extract referred email and create new lead
    const referredEmail = extractEmail(replyBody);
    if (referredEmail) {
      const existingLead = await Lead.findOne({ email: referredEmail.toLowerCase() });
      if (!existingLead) {
        await Lead.create({
          first_name: 'Referred',
          email: referredEmail.toLowerCase(),
          company: lead.company,
          source: 'manual',
          status: 'new',
          metadata: {
            referral_source: lead.email
          }
        });
        console.log(`  \u2795 Created referred lead: ${referredEmail}`);
      }
    }

    await this.sendAlert(
      `\ud83e\udd1d REFERRAL: ${lead.first_name} referred you to ${referredEmail || 'someone'}`,
      `Referral detected from ${lead.first_name} ${lead.last_name || ''} at ${lead.company}.\n\nOriginal lead: ${lead.email}\nReferred email: ${referredEmail || 'Could not parse'}\nMatched keywords: ${classification.matched_keywords.join(', ')}\n\n--- Reply Body ---\n${replyBody}\n---`
    );

    console.log(`  \ud83e\udd1d REFERRAL from ${lead.email} \u2192 ${referredEmail || 'unknown'}`);
  }

  /**
   * Send alert email to ALERT_EMAIL
   */
  async sendAlert(subject, body) {
    const alertEmail = process.env.ALERT_EMAIL;
    if (!alertEmail) {
      console.warn('  \u26a0 ALERT_EMAIL not set, skipping alert');
      return;
    }

    try {
      // Use nodemailer with a simple SMTP config or Resend for alerts
      // For now, use a simple approach: try Resend if available
      const { Resend } = require('resend');
      if (process.env.RESEND_API_KEY) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: process.env.FROM_EMAIL || 'dave@striat.dev',
          to: alertEmail,
          subject,
          text: body
        });
      }
    } catch (error) {
      console.error('  Failed to send alert:', error.message);
    }
  }

  /**
   * Update email logs when reply detected
   */
  async updateEmailLogs(lead) {
    await EmailLog.updateMany(
      { lead_id: lead._id },
      {
        $set: {
          replied: true,
          replied_at: new Date()
        }
      }
    );
  }

  /**
   * Update template stats when reply detected
   */
  async updateTemplateStats(lead) {
    const lastEmail = await EmailLog.findOne({ lead_id: lead._id })
      .sort({ sent_at: -1 });

    if (lastEmail && lastEmail.template_used) {
      await templateService.updateTemplateStats(lastEmail.template_used, true);
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

      // Default to warm for manual marks
      await Lead.findByIdAndUpdate(lead._id, {
        $set: {
          reply_detected: true,
          reply_detected_at: new Date(),
          status: 'engaged',
          followup_due_date: null,
          reply_class: 'warm'
        }
      });

      await this.updateEmailLogs(lead);
      await this.updateTemplateStats(lead);

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
      .select('first_name last_name email company reply_detected_at status reply_class');

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
