const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const readline = require('readline');
require('dotenv').config();

// ENHANCED GMAIL DRAFT SENDER 
// Creates drafts for HIGH (70+) and MEDIUM (50-69) confidence prospects
// Clearly marks which drafts need review

const CONFIG = {
  RESEARCH_DIR: './research_reports',
  SENT_LOG: path.join(__dirname, 'sent_emails.json'),
  CREDENTIALS_FILE: path.join(__dirname, 'gmail_credentials.json'),
  TOKEN_FILE: path.join(__dirname, 'gmail_token.json'),
  MIN_CONFIDENCE: 50  // Changed from 70 to 50 to include medium confidence
};

class EnhancedGmailDraftSender {
  constructor() {
    this.gmail = null;
    this.oauth2Client = null;
    this.sentEmails = this.loadSentLog();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    this.stats = {
      total: 0,
      highConfidence: 0,
      mediumConfidence: 0,
      draftsCreated: 0,
      skipped: 0
    };
  }

  loadSentLog() {
    try {
      if (fs.existsSync(CONFIG.SENT_LOG)) {
        return JSON.parse(fs.readFileSync(CONFIG.SENT_LOG, 'utf8'));
      }
    } catch (error) {
      console.log('Creating new sent emails log...');
    }
    
    return {
      emails: {},
      drafts: {},
      lastSent: null,
      totalSent: 0
    };
  }

  saveSentLog() {
    fs.writeFileSync(CONFIG.SENT_LOG, JSON.stringify(this.sentEmails, null, 2));
  }

