# Striat Dollar Pipeline

Studio client acquisition automation. Sends production-MVP offers to seed/Series A founders in US/UK/CA/AU/BR markets.

## Features

- **CSV Import** - Import leads from Apollo (or any CSV) with deduplication
- **Template Engine** - Random subject/body rotation with personalization tokens
- **3-Touch Sequence** - Initial (Day 0), Follow-up 1 (Day 5), Follow-up 2 / Final (Day 12)
- **Reply Detection** - Gmail API integration to stop sequences when leads reply
- **Reply Classifier** - Keyword-based classification: auto_responder, soft_no, warm, referral
- **Smart Reply Handling** - Auto-responders delay sequence, warm leads alert Dave, referrals create new leads
- **Resend Integration** - Email sending via Resend API (replaces Gmail SMTP)
- **Automation Worker** - Cron scheduler targeting US East / UK inbox windows (Mon-Thu)
- **REST API** - Dashboard endpoints for metrics, leads, emails
- **MongoDB** - Models for Leads, EmailLogs, Templates, Campaigns

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file:

```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/lead-automation

# Resend
RESEND_API_KEY=re_your_resend_api_key

# Sender
FROM_EMAIL=dave@striat.dev

# Alerts
ALERT_EMAIL=davidariyo109@gmail.com

# Server
PORT=3000
```

### Gmail Setup (for reply detection)

1. Enable Gmail API: https://console.cloud.google.com/
2. Download `gmail_credentials.json` to project root
3. Run auth flow to generate `gmail_token.json`

## Usage

### 1. Start API Server

```bash
npm start
```

Server runs on http://localhost:3000

### 2. Start Automation Worker

```bash
npm run worker
```

Scheduled tasks:
- **8am Mon-Fri WAT**: Import CSVs
- **11am, 2pm, 7pm, 9pm WAT Mon-Thu**: Send emails (targets 6am/8am/1pm/3pm EST)
- **Every hour 9am-10pm WAT Mon-Fri**: Check for replies
- **2am Sundays**: Database cleanup

### 3. Manual Scripts

```bash
npm run import          # Import leads from CSV
npm run send-emails     # Send emails manually
npm run check-replies   # Check for replies
```

## Email Sequence

1. **Day 0** - Initial (production MVP offer)
2. **Day 5** - Follow-up 1 (direct value, yes/no questions)
3. **Day 12** - Follow-up 2 / Final (open door, no apology)

Stops if reply detected at any stage.

## Reply Classification

| Class | Action | Alert? |
|-------|--------|--------|
| auto_responder | Push follow-up +7 days, sequence continues | No |
| soft_no | Mark unresponsive, stop sequence | No |
| warm | Mark engaged, stop sequence | Yes |
| referral | Mark replied, create new lead from parsed email | Yes |

## Personalization Tokens

- `{{first_name}}`, `{{last_name}}`, `{{company}}`, `{{industry}}`, `{{title}}`
- `{{currentQuarter}}`, `{{nextQuarter}}`

## API Endpoints

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

## Security

- Never commit `.env`, `.env.local`, `gmail_credentials.json`, `gmail_token.json`
- Keep MongoDB connection string secure
- RESEND_API_KEY must stay out of version control

## License

ISC
