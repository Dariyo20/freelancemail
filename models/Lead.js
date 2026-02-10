const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  first_name: {
    type: String,
    required: true,
    trim: true
  },
  last_name: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  company: {
    type: String,
    required: true,
    trim: true
  },
  industry: {
    type: String,
    trim: true
  },
  title: String,
  source: {
    type: String,
    default: 'apollo_csv',
    enum: ['apollo_csv', 'linkedin', 'scraper', 'manual', 'api']
  },
  status: {
    type: String,
    default: 'new',
    enum: ['new', 'contacted', 'followup_1', 'followup_2', 'followup_3', 'replied', 'engaged', 'unresponsive', 'unsubscribed']
  },
  last_contacted_at: Date,
  reply_detected: {
    type: Boolean,
    default: false
  },
  reply_detected_at: Date,
  followup_stage: {
    type: Number,
    default: 0, // 0 = not contacted, 1 = initial, 2 = followup1, 3 = followup2, 4 = followup3
    min: 0,
    max: 4
  },
  followup_due_date: Date,
  thread_id: String, // Gmail thread ID for reply detection
  last_message_id: String, // Gmail message ID
  
  // Campaign tracking
  campaign_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign'
  },
  
  // Additional metadata
  metadata: {
    phone: String,
    linkedin_url: String,
    website: String,
    employee_count: String,
    location: String
  },
  
  // Tracking
  emails_sent: {
    type: Number,
    default: 0
  },
  last_email_subject: String,
  notes: String,
  
  // Timestamps
  imported_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
leadSchema.index({ email: 1 });
leadSchema.index({ status: 1 });
leadSchema.index({ followup_due_date: 1 });
leadSchema.index({ reply_detected: 1 });
leadSchema.index({ company: 1 });

// Virtual for full name
leadSchema.virtual('full_name').get(function() {
  return `${this.first_name} ${this.last_name || ''}`.trim();
});

module.exports = mongoose.model('Lead', leadSchema);
