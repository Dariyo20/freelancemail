# Deployment Options - Run 24/7 Without Your PC

## ❌ Current Problem
- System runs on your local PC
- **Stops when PC shuts down**
- Requires PC on 24/7 for automation

## ✅ Solutions (Ranked by Ease)

### 🥇 Option 1: Railway (Easiest - FREE)

**Cost:** Free tier available  
**Time:** 10 minutes

**Steps:**
```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login to Railway
railway login

# 3. Initialize project
railway init

# 4. Deploy
railway up

# 5. Add environment variables in Railway dashboard
# Copy your .env values to Railway
```

**Pros:**
- ✅ Free tier
- ✅ Auto-restart on crash
- ✅ Works 24/7
- ✅ Easy deployment

**Cons:**
- Limited free hours (500hrs/month - enough for 24/7)

---

### 🥈 Option 2: DigitalOcean Droplet

**Cost:** $6/month (cheapest)  
**Time:** 30 minutes

**Steps:**
1. Create $6/month droplet (Ubuntu)
2. SSH into server
3. Install Node.js & MongoDB
4. Clone your repo
5. Setup PM2 (keeps app running)
6. Configure

```bash
# On server
git clone your-repo
cd lead-automation
npm install
npm install -g pm2
pm2 start worker.js
pm2 startup
pm2 save
```

**Pros:**
- ✅ Full control
- ✅ Runs forever
- ✅ Cheap

**Cons:**
- Requires basic Linux knowledge

---

### 🥉 Option 3: Heroku

**Cost:** $7/month (Eco Dynos)  
**Time:** 15 minutes

**Steps:**
```bash
# Install Heroku CLI
npm install -g heroku

# Login
heroku login

# Create app
heroku create your-app-name

# Add MongoDB addon
heroku addons:create mongodb-atlas

# Deploy
git push heroku main

# Set environment variables
heroku config:set EMAIL_USER=your-email@gmail.com
heroku config:set EMAIL_PASSWORD=your-password
```

**Pros:**
- ✅ Simple deployment
- ✅ Auto-scaling
- ✅ Reliable

**Cons:**
- Costs $7/month
- Sleep after 30min inactivity on free tier

---

### 🏠 Option 4: Keep PC On (Not Recommended)

**Cost:** Free (but electricity costs)  
**Time:** 5 minutes

**Setup:**
1. Disable sleep mode
2. Run worker on startup

**Windows Task Scheduler:**
```powershell
# Create startup task
$action = New-ScheduledTaskAction -Execute "npm" -Argument "run worker" -WorkingDirectory "C:\Users\DELLO\Downloads\lead-automation"
$trigger = New-ScheduledTaskTrigger -AtStartup
Register-ScheduledTask -TaskName "LeadAutomation" -Action $action -Trigger $trigger -RunLevel Highest
```

**Pros:**
- ✅ Free
- ✅ Full control

**Cons:**
- ❌ High electricity cost
- ❌ PC noise/heat
- ❌ Stops during power outages
- ❌ Can't restart PC
- ❌ Not reliable

---

### 🔧 Option 5: VPS (Contabo/Vultr)

**Cost:** $3-5/month  
**Time:** 30 minutes

Similar to DigitalOcean but cheaper.

**Providers:**
- Contabo: $3/month
- Vultr: $5/month
- Linode: $5/month

---

## 🎯 My Recommendation

**For you: Railway (Option 1)**

Why?
- ✅ FREE
- ✅ Easiest to setup
- ✅ Works 24/7
- ✅ No server management
- ✅ Auto-restart on crashes

**In 5 minutes you'll have:**
- System running in cloud
- PC can shutdown
- Emails send automatically
- Zero manual effort

---

## 🚀 Quick Start Guide (Railway)

### 1. Sign up
Visit: https://railway.app

### 2. Install CLI
```bash
npm install -g @railway/cli
```

### 3. Deploy
```bash
railway login
railway init
railway up
```

### 4. Add Environment Variables
In Railway dashboard, add:
- `MONGODB_URI` (your MongoDB Atlas connection)
- `EMAIL_USER`
- `EMAIL_PASSWORD`
- All other vars from your .env

### 5. Start Worker
In Railway dashboard:
- Set start command: `npm run worker`

**Done!** System runs 24/7 in the cloud.

---

## ⚡ Want me to help you deploy to Railway right now?

I can guide you through the deployment step-by-step.
