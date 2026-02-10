const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const Lead = require('../models/Lead');
const EmailLog = require('../models/EmailLog');
const templateService = require('./templateService');
require('dotenv').config();

class EmailService {
  constructor() {
    this.transporter = null;
    this.gmailClient = null;
    this.oauth2Client = null;
  }
  
  /**
   * Initialize Gmail OAuth2 client
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
      
      console.log('✓ Gmail API initialized');
      return true;
    } catch (error) {
      console.warn('⚠ Gmail API not configured, falling back to SMTP');
      return false;
    }
  }
  
  /**
   * Initialize SMTP transporter (fallback)
   */
  async initSMTP() {
    try {
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
        throw new Error('Missing EMAIL_USER or EMAIL_PASSWORD in .env');
      }
      
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      });
      
      await this.transporter.verify();
      console.log('✓ SMTP transporter initialized');
      return true;
    } catch (error) {
      console.error('✗ SMTP initialization failed:', error.message);
      return false;
    }
  }
  
  /**
   * Initialize email service (try Gmail API first, fallback to SMTP)
   */
  async initialize() {
    const gmailReady = await this.initGmailAPI();
    if (!gmailReady) {
      await this.initSMTP();
    }
  }
  
  /**
   * Send email to a lead
   * @param {Object} lead - Lead object from database
   * @param {Number} stage - Email stage (1=initial, 2=followup1, 3=followup2, 4=followup3)
   * @returns {Object} Send result with message ID and thread ID
   */
  async sendEmail(lead, stage = 1) {
    try {
      // Map stage to template type
      const stageMap = {
        1: 'initial',
        2: 'followup_1',
        3: 'followup_2',
        4: 'followup_3'
      };
      
      const templateType = stageMap[stage];
      
      // Get template
      const template = await templateService.getTemplate(templateType);
      
      // Personalize content
      const subject = templateService.personalize(template.subject, lead);
      const body = templateService.personalize(template.body, lead);
      
      // Send via Gmail API or SMTP
      let result;
      if (this.gmailClient) {
        result = await this.sendViaGmailAPI(lead.email, subject, body, lead.thread_id);
      } else if (this.transporter) {
        result = await this.sendViaSMTP(lead.email, subject, body);
      } else {
        throw new Error('No email service initialized');
      }
      
      // Calculate next follow-up date
      const followupDelays = {
        1: 3,  // Day 3
        2: 6,  // Day 6 (6 days after initial)
        3: 7   // Day 7 (7 days after followup 2)
      };
      
      let nextFollowupDate = null;
      if (stage < 4) {
        const daysToAdd = followupDelays[stage] || 3;
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
      
      console.log(`✓ Email sent to ${lead.email} (Stage ${stage})`);
      
      return {
        success: true,
        messageId: result.messageId,
        threadId: result.threadId,
        nextFollowup: nextFollowupDate
      };
      
    } catch (error) {
      console.error(`✗ Failed to send email to ${lead.email}:`, error.message);
      
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
   * Send email via Gmail API
   */
  async sendViaGmailAPI(to, subject, body, threadId = null) {
    try {
      const from = process.env.EMAIL_USER;
      
      // Create email message
      const email = [
        `From: ${from}`,
        `To: ${to}`,
        `Subject: ${subject}`,
        threadId ? `In-Reply-To: ${threadId}` : '',
        threadId ? `References: ${threadId}` : '',
        'Content-Type: text/plain; charset=utf-8',
        '',
        body
      ].filter(line => line !== '').join('\r\n');
      
      // Encode email
      const encodedEmail = Buffer.from(email)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      
      // Send email
      const res = await this.gmailClient.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedEmail,
          threadId: threadId || undefined
        }
      });
      
      return {
        messageId: res.data.id,
        threadId: res.data.threadId
      };
    } catch (error) {
      console.error('Gmail API send error:', error.message);
      throw error;
    }
  }
  
  /**
   * Send email via SMTP (fallback)
   */
  async sendViaSMTP(to, subject, body) {
    try {
      const info = await this.transporter.sendMail({
        from: process.env.EMAIL_USER,
        to,
        subject,
        text: body
      });
      
      return {
        messageId: info.messageId,
        threadId: null
      };
    } catch (error) {
      console.error('SMTP send error:', error.message);
      throw error;
    }
  }
  
  /**
   * Get leads ready for initial email
   */
  async getLeadsForInitialEmail(limit = 10) {
    return await Lead.find({
      status: 'new',
      reply_detected: false,
      followup_stage: 0
    })
    .limit(limit)
    .sort({ imported_at: 1 });
  }
  
  /**
   * Get leads ready for follow-up
   */
  async getLeadsForFollowup(limit = 10) {
    const now = new Date();
    
    return await Lead.find({
      reply_detected: false,
      followup_due_date: { $lte: now },
      followup_stage: { $gte: 1, $lt: 4 },
      status: { $nin: ['replied', 'engaged', 'unsubscribed'] }
    })
    .limit(limit)
    .sort({ followup_due_date: 1 });
  }
  
  /**
   * Process email queue (send initial + follow-ups)
   */
  async processQueue(maxEmails = 20) {
    try {
      const stats = {
        initial: 0,
        followups: 0,
        errors: 0
      };
      
      // Get leads for initial email
      const initialLeads = await this.getLeadsForInitialEmail(maxEmails);
      
      for (const lead of initialLeads) {
        try {
          await this.sendEmail(lead, 1);
          stats.initial++;
          
          // Small delay to avoid rate limits
          await this.sleep(2000);
        } catch (error) {
          stats.errors++;
        }
      }
      
      // Get leads for follow-ups
      const followupLeads = await this.getLeadsForFollowup(maxEmails - stats.initial);
      
      for (const lead of followupLeads) {
        try {
          const nextStage = lead.followup_stage + 1;
          await this.sendEmail(lead, nextStage);
          stats.followups++;
          
          // Small delay
          await this.sleep(2000);
        } catch (error) {
          stats.errors++;
        }
      }
      
      console.log('\n📊 Email Queue Processed:');
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
}

module.exports = new EmailService();
