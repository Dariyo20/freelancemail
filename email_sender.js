const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
require('dotenv').config();

// AUTOMATED EMAIL SENDER WITH TRACKING
// Sends emails to HIGH confidence prospects only
// Tracks sent emails to prevent duplicates

const CONFIG = {
  RESEARCH_DIR: './research_reports',
  SENT_LOG: path.join(__dirname, 'sent_emails.json'),
  EMAIL_DELAY: 5000, // 5 seconds between emails (safe for Gmail)
  MIN_CONFIDENCE: 70, // Only HIGH confidence prospects
  DRY_RUN: false // Set to true to test without sending
};

class EmailSender {
  constructor() {
    this.transporter = null;
    this.sentEmails = this.loadSentLog();
    this.stats = {
      total: 0,
      sent: 0,
      skipped: 0,
      failed: 0
    };
  }

  // Load sent emails log
  loadSentLog() {
    try {
      if (fs.existsSync(CONFIG.SENT_LOG)) {
        const data = JSON.parse(fs.readFileSync(CONFIG.SENT_LOG, 'utf8'));
        return data;
      }
    } catch (error) {
      console.log('Creating new sent emails log...');
    }
    
    return {
      emails: {},
      lastSent: null,
      totalSent: 0
    };
  }

  // Save sent emails log
  saveSentLog() {
    fs.writeFileSync(CONFIG.SENT_LOG, JSON.stringify(this.sentEmails, null, 2));
  }

  // Setup email transporter
  async setupTransporter() {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      throw new Error('Missing EMAIL_USER or EMAIL_PASSWORD in .env file');
    }

