# GitHub Actions Setup - Zero Manual Effort! 🚀

## What This Does
- Runs **automatically** 5 times per day (Nigeria time)
- **FREE** (2000 minutes/month free tier)
- Works **24/7** without your PC running
- **ZERO manual effort** after setup

## Schedule (Nigeria Time - WAT)
- 9:00 AM - 20 emails
- 10:30 AM - 20 emails
- 12:00 PM - 20 emails
- 2:00 PM - 20 emails
- 4:00 PM - 20 emails

**Total:** 100 emails/day automatically!

---

## Setup Steps (One-Time, 5 Minutes)

### 1. Add Secrets to GitHub

Go to: https://github.com/Dariyo20/freelancemail/settings/secrets/actions

Click **"New repository secret"** and add these **5 secrets**:

Copy the values from your `.env` file:

| Secret Name | Where to Find Value |
|------------|---------------------|
| `MONGODB_URI` | Copy from `.env` file (MONGODB_URI=...) |
| `EMAIL_USER` | Copy from `.env` file (EMAIL_USER=...) |
| `EMAIL_PASSWORD` | Copy from `.env` file (EMAIL_PASSWORD=...) |
| `GROQ_API_KEY` | Copy from `.env` file (GROQ_API_KEY=...) |
| `GEMINI_API_KEY` | Copy from `.env` file (GEMINI_API_KEY=...) |

### 2. Push Workflow to GitHub

In your terminal, run:
```bash
git add .github/workflows/send-emails.yml
git commit -m "Add GitHub Actions automation"
git push origin main
```

### 3. Enable GitHub Actions

Go to: https://github.com/Dariyo20/freelancemail/actions

If you see a button **"I understand my workflows, go ahead and enable them"**, click it.

---

## That's It! ✅

The system will now:
- ✅ Run automatically 5 times per day (Nigeria time)
- ✅ Send 100 emails per day
- ✅ Track everything in MongoDB
- ✅ Auto follow-ups on Day 3, 6, 13
- ✅ Stop when people reply
- ✅ Work even when your PC is OFF

---

## Monitoring

### View Logs
Go to: https://github.com/Dariyo20/freelancemail/actions

Click on any run to see:
- How many emails sent
- Any errors
- Full execution logs

### Manual Trigger (Optional)
You can also trigger a run manually:
1. Go to: https://github.com/Dariyo20/freelancemail/actions
2. Click "Automated Email Sending" workflow
3. Click "Run workflow" → "Run workflow"

---

## Benefits Over Render/Local

| Feature | GitHub Actions | Render | Local |
|---------|---------------|--------|-------|
| **Cost** | FREE (2000 min/month) | FREE (750 hrs/month) | FREE |
| **PC Must Run** | ❌ NO | ❌ NO | ✅ YES |
| **Setup Difficulty** | Easy | Easy | Easy |
| **Runs When** | Scheduled | Always | When PC on |
| **Best For** | **Scheduled tasks** | Always-on workers | Testing |

---

## Why This is Better

✅ **No PC needed** - Works 24/7 even when you're offline
✅ **Free forever** - 2000 minutes = ~33 hours (way more than you need)
✅ **Zero maintenance** - Set it and forget it
✅ **Perfect for schedules** - Runs exactly at Nigeria time
✅ **Easy monitoring** - See logs in GitHub UI
✅ **Reliable** - GitHub's servers are super stable

---

## Next Steps

1. Add the 5 secrets to GitHub (link above)
2. Push this workflow file
3. Done! First run tomorrow at 9am WAT

The entire 406 leads will be contacted in 4-5 days automatically!
