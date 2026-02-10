const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const Lead = require('./models/Lead');
const EmailLog = require('./models/EmailLog');
const Template = require('./models/Template');
const Campaign = require('./models/Campaign');
const emailService = require('./services/emailService');
const replyDetectionService = require('./services/replyDetectionService');
const leadImporter = require('./services/leadImporter');
const templateService = require('./services/templateService');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==================== DASHBOARD API ROUTES ====================

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics
 */
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const [
      totalLeads,
      newLeads,
      contacted,
      replied,
      emailsSentToday,
      emailsSentTotal,
      replyRate
    ] = await Promise.all([
      Lead.countDocuments(),
      Lead.countDocuments({ status: 'new' }),
      Lead.countDocuments({ status: { $in: ['contacted', 'followup_1', 'followup_2', 'followup_3'] } }),
      Lead.countDocuments({ reply_detected: true }),
      EmailLog.countDocuments({
        sent_at: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      }),
      EmailLog.countDocuments({ status: 'sent' }),
      Lead.countDocuments({ followup_stage: { $gte: 1 } })
    ]);
    
    // Calculate reply rate
    const repliedCount = await Lead.countDocuments({ reply_detected: true });
    const contactedCount = await Lead.countDocuments({ emails_sent: { $gte: 1 } });
    const replyRatePercent = contactedCount > 0 ? ((repliedCount / contactedCount) * 100).toFixed(1) : 0;
    
    res.json({
      totalLeads,
      newLeads,
      contacted,
      replied,
      emailsSentToday,
      emailsSentTotal,
      replyRate: parseFloat(replyRatePercent),
      leadsInFollowup: contacted - replied
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/leads
 * Get all leads with pagination and filters
 */
app.get('/api/leads', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      status,
      reply_detected,
      search
    } = req.query;
    
    const query = {};
    
    if (status) query.status = status;
    if (reply_detected !== undefined) query.reply_detected = reply_detected === 'true';
    if (search) {
      query.$or = [
        { first_name: new RegExp(search, 'i') },
        { last_name: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { company: new RegExp(search, 'i') }
      ];
    }
    
    const leads = await Lead.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-__v');
    
    const total = await Lead.countDocuments(query);
    
    res.json({
      leads,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/leads/:id
 * Get single lead with email history
 */
app.get('/api/leads/:id', async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    const emails = await EmailLog.find({ lead_id: lead._id })
      .sort({ sent_at: -1 });
    
    res.json({ lead, emails });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/leads/:id/reply
 * Manually mark lead as replied
 */
app.put('/api/leads/:id/reply', async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    await replyDetectionService.manualMarkAsReplied(lead.email);
    
    res.json({ success: true, message: 'Lead marked as replied' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/leads/:id/status
 * Update lead status
 */
app.put('/api/leads/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    res.json({ success: true, lead });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/emails
 * Get email logs
 */
app.get('/api/emails', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    
    const emails = await EmailLog.find()
      .sort({ sent_at: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('lead_id', 'first_name last_name email company');
    
    const total = await EmailLog.countDocuments();
    
    res.json({
      emails,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/recent-replies
 * Get recent replies
 */
app.get('/api/recent-replies', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const replies = await replyDetectionService.getRecentReplies(parseInt(days));
    res.json({ replies });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/import
 * Import leads from CSV
 */
app.post('/api/import', async (req, res) => {
  try {
    const { filename } = req.body;
    
    if (!filename) {
      return res.status(400).json({ error: 'Filename required' });
    }
    
    const stats = await leadImporter.importCSV(filename);
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/import/all
 * Import all CSVs
 */
app.post('/api/import/all', async (req, res) => {
  try {
    const stats = await leadImporter.importAllCSVs();
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/email/send
 * Manually send email to a lead
 */
app.post('/api/email/send', async (req, res) => {
  try {
    const { leadId, stage = 1 } = req.body;
    
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    if (lead.reply_detected) {
      return res.status(400).json({ error: 'Lead has already replied' });
    }
    
    const result = await emailService.sendEmail(lead, stage);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/email/process-queue
 * Manually trigger email queue processing
 */
app.post('/api/email/process-queue', async (req, res) => {
  try {
    const { maxEmails = 20 } = req.body;
    const stats = await emailService.processQueue(maxEmails);
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/replies/check
 * Manually trigger reply detection
 */
app.post('/api/replies/check', async (req, res) => {
  try {
    const stats = await replyDetectionService.checkForReplies();
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/templates
 * Get all templates
 */
app.get('/api/templates', async (req, res) => {
  try {
    const templates = await templateService.getAllTemplates();
    res.json({ templates });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== HEALTH CHECK ====================

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // Connect to database
    await connectDB();
    
    // Seed templates
    await templateService.seedTemplates();
    
    // Initialize services
    await emailService.initialize();
    await replyDetectionService.initialize();
    
    // Start server
    app.listen(PORT, () => {
      console.log(`\n✅ Server running on http://localhost:${PORT}`);
      console.log(`\n📊 Dashboard API available at:`);
      console.log(`   GET  /api/dashboard/stats`);
      console.log(`   GET  /api/leads`);
      console.log(`   GET  /api/emails`);
      console.log(`   POST /api/import/all`);
      console.log(`   POST /api/email/process-queue`);
      console.log(`   POST /api/replies/check\n`);
    });
    
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();

module.exports = app;