  async setupGmailAPI() {
    try {
      if (!fs.existsSync(CONFIG.CREDENTIALS_FILE)) {
        console.log('\n❌ Gmail credentials not found!');
        console.log('\nSETUP INSTRUCTIONS:');
        console.log('='.repeat(70));
        console.log('1. Go to: https://console.cloud.google.com/');
        console.log('2. Create a new project (or select existing)');
        console.log('3. Enable Gmail API');
        console.log('4. Go to "Credentials" → Create OAuth 2.0 Client ID');
        console.log('5. Application type: Desktop app');
        console.log('6. Download the JSON file');
        console.log('7. Save it as: gmail_credentials.json (in this folder)');
        console.log('8. Run this script again\n');
        return false;
      }

      const credentials = JSON.parse(fs.readFileSync(CONFIG.CREDENTIALS_FILE, 'utf8'));
      const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;

      this.oauth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        redirect_uris[0]
      );

      if (fs.existsSync(CONFIG.TOKEN_FILE)) {
        const token = JSON.parse(fs.readFileSync(CONFIG.TOKEN_FILE, 'utf8'));
        this.oauth2Client.setCredentials(token);
      } else {
        await this.authorize();
      }

      this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
      await this.gmail.users.getProfile({ userId: 'me' });
      console.log('✓ Gmail API connected\n');
      return true;

    } catch (error) {
      console.error('✗ Gmail API setup failed:', error.message);
      return false;
    }
  }

  async authorize() {
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/gmail.compose']
    });

    console.log('\n🔐 AUTHORIZATION REQUIRED');
    console.log('='.repeat(70));
    console.log('1. Open this URL in your browser:');
    console.log(authUrl);
    console.log('\n2. Authorize the app');
    console.log('3. Copy the authorization code\n');

    const code = await this.promptUser('Enter the code here: ');

    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    
    fs.writeFileSync(CONFIG.TOKEN_FILE, JSON.stringify(tokens));
    console.log('\n✓ Authorization successful!\n');
  }

  getQualifiedProspects() {
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

  isAlreadySent(email) {
    return this.sentEmails.emails[email.toLowerCase()] !== undefined;
  }

  hasDraft(email) {
    return this.sentEmails.drafts[email.toLowerCase()] !== undefined;
  }

  generateEmail(intel) {
  const score = intel.confidence.score;
  const needsReview = score < 70;
  
  // Safety checks for missing data
  const hasNews = intel.findings && intel.findings.news && intel.findings.news.length > 0;
  const hasBlog = intel.findings && intel.findings.blog && intel.findings.blog.found;
  const hasMatches = intel.matches && intel.matches.length > 0;
  const hasIndustryMatch = intel.analysis && intel.analysis.industryMatch;
  const hasGrowthSignals = intel.analysis && intel.analysis.growthSignals && intel.analysis.growthSignals.length > 0;
  
  const email = {
    to: intel.prospect.email,
    subject: '',
    body: ''
  };

  // Subject line - add [NEEDS REVIEW] for medium confidence
  let subjectPrefix = needsReview ? '[NEEDS REVIEW] ' : '';
  
  if (hasNews) {
    const news = intel.findings.news[0];
    if (news.type === 'funding') {
      email.subject = `${subjectPrefix}${intel.prospect.firstName} - congrats on the funding round`;
    } else if (news.type === 'product launch') {
      email.subject = `${subjectPrefix}${intel.prospect.firstName} - saw your product launch`;
    } else if (news.type === 'partnership') {
      email.subject = `${subjectPrefix}${intel.prospect.firstName} - congrats on the partnership`;
    } else {
      email.subject = `${subjectPrefix}${intel.prospect.firstName} - saw news about ${intel.prospect.company}`;
    }
  } else if (hasBlog) {
    email.subject = `${subjectPrefix}${intel.prospect.firstName} - your recent article`;
  } else {
    email.subject = `${subjectPrefix}${intel.prospect.firstName} - ${intel.prospect.company} development`;
  }

  // Email body with review notes for medium confidence
  let body = '';
  
  // Add review banner for medium confidence
  if (needsReview) {
    body += `<div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin-bottom: 20px;">`;
    body += `<strong>⚠️ REVIEW NEEDED (Confidence: ${score}/100)</strong><br>`;
    body += `<small>`;
    body += `This draft needs additional personalization before sending.<br>`;
    body += `Missing: ${this.getMissingElements(intel).join(', ')}<br>`;
    body += `Action: Add 10-15 min research to strengthen this email.`;
    body += `</small>`;
    body += `</div>`;
  }

  body += `<p>Hi ${intel.prospect.firstName},</p>`;

  // Opening based on available information
  if (hasNews) {
    const news = intel.findings.news[0];
    if (news.type === 'funding') {
      body += `<p>Congratulations on ${intel.prospect.company}'s recent funding! I saw the news and wanted to reach out.</p>`;
    } else {
      body += `<p>I came across the news about ${intel.prospect.company}'s ${news.type}`;
      if (news.title && news.title.length < 80) {
        body += ` - "<em>${news.title}</em>"`;
      }
      body += `.</p>`;
    }
  } else if (hasBlog) {
    body += `<p>I read your recent post "<em>${intel.findings.blog.posts[0].title}</em>" - great insights.</p>`;
  } else {
    // Generic opening for prospects without news/blog
    body += `<p>I've been following companies in the ${intel.prospect.industry || 'tech'} space`;
    if (hasGrowthSignals) {
      body += ` and noticed ${intel.prospect.company}'s growth`;
    }
    body += `.</p>`;
    
    // Add note for review
    if (needsReview) {
      body += `<p><em style="color: #856404;">[TODO: Add a more specific opening based on their LinkedIn/website]</em></p>`;
    }
  }

  // About me + project match
  if (hasMatches) {
    const match = intel.matches[0];
    body += `<p>I'm David Ariyo, a Full Stack Developer specializing in MERN stack. `;
    body += `I recently built <strong>${match.project}</strong> - ${match.description}</p>`;
    body += `<ul>`;
    body += `<li><strong>Tech:</strong> ${match.techStack}</li>`;
    body += `<li><strong>Scale:</strong> ${match.scale}</li>`;
    body += `</ul>`;
  } else {
    body += `<p>I'm David Ariyo, a Full Stack Developer with expertise in React, Node.js, and MongoDB. `;
    body += `I build scalable web applications for growing tech companies.</p>`;
    
    if (needsReview) {
      body += `<p><em style="color: #856404;">[TODO: Find a specific project match or remove this generic intro]</em></p>`;
    }
  }

  // Industry connection
  if (hasIndustryMatch) {
    body += `<p>Given ${intel.prospect.company}'s work in ${intel.analysis.industryMatch}, `;
    body += `I thought my experience might be relevant.</p>`;
  } else if (needsReview) {
    body += `<p><em style="color: #856404;">[TODO: Research and add how your skills match their specific needs]</em></p>`;
  }

  // CTA
  body += `<p>Would you be open to a brief conversation if ${intel.prospect.company} ever needs freelance development support?</p>`;
  
  // Signature
  body += `<p style="margin-top: 20px;">`;
  body += `Best regards,<br>`;
  body += `<strong>David Ariyo</strong><br>`;
  body += `Full Stack Developer | MERN Stack<br>`;
  body += `<a href="mailto:davidariyo109@gmail.com">davidariyo109@gmail.com</a> | (+234) 903-6184-863<br>`;
  body += `Portfolio: <a href="https://davidariyo.onrender.com">davidariyo.onrender.com</a>`;
  body += `</p>`;

  // Research context (hidden HTML comment)
  body += `\n\n<!-- RESEARCH CONTEXT:\n`;
  body += `Confidence: ${score}/100 - ${intel.confidence.level}\n`;
  body += `Recommendation: ${intel.recommendation}\n\n`;
  
  if (hasNews) {
    body += `NEWS:\n`;
    intel.findings.news.slice(0, 3).forEach((n, i) => {
      body += `  ${i + 1}. [${n.type}] ${n.title}\n`;
      body += `     ${n.url}\n`;
    });
    body += `\n`;
  } else {
    body += `NEWS: None found - consider manual search\n\n`;
  }
  
  if (hasBlog) {
    body += `BLOG: ${intel.findings.blog.url}\n`;
    intel.findings.blog.posts.slice(0, 2).forEach((p, i) => {
      body += `  ${i + 1}. ${p.title}\n`;
    });
    body += `\n`;
  }
  
  if (intel.prospect.linkedIn) {
    body += `LinkedIn: ${intel.prospect.linkedIn}\n`;
  }
  
  body += `Website: ${intel.prospect.website || 'Not found'}\n`;
  
  if (hasGrowthSignals) {
    body += `Growth signals: ${intel.analysis.growthSignals.join(', ')}\n`;
  }
  
  if (intel.manualChecks && intel.manualChecks.length > 0) {
    body += `\nMANUAL CHECKS:\n`;
    intel.manualChecks.forEach(check => {
      body += `  [ ] ${check}\n`;
    });
  }
  
  body += `-->`;

  email.body = body;
  return email;
}

  getMissingElements(intel) {
  const missing = [];
  
  if (!intel.findings || !intel.findings.news || intel.findings.news.length === 0) {
    missing.push('Recent news');
  }
  if (!intel.findings || !intel.findings.blog || !intel.findings.blog.found) {
    missing.push('Blog content');
  }
  if (!intel.matches || intel.matches.length === 0) {
    missing.push('Strong project match');
  }
  if (intel.findings && !intel.findings.websiteWorks) {
    missing.push('Working website');
  }
  
  return missing.length > 0 ? missing : ['Additional personalization'];
}

  async createGmailDraft(emailData, intel) {
    try {
      const rawEmail = [
        `To: ${emailData.to}`,
        `Subject: ${emailData.subject}`,
        `Content-Type: text/html; charset=utf-8`,
        '',
        emailData.body
      ].join('\n');

      const encodedEmail = Buffer.from(rawEmail)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const response = await this.gmail.users.drafts.create({
        userId: 'me',
        requestBody: {
          message: {
            raw: encodedEmail
          }
        }
      });

      const draftId = response.data.id;
      
      this.sentEmails.drafts[emailData.to.toLowerCase()] = {
        draftId: draftId,
        createdAt: new Date().toISOString(),
        company: intel.prospect.company,
        name: intel.prospect.name,
        subject: emailData.subject,
        confidence: intel.confidence.score,
        needsReview: intel.confidence.score < 70
      };
      this.saveSentLog();

      return { success: true, draftId };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async processBatch() {
    console.log('ENHANCED GMAIL DRAFT SENDER');
    console.log('Creates drafts for HIGH (70+) and MEDIUM (50+) confidence prospects');
    console.log('='.repeat(70) + '\n');

    const connected = await this.setupGmailAPI();
    if (!connected) {
      this.rl.close();
      return;
    }

    const prospects = this.getQualifiedProspects();
    console.log(`Found ${prospects.length} qualified prospects (50+ confidence)\n`);

    if (prospects.length === 0) {
      console.log('No qualified prospects found.');
      this.rl.close();
      return;
    }

    // Categorize
    const high = prospects.filter(p => p.data.confidence.score >= 70);
    const medium = prospects.filter(p => p.data.confidence.score >= 50 && p.data.confidence.score < 70);

    console.log(`HIGH confidence (70+): ${high.length}`);
    console.log(`MEDIUM confidence (50-69): ${medium.length}\n`);

    // Filter already processed
    const toProcess = prospects.filter(p => {
      const email = p.data.prospect.email;
      if (this.isAlreadySent(email)) {
        this.stats.skipped++;
        return false;
      }
      if (this.hasDraft(email)) {
        this.stats.skipped++;
        return false;
      }
      return true;
    });

    console.log(`Already contacted/drafted: ${this.stats.skipped}`);
    console.log(`Ready to create drafts: ${toProcess.length}\n`);

    if (toProcess.length === 0) {
      console.log('All prospects already have drafts or were contacted!\n');
      this.rl.close();
      return;
    }

    // Create drafts
    for (let i = 0; i < toProcess.length; i++) {
      const prospect = toProcess[i];
      const intel = prospect.data;
      const score = intel.confidence.score;
      this.stats.total++;

      const tag = score >= 70 ? '✓ HIGH' : '⚠ MEDIUM';
      console.log(`[${i + 1}/${toProcess.length}] ${tag} - ${intel.prospect.company} (${score}/100)`);
      console.log(`  To: ${intel.prospect.email}`);

      const emailData = this.generateEmail(intel);
      const result = await this.createGmailDraft(emailData, intel);

      if (result.success) {
        this.stats.draftsCreated++;
        if (score >= 70) {
          this.stats.highConfidence++;
          console.log(`  ✓ Draft created - Ready to send after quick review`);
        } else {
          this.stats.mediumConfidence++;
          console.log(`  ✓ Draft created - [NEEDS REVIEW] tag added`);
        }
      } else {
        console.log(`  ✗ Failed: ${result.error}`);
      }

      await this.sleep(1000);
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('SUMMARY');
    console.log('='.repeat(70));
    console.log(`Total drafts created: ${this.stats.draftsCreated}`);
    console.log(`  ✓ HIGH confidence (70+): ${this.stats.highConfidence} - Quick review needed`);
    console.log(`  ⚠ MEDIUM confidence (50-69): ${this.stats.mediumConfidence} - Add 10-15 min research`);
    console.log(`Already processed: ${this.stats.skipped}`);
    console.log('\n' + '='.repeat(70));
    console.log('NEXT STEPS');
    console.log('='.repeat(70));
    console.log('1. Open Gmail: https://mail.google.com');
    console.log('2. Go to "Drafts" folder');
    console.log(`3. You'll see ${this.stats.draftsCreated} new drafts\n`);
    console.log('HIGH confidence drafts (no [NEEDS REVIEW] tag):');
    console.log('  → Verify news links');
    console.log('  → Check LinkedIn');
    console.log('  → Add personal touch');
    console.log('  → Send! ✓\n');
    console.log('MEDIUM confidence drafts ([NEEDS REVIEW] tag):');
    console.log('  → Yellow banner at top shows what\'s missing');
    console.log('  → Review [TODO] notes in email body');
    console.log('  → Spend 10-15 min on additional research');
    console.log('  → Strengthen personalization');
    console.log('  → Remove review banner and [NEEDS REVIEW] tag');
    console.log('  → Then send! ✓\n');
    console.log('TIP: Focus on HIGH confidence first, then tackle MEDIUM\n');

    this.rl.close();
  }

  async listDrafts() {
    console.log('\nCREATED DRAFTS');
    console.log('='.repeat(70) + '\n');

    if (Object.keys(this.sentEmails.drafts).length === 0) {
      console.log('No drafts created yet.\n');
      this.rl.close();
      return;
    }

    const entries = Object.entries(this.sentEmails.drafts)
      .sort((a, b) => new Date(b[1].createdAt) - new Date(a[1].createdAt));

    const high = entries.filter(([_, data]) => !data.needsReview);
    const medium = entries.filter(([_, data]) => data.needsReview);

    console.log(`Total drafts: ${entries.length}`);
    console.log(`  HIGH confidence: ${high.length}`);
    console.log(`  MEDIUM confidence (needs review): ${medium.length}\n`);

    if (high.length > 0) {
      console.log('HIGH CONFIDENCE - Quick review and send:\n');
      high.forEach(([email, data], i) => {
        console.log(`${i + 1}. ${data.company} - ${data.name}`);
        console.log(`   Email: ${email}`);
        console.log(`   Confidence: ${data.confidence}/100`);
        console.log(`   Subject: ${data.subject}\n`);
      });
    }

    if (medium.length > 0) {
      console.log('MEDIUM CONFIDENCE - Add 10-15 min research:\n');
      medium.forEach(([email, data], i) => {
        console.log(`${i + 1}. ${data.company} - ${data.name}`);
        console.log(`   Email: ${email}`);
        console.log(`   Confidence: ${data.confidence}/100`);
        console.log(`   Subject: ${data.subject}\n`);
      });
    }

    console.log('View in Gmail: https://mail.google.com/mail/u/0/#drafts\n');
    this.rl.close();
  }

  async promptUser(question) {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

async function main() {
  const sender = new EnhancedGmailDraftSender();
  const command = process.argv[2];

  if (command === 'create') {
    await sender.processBatch();
    
  } else if (command === 'list') {
    await sender.listDrafts();
    
  } else {
    console.log('\nENHANCED GMAIL DRAFT SENDER');
    console.log('Creates drafts for both HIGH and MEDIUM confidence prospects');
    console.log('='.repeat(70) + '\n');
    
    console.log('WHAT\'S NEW:');
    console.log('='.repeat(70));
    console.log('✓ Creates drafts for 50+ confidence (not just 70+)');
    console.log('✓ [NEEDS REVIEW] tag for medium confidence prospects');
    console.log('✓ Yellow banner shows what\'s missing');
    console.log('✓ [TODO] notes in email body for easy editing');
    console.log('✓ Clear guidance on which drafts need more work\n');
    
    console.log('COMMANDS:');
    console.log('='.repeat(70));
    console.log('  node gmail_draft_sender_enhanced.js create  - Create all drafts');
    console.log('  node gmail_draft_sender_enhanced.js list    - List created drafts\n');
    
    console.log('WORKFLOW:');
    console.log('='.repeat(70));
    console.log('1. Run: node gmail_draft_sender_enhanced.js create');
    console.log('2. Open Gmail → Drafts folder');
    console.log('3. HIGH confidence drafts (no tag):');
    console.log('   → Quick verify + personalize → Send ✓');
    console.log('4. MEDIUM confidence drafts ([NEEDS REVIEW] tag):');
    console.log('   → Yellow banner shows gaps');
    console.log('   → Add 10-15 min research');
    console.log('   → Complete [TODO] items');
    console.log('   → Remove banner + tag → Send ✓\n');

    sender.rl.close();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = EnhancedGmailDraftSender;