const { Resend } = require('resend');
const { google } = require('googleapis');
const Lead = require('../models/Lead');
const EmailLog = require('../models/EmailLog');
const templateService = require('./templateService');
require('dotenv').config();

class EmailService {
  constructor() {
    this.resend = null;
    this.gmailClient = null;
    this.oauth2Client = null;
  }

  /**
   * Initialize Gmail OAuth2 client (for reply detection only)
   */
  async initGmailAPI() {
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

      console.log('\u2713 Gmail API initialized (reply detection)');
      return true;
    } catch (error) {
      console.warn('\u26a0 Gmail API not configured, reply detection disabled');
      return false;
    }
  }

  /**
   * Initialize Resend client for sending
   */
  initResend() {
    if (!process.env.RESEND_API_KEY) {
      console.error('\u2717 Missing RESEND_API_KEY in .env');
      return false;
    }

    this.resend = new Resend(process.env.RESEND_API_KEY);
    console.log('\u2713 Resend email client initialized');
    return true;
  }

  /**
   * Initialize email service (Resend for sending, Gmail API for reply detection)
   */
  async initialize() {
    this.initResend();
    await this.initGmailAPI();
  }

  /**
   * Convert plain text body to simple HTML
   */
  textToHtml(text) {
    const paragraphs = text.split(/\n\n+/);
    return paragraphs
      .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
      .join('\n');
  }

  /**
   * Send email to a lead
   * @param {Object} lead - Lead object from database
   * @param {Number} stage - Email stage (1=initial, 2=followup1, 3=followup2)
   * @returns {Object} Send result with message ID
   */
  async sendEmail(lead, stage = 1) {
    try {
      // Map stage to template type
      const stageMap = {
        1: 'initial',
        2: 'followup_1',
        3: 'followup_2'
      };

      const templateType = stageMap[stage];

      // Get template
      const template = await templateService.getTemplate(templateType);

      // Personalize content
      let subject = templateService.personalize(template.subject, lead);
      const body = templateService.personalize(template.body, lead);

      // Force follow-ups to "Re: <initial subject>" so Gmail/Outlook thread
      // them into the same conversation as the original email.
      if (stage > 1 && lead.last_email_subject) {
        const baseSubject = lead.last_email_subject.replace(/^(re:\s*)+/i, '');
        subject = `Re: ${baseSubject}`;
      }

      // Send via Resend
      let result;
      if (this.resend) {
        result = await this.sendViaResend(lead, subject, body, stage);
      } else {
        throw new Error('Resend client not initialized. Set RESEND_API_KEY in .env');
      }

      // Calculate next follow-up date
      // Day 0: initial -> followup_1 in 5 days (Day 5)
      // Day 5: followup_1 -> followup_2 in 7 days (Day 12)
      // Day 12: followup_2 is final, no more follow-ups
      const followupDelays = {
        1: 5,  // After initial: 5 days to followup_1
        2: 7   // After followup_1: 7 days to followup_2 (Day 12 total)
      };

      let nextFollowupDate = null;
      if (stage < 3) {
        const daysToAdd = followupDelays[stage];
        nextFollowupDate = new Date();
        nextFollowupDate.setDate(nextFollowupDate.getDate() + daysToAdd);
      }

      // Update lead
      await Lead.findByIdAndUpdate(lead._id, {
        $set: {
          status: stage === 1 ? 'contacted' : `followup_${stage - 1}`,
          last_contacted_at: new Date(),
          followup_stage: stage,
          followup_due_date: nextFollowupDate,
          last_message_id: result.messageId,
          thread_id: result.threadId || lead.thread_id,
          last_email_subject: subject
        },
        $inc: { emails_sent: 1 }
      });

      // Log email
      await EmailLog.create({
        lead_id: lead._id,
        lead_email: lead.email,
        lead_name: `${lead.first_name} ${lead.last_name || ''}`.trim(),
        company: lead.company,
        subject,
        body,
        template_used: template.template_name,
        message_id: result.messageId,
        thread_id: result.threadId || lead.thread_id,
        followup_stage: stage,
        followup_scheduled_for: nextFollowupDate,
        status: 'sent'
      });

      console.log(`\u2713 Email sent to ${lead.email} (Stage ${stage})`);

      return {
        success: true,
        messageId: result.messageId,
        threadId: result.threadId,
        nextFollowup: nextFollowupDate
      };

    } catch (error) {
      console.error(`\u2717 Failed to send email to ${lead.email}:`, error.message);

      // Log failed email
      await EmailLog.create({
        lead_id: lead._id,
        lead_email: lead.email,
        lead_name: `${lead.first_name} ${lead.last_name || ''}`.trim(),
        company: lead.company,
        subject: 'Failed to send',
        body: '',
        followup_stage: stage,
        status: 'failed',
        error_message: error.message
      });

      throw error;
    }
  }

  /**
   * Send email via Resend
   */
  async sendViaResend(lead, subject, body, stage) {
    try {
      const fromEmail = process.env.FROM_EMAIL || 'dave@striat.dev';
      const domain = fromEmail.split('@')[1];

      // Message-IDs must be RFC-5322 formatted (<uuid@domain>) for Gmail/Outlook
      // to thread the conversation correctly. We store the formatted ID on the
      // lead so subsequent follow-ups can reference it verbatim.
      const wrap = (id) => {
        if (!id) return id;
        return id.startsWith('<') ? id : `<${id}@${domain}>`;
      };

      const emailOptions = {
        from: fromEmail,
        to: lead.email,
        subject,
        html: this.textToHtml(body),
        reply_to: fromEmail
      };

      if (stage > 1 && lead.last_message_id) {
        const inReplyTo = wrap(lead.last_message_id);
        const references = wrap(lead.thread_id || lead.last_message_id);
        emailOptions.headers = {
          'In-Reply-To': inReplyTo,
          'References': references
        };
      }

      const res = await this.resend.emails.send(emailOptions);
      const rawId = res.data?.id || res.id;
      const formattedId = wrap(rawId);

      return {
        messageId: formattedId,
        threadId: lead.thread_id || formattedId
      };
    } catch (error) {
      console.error('Resend send error:', error.message);
      throw error;
    }
  }

  /**
   * Get leads ready for initial email
   * @param {Number} limit - max leads to return
   * @param {Array<String>|null} countryFilter - optional list of allowed countries
   */
  async getLeadsForInitialEmail(limit = 10, countryFilter = null) {
    const query = {
      status: 'new',
      reply_detected: false,
      followup_stage: 0
    };
    if (Array.isArray(countryFilter) && countryFilter.length) {
      query.country = { $in: countryFilter };
    }
    return await Lead.find(query)
      .limit(limit)
      .sort({ imported_at: 1 });
  }

  /**
   * Get leads ready for follow-up
   * @param {Number} limit - max leads to return
   * @param {Array<String>|null} countryFilter - optional list of allowed countries
   */
  async getLeadsForFollowup(limit = 10, countryFilter = null) {
    const now = new Date();
    const query = {
      reply_detected: false,
      followup_due_date: { $lte: now },
      followup_stage: { $gte: 1, $lt: 3 },
      status: { $nin: ['replied', 'engaged', 'unresponsive', 'unsubscribed'] }
    };
    if (Array.isArray(countryFilter) && countryFilter.length) {
      query.country = { $in: countryFilter };
    }
    return await Lead.find(query)
      .limit(limit)
      .sort({ followup_due_date: 1 });
  }

  /**
   * Process email queue (send initial + follow-ups)
   * @param {Number} maxEmails - cap for this slot
   * @param {Array<String>|null} countryFilter - optional list of allowed countries
   */
  async processQueue(maxEmails = 20, countryFilter = null) {
    try {
      const stats = {
        initial: 0,
        followups: 0,
        errors: 0
      };

      // Get leads for initial email
      const initialLeads = await this.getLeadsForInitialEmail(maxEmails, countryFilter);

      for (const lead of initialLeads) {
        try {
          await this.sendEmail(lead, 1);
          stats.initial++;

          // Random delay (10-60 sec) to look human and avoid spam detection
          await this.randomDelay();
        } catch (error) {
          stats.errors++;
        }
      }

      // Get leads for follow-ups
      const followupLeads = await this.getLeadsForFollowup(maxEmails - stats.initial, countryFilter);

      for (const lead of followupLeads) {
        try {
          const nextStage = lead.followup_stage + 1;
          await this.sendEmail(lead, nextStage);
          stats.followups++;

          // Random delay (10-60 sec) to look human
          await this.randomDelay();
        } catch (error) {
          stats.errors++;
        }
      }

      console.log('\n\ud83d\udcca Email Queue Processed:');
      console.log(`   Initial emails sent: ${stats.initial}`);
      console.log(`   Follow-ups sent: ${stats.followups}`);
      console.log(`   Errors: ${stats.errors}`);

      return stats;
    } catch (error) {
      console.error('Error processing email queue:', error.message);
      throw error;
    }
  }

  /**
   * Utility: Sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Utility: Random delay (10-60 seconds)
   * Makes email sending look more human and avoids spam detection
   */
  randomDelay() {
    const minDelay = 10000; // 10 seconds
    const maxDelay = 60000; // 60 seconds
    const randomMs = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
    console.log(`   \u23f1\ufe0f  Waiting ${Math.floor(randomMs / 1000)} seconds...`);
    return this.sleep(randomMs);
  }
}

module.exports = new EmailService();