    // Gmail configuration
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });

    // Verify connection
    try {
      await this.transporter.verify();
      console.log('✓ Email connection verified\n');
      return true;
    } catch (error) {
      console.error('✗ Email connection failed:', error.message);
      console.log('\nTroubleshooting:');
      console.log('1. Enable "Less secure app access" in Gmail settings');
      console.log('2. Or use App Password: https://myaccount.google.com/apppasswords');
      console.log('3. Make sure EMAIL_USER and EMAIL_PASSWORD are correct in .env\n');
      return false;
    }
  }

  // Get all HIGH confidence prospects
  getHighConfidenceProspects() {
    const reports = fs.readdirSync(CONFIG.RESEARCH_DIR)
      .filter(f => f.endsWith('_research.json'))
      .map(f => {
        const filepath = path.join(CONFIG.RESEARCH_DIR, f);
        const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
        return { file: f, data };
      })
      .filter(r => r.data.confidence.score >= CONFIG.MIN_CONFIDENCE)
      .sort((a, b) => b.data.confidence.score - a.data.confidence.score);

    return reports;
  }

  // Check if email already sent
  isAlreadySent(email) {
    return this.sentEmails.emails[email.toLowerCase()] !== undefined;
  }

  // Generate personalized email
  generateEmail(intel) {
    const email = {
      to: intel.prospect.email,
      from: process.env.EMAIL_USER,
      subject: '',
      text: '',
      html: ''
    };

    // Subject line
    if (intel.findings.news.length > 0) {
      const news = intel.findings.news[0];
      if (news.type === 'funding') {
        email.subject = `${intel.prospect.firstName} - congrats on the funding round`;
      } else if (news.type === 'product launch') {
        email.subject = `${intel.prospect.firstName} - saw your product launch`;
      } else if (news.type === 'partnership') {
        email.subject = `${intel.prospect.firstName} - congrats on the partnership`;
      } else {
        email.subject = `${intel.prospect.firstName} - saw news about ${intel.prospect.company}`;
      }
    } else if (intel.findings.blog.found) {
      email.subject = `${intel.prospect.firstName} - your recent article`;
    } else {
      email.subject = `${intel.prospect.firstName} - ${intel.prospect.company} development`;
    }

    // Email body (text version)
    let body = `Hi ${intel.prospect.firstName},\n\n`;

    // Opening based on best angle
    if (intel.findings.news.length > 0) {
      const news = intel.findings.news[0];
      if (news.type === 'funding') {
        body += `Congratulations on ${intel.prospect.company}'s recent funding! `;
        body += `I saw the news and wanted to reach out.\n\n`;
      } else {
        body += `I came across the news about ${intel.prospect.company}'s ${news.type}`;
        if (news.title.length < 80) {
          body += ` - "${news.title}"`;
        }
        body += `.\n\n`;
      }
    } else if (intel.findings.blog.found) {
      body += `I read your recent post "${intel.findings.blog.posts[0].title}" - great insights.\n\n`;
    } else {
      body += `I've been following companies in the ${intel.prospect.industry} space.\n\n`;
    }

    // About you + experience match
    if (intel.matches.length > 0) {
      const match = intel.matches[0];
      body += `I'm David Ariyo, a Full Stack Developer specializing in MERN stack. `;
      body += `I recently built ${match.project} - ${match.description}\n\n`;
      body += `Tech: ${match.techStack}\n`;
      body += `Scale: ${match.scale}\n\n`;
    } else {
      body += `I'm David Ariyo, a Full Stack Developer with expertise in React, Node.js, and MongoDB. `;
      body += `I build scalable web applications for growing tech companies.\n\n`;
    }

    // Relevant connection
    if (intel.analysis.industryMatch) {
      body += `Given ${intel.prospect.company}'s work in ${intel.analysis.industryMatch}, `;
      body += `I thought my experience might be relevant.\n\n`;
    }

    // CTA
    body += `Would you be open to a brief conversation if ${intel.prospect.company} `;
    body += `ever needs freelance development support?\n\n`;

  // Signature
body += `Best regards,\n`;
body += `David Ariyo\n`;
body += `Full Stack Developer | MERN Stack\n`;
body += `davidariyo109@gmail.com | (+234) 903-6184-863\n`;
body += `Portfolio: davidariyo.onrender.com`;

    email.text = body;

    // HTML version (better formatting)
    email.html = `
      <p>Hi ${intel.prospect.firstName},</p>
      ${this.generateHTMLOpening(intel)}
      ${this.generateHTMLExperience(intel)}
      ${this.generateHTMLCTA(intel)}
      ${this.generateHTMLSignature()}
    `;

    return email;
  }

  generateHTMLOpening(intel) {
    if (intel.findings.news.length > 0) {
      const news = intel.findings.news[0];
      if (news.type === 'funding') {
        return `<p>Congratulations on ${intel.prospect.company}'s recent funding! I saw the news and wanted to reach out.</p>`;
      } else {
        let html = `<p>I came across the news about ${intel.prospect.company}'s ${news.type}`;
        if (news.title.length < 80) {
          html += ` - "<em>${news.title}</em>"`;
        }
        html += `.</p>`;
        return html;
      }
    } else if (intel.findings.blog.found) {
      return `<p>I read your recent post "<em>${intel.findings.blog.posts[0].title}</em>" - great insights.</p>`;
    } else {
      return `<p>I've been following companies in the ${intel.prospect.industry} space.</p>`;
    }
  }

  generateHTMLExperience(intel) {
    let html = '<p>';
    if (intel.matches.length > 0) {
      const match = intel.matches[0];
      html += `I'm David Ariyo, a Full Stack Developer specializing in MERN stack. `;
      html += `I recently built <strong>${match.project}</strong> - ${match.description}</p>`;
      html += `<ul style="margin: 10px 0;">`;
      html += `<li><strong>Tech:</strong> ${match.techStack}</li>`;
      html += `<li><strong>Scale:</strong> ${match.scale}</li>`;
      html += `</ul>`;
    } else {
      html += `I'm David Ariyo, a Full Stack Developer with expertise in React, Node.js, and MongoDB. `;
      html += `I build scalable web applications for growing tech companies.</p>`;
    }

    if (intel.analysis.industryMatch) {
      html += `<p>Given ${intel.prospect.company}'s work in ${intel.analysis.industryMatch}, `;
      html += `I thought my experience might be relevant.</p>`;
    }

    return html;
  }

  generateHTMLCTA(intel) {
    return `<p>Would you be open to a brief conversation if ${intel.prospect.company} ever needs freelance development support?</p>`;
  }

  generateHTMLSignature() {
    return `
      <p style="margin-top: 20px;">
        Best regards,<br>
        <strong>David Ariyo</strong><br>
        Full Stack Developer | MERN Stack<br>
        <a href="mailto:davidariyo109@gmail.com">davidariyo109@gmail.com</a> | (+234) 903-6184-863<br>
        Portfolio: <a href="https://davidariyo.onrender.com">davidariyo.onrender.com</a>
      </p>
    `;
  }

  // Send email
  async sendEmail(emailData, intel) {
    if (CONFIG.DRY_RUN) {
      console.log(`  [DRY RUN] Would send to: ${emailData.to}`);
      console.log(`  Subject: ${emailData.subject}\n`);
      return { success: true, messageId: 'dry-run-' + Date.now() };
    }

    try {
      const info = await this.transporter.sendMail(emailData);
      
      // Log sent email
      this.sentEmails.emails[emailData.to.toLowerCase()] = {
        sentAt: new Date().toISOString(),
        company: intel.prospect.company,
        name: intel.prospect.name,
        subject: emailData.subject,
        confidence: intel.confidence.score,
        messageId: info.messageId
      };
      
      this.sentEmails.lastSent = new Date().toISOString();
      this.sentEmails.totalSent++;
      this.saveSentLog();

      return { success: true, messageId: info.messageId };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Main process
  async processBatch() {
    console.log('AUTOMATED EMAIL SENDER');
    console.log('='.repeat(60) + '\n');

    if (CONFIG.DRY_RUN) {
      console.log('⚠️  DRY RUN MODE - No emails will be sent\n');
    }

    // Setup email
    const connected = await this.setupTransporter();
    if (!connected && !CONFIG.DRY_RUN) {
      console.log('Cannot proceed without email connection.');
      return;
    }

    // Get HIGH confidence prospects
    const prospects = this.getHighConfidenceProspects();
    console.log(`Found ${prospects.length} HIGH confidence prospects\n`);

    if (prospects.length === 0) {
      console.log('No HIGH confidence prospects found.');
      console.log('Run: node lead_automation.js research <csv> first\n');
      return;
    }

    // Filter out already sent
    const toSend = prospects.filter(p => {
      const email = p.data.prospect.email;
      if (this.isAlreadySent(email)) {
        this.stats.skipped++;
        return false;
      }
      return true;
    });

    console.log(`Already contacted: ${this.stats.skipped}`);
    console.log(`Ready to send: ${toSend.length}\n`);

    if (toSend.length === 0) {
      console.log('All HIGH confidence prospects already contacted!\n');
      return;
    }

    // Confirm before sending
    if (!CONFIG.DRY_RUN) {
      console.log(`About to send ${toSend.length} emails...`);
      console.log('Press Ctrl+C to cancel, or wait 5 seconds to proceed...\n');
      await this.sleep(5000);
    }

    // Send emails
    for (let i = 0; i < toSend.length; i++) {
      const prospect = toSend[i];
      const intel = prospect.data;
      this.stats.total++;

      console.log(`[${i + 1}/${toSend.length}] ${intel.prospect.company} (${intel.confidence.score}/100)`);
      console.log(`  To: ${intel.prospect.email}`);

      // Generate email
      const emailData = this.generateEmail(intel);

      // Send
      const result = await this.sendEmail(emailData, intel);

      if (result.success) {
        this.stats.sent++;
        console.log(`  ✓ Sent! (Message ID: ${result.messageId})`);
      } else {
        this.stats.failed++;
        console.log(`  ✗ Failed: ${result.error}`);
      }

      // Delay between emails (rate limiting)
      if (i < toSend.length - 1) {
        console.log(`  Waiting ${CONFIG.EMAIL_DELAY / 1000}s...\n`);
        await this.sleep(CONFIG.EMAIL_DELAY);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total processed: ${this.stats.total}`);
    console.log(`Successfully sent: ${this.stats.sent}`);
    console.log(`Already contacted: ${this.stats.skipped}`);
    console.log(`Failed: ${this.stats.failed}`);
    console.log(`Total ever sent: ${this.sentEmails.totalSent}`);
    console.log('\nSent log saved to: ' + CONFIG.SENT_LOG + '\n');
  }

  // View sent emails log
  viewSentLog() {
    console.log('\nSENT EMAILS LOG');
    console.log('='.repeat(60) + '\n');

    if (Object.keys(this.sentEmails.emails).length === 0) {
      console.log('No emails sent yet.\n');
      return;
    }

    console.log(`Total sent: ${this.sentEmails.totalSent}`);
    console.log(`Last sent: ${this.sentEmails.lastSent}\n`);

    const entries = Object.entries(this.sentEmails.emails)
      .sort((a, b) => new Date(b[1].sentAt) - new Date(a[1].sentAt));

    entries.forEach(([email, data], i) => {
      console.log(`${i + 1}. ${data.company} - ${data.name}`);
      console.log(`   Email: ${email}`);
      console.log(`   Sent: ${new Date(data.sentAt).toLocaleString()}`);
      console.log(`   Subject: ${data.subject}`);
      console.log(`   Confidence: ${data.confidence}/100\n`);
    });
  }

  // Reset sent log (use with caution!)
  resetSentLog() {
    this.sentEmails = {
      emails: {},
      lastSent: null,
      totalSent: 0
    };
    this.saveSentLog();
    console.log('\n✓ Sent emails log has been reset.\n');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// MAIN EXECUTION
async function main() {
  const sender = new EmailSender();
  const command = process.argv[2];

  if (command === 'send') {
    await sender.processBatch();
    
  } else if (command === 'log') {
    sender.viewSentLog();
    
  } else if (command === 'reset') {
    console.log('\n⚠️  WARNING: This will reset the sent emails log.');
    console.log('You will be able to send emails to previously contacted prospects again.\n');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to proceed...\n');
    await sender.sleep(5000);
    sender.resetSentLog();
    
  } else if (command === 'test') {
    console.log('\nTEST MODE - Dry run without sending\n');
    CONFIG.DRY_RUN = true;
    await sender.processBatch();
    
  } else {
    console.log('\nAUTOMATED EMAIL SENDER WITH TRACKING');
    console.log('='.repeat(60) + '\n');
    
    console.log('SETUP:\n');
    console.log('1. Add to .env file:');
    console.log('   EMAIL_USER=your-email@gmail.com');
    console.log('   EMAIL_PASSWORD=your-app-password\n');
    
    console.log('2. Gmail Setup:');
    console.log('   - Go to: https://myaccount.google.com/apppasswords');
    console.log('   - Generate an App Password');
    console.log('   - Use that password (not your Gmail password)\n');
    
    console.log('COMMANDS:\n');
    console.log('  node email_sender.js send   - Send to HIGH confidence prospects');
    console.log('  node email_sender.js test   - Dry run (no emails sent)');
    console.log('  node email_sender.js log    - View sent emails log');
    console.log('  node email_sender.js reset  - Reset sent log (use with caution!)\n');
    
    console.log('FEATURES:\n');
    console.log('  ✓ Only sends to HIGH confidence (70+) prospects');
    console.log('  ✓ Auto-generates personalized emails from research');
    console.log('  ✓ Tracks sent emails (no duplicates)');
    console.log('  ✓ 5-second delay between emails (Gmail safe)');
    console.log('  ✓ HTML + plain text email formats');
    console.log('  ✓ Logs all sent emails to JSON file\n');
    
    console.log('WORKFLOW:\n');
    console.log('  1. Run research: node lead_automation.js research ./csv/prospects.csv');
    console.log('  2. Test sender: node email_sender.js test');
    console.log('  3. Send emails: node email_sender.js send');
    console.log('  4. Check log: node email_sender.js log\n');
    
    console.log('SAFETY:\n');
    console.log('  - 5 second delay between emails');
    console.log('  - Gmail limit: ~500 emails/day');
    console.log('  - Sent log prevents duplicates');
    console.log('  - Test mode available\n');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = EmailSender;