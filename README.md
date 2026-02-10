# Lead Automation System

Complete outreach + email automation + lead handling system for freelance/agency client acquisition.

## 🎯 Features

- ✅ **CSV Import** - Import leads from Apollo (or any CSV) with deduplication
- ✅ **Template Engine** - Random subject/body rotation with personalization
- ✅ **3-Stage Follow-ups** - Auto follow-up on Day 3, 6, 13
- ✅ **Reply Detection** - Gmail API integration to stop sequences when leads reply
- ✅ **Email Service** - Gmail API + SMTP fallback
- ✅ **Automation Worker** - Scheduled tasks via cron (Mon-Fri business hours)
- ✅ **REST API** - Dashboard endpoints for metrics, leads, emails
- ✅ **MongoDB** - Proper database with models for Leads, EmailLogs, Templates, Campaigns

## 📦 Installation

```bash
npm install
```

## ⚙️ Configuration

Create a `.env` file:

```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/lead-automation

# Email (Gmail)
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# Server
PORT=3000
```

### Gmail Setup

1. Enable Gmail API: https://console.cloud.google.com/
2. Download `gmail_credentials.json` to project root
3. Run auth flow to generate `gmail_token.json`

## 🚀 Usage

### 1. Start API Server

```bash
npm start
```

Server runs on http://localhost:3000

### 2. Start Automation Worker

```bash
npm run worker
```

Runs scheduled tasks:
- **8am Mon-Fri**: Import CSVs
- **9am, 11am, 1pm, 3pm, 5pm Mon-Fri**: Send emails
- **Every hour 9am-6pm Mon-Fri**: Check for replies
- **2am Sundays**: Database cleanup

### 3. Manual Scripts

**Import leads from CSV:**
```bash
npm run import
```

**Send emails manually:**
```bash
npm run send-emails
```

**Check for replies:**
```bash
npm run check-replies
```

## 📁 Project Structure

```
lead-automation/
├── config/
│   └── database.js          # MongoDB connection
├── models/
│   ├── Lead.js              # Lead schema
│   ├── EmailLog.js          # Email log schema
│   ├── Template.js          # Template schema
│   └── Campaign.js          # Campaign schema
├── services/
│   ├── templateService.js   # Template rotation & personalization
│   ├── emailService.js      # Email sending (Gmail API + SMTP)
│   ├── replyDetectionService.js  # Gmail reply checking
│   ├── leadImporter.js      # CSV import with deduplication
│   └── automationWorker.js  # Cron scheduler
├── scripts/
│   ├── importLeads.js       # Manual import script
│   ├── sendEmails.js        # Manual send script
│   └── checkReplies.js      # Manual reply check script
├── csv/                     # Drop CSV files here
├── processed/               # Processed CSVs moved here
├── server.js                # Express API server
├── worker.js                # Worker entry point
└── package.json
```

## 🔄 Workflow

1. **Drop CSV** in `csv/` folder (Apollo export format)
2. **Worker imports** leads at 8am daily (or run `npm run import`)
3. **System sends** initial emails to new leads
4. **Follow-ups scheduled** automatically (Day 3, 6, 13)
5. **Reply detection** checks Gmail threads hourly
6. **Sequences stop** when reply detected
7. **You handle** conversations manually

## 📊 API Endpoints

### Dashboard
- `GET /api/dashboard/stats` - Overall statistics
- `GET /api/leads` - List leads (pagination, filters)
- `GET /api/leads/:id` - Single lead with email history
- `GET /api/emails` - Email logs
- `GET /api/recent-replies` - Recent replies

### Actions
- `POST /api/import/all` - Import all CSVs
- `POST /api/email/process-queue` - Send emails manually
- `POST /api/replies/check` - Check for replies
- `PUT /api/leads/:id/reply` - Mark lead as replied
- `PUT /api/leads/:id/status` - Update lead status

## 🗄️ Database Schema

### Lead
```javascript
{
  first_name, last_name, email, company, industry, title,
  status: 'new' | 'contacted' | 'followup_1' | 'followup_2' | 'followup_3' | 'replied' | 'engaged' | 'unsubscribed',
  followup_stage: 0-4,
  followup_due_date: Date,
  reply_detected: Boolean,
  last_contacted_at: Date,
  thread_id: String (Gmail),
  emails_sent: Number
}
```

### EmailLog
```javascript
{
  lead_id, subject, body, template_used,
  sent_at, message_id, thread_id,
  followup_stage: 1-4,
  status: 'sent' | 'failed' | 'bounced' | 'replied',
  replied: Boolean
}
```

## 🎯 Follow-up Sequence

1. **Day 0** - Initial email (personalized pitch)
2. **Day 3** - Follow-up 1 (soft nudge: "Just checking in")
3. **Day 6** - Follow-up 2 (medium intent: "Still available")
4. **Day 13** - Follow-up 3 (light close: "Keep me in mind")

**Stops if reply detected at any stage.**

## 📝 Templates

Default templates seed automatically. Each stage has multiple subject/body variations that rotate randomly.

Personalization tokens:
- `{{first_name}}`
- `{{last_name}}`
- `{{company}}`
- `{{industry}}`
- `{{title}}`

## 🔐 Security Notes

- Never commit `.env`, `gmail_credentials.json`, `gmail_token.json`
- Use Gmail App Passwords (not your actual password)
- Keep MongoDB connection string secure

## 🚧 Future Enhancements

- [ ] Web dashboard (Next.js)
- [ ] LinkedIn enrichment API
- [ ] Email scraping APIs
- [ ] Multiple inbox rotation
- [ ] Domain warmup
- [ ] Open/click tracking
- [ ] AI reply classification

## 📄 License

ISC
