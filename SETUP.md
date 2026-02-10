# 🚀 Quick Setup Guide

## 1️⃣ Install MongoDB

### Option A: Local MongoDB (Recommended for Dev)
1. Download: https://www.mongodb.com/try/download/community
2. Install with default settings
3. MongoDB runs on `mongodb://localhost:27017`

### Option B: MongoDB Atlas (Cloud - Free Tier)
1. Sign up: https://www.mongodb.com/cloud/atlas/register
2. Create free cluster
3. Get connection string
4. Update `.env` with your connection string

## 2️⃣ Configure Gmail

### Get Gmail App Password
1. Go to: https://myaccount.google.com/apppasswords
2. Sign in to your Google Account
3. Generate app password for "Mail"
4. Copy the 16-character password

### Update .env
```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=xxxx-xxxx-xxxx-xxxx  # Your app password
```

## 3️⃣ Gmail API Setup (Optional - For Reply Detection)

### If you want automatic reply detection:

1. **Enable Gmail API**
   - Go to: https://console.cloud.google.com/
   - Create new project or select existing
   - Enable Gmail API
   - Create OAuth 2.0 credentials (Desktop app)

2. **Download Credentials**
   - Download JSON file
   - Rename to `gmail_credentials.json`
   - Place in project root

3. **First-time Auth**
   ```bash
   node scripts/gmailAuth.js
   ```
   - Browser opens
   - Sign in to Google
   - Grant permissions
   - Token saved as `gmail_token.json`

### If you skip this:
- Reply detection won't work automatically
- You can manually mark leads as replied via API
- Email sending still works via SMTP

## 4️⃣ Test the System

### Import your CSV
```bash
npm run import
```

### Send test emails (dry run first)
Edit [emailService.js](services/emailService.js) and set `DRY_RUN = true` for testing

### Start the server
```bash
npm start
```

### Or start automation worker
```bash
npm run worker
```

## 5️⃣ Verify Setup

### Check MongoDB Connection
```bash
node -e "require('./config/database')().then(() => console.log('✓ DB Connected')).catch(e => console.log('✗ Failed:', e.message))"
```

### Check Email Config
Visit: http://localhost:3000/health after running `npm start`

## 📋 Next Steps

1. Drop CSV in `csv/` folder
2. Run `npm run import`
3. Check database: http://localhost:3000/api/leads
4. Send test email: `npm run send-emails`
5. Monitor via API or setup dashboard

## ⚠️ Important

- Never commit `.env`, `gmail_credentials.json`, `gmail_token.json`
- Use Gmail App Password (not your real password)
- Test with small batch first (5-10 emails)
- Check spam folder if emails don't arrive

## 🆘 Troubleshooting

**MongoDB won't connect:**
- Is MongoDB running? Check Task Manager
- Try: `net start MongoDB` (Windows)

**Email won't send:**
- Check App Password is correct
- Enable "Less secure app access" might be needed
- Check Gmail sending limits (500/day)

**Reply detection not working:**
- Make sure `gmail_credentials.json` exists
- Re-run auth: `node scripts/gmailAuth.js`
- Check token expiry

## 🎯 Ready to Use!

Everything is configured. Just:
1. Update `.env` with your credentials
2. Install MongoDB
3. Run `npm start` or `npm run worker`
