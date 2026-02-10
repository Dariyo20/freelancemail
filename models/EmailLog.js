const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema({
  lead_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    required: true
  },
  lead_email: {
    type: String,
    required: true
  },
  lead_name: String,
  company: String,
  
  // Email content
  subject: {
    type: String,
    required: true
  },
  body: {
    type: String,
    required: true
  },
  template_used: String,
  
  // Send details
  sent_at: {
    type: Date,
    default: Date.now
  },
  message_id: String, // Gmail message ID
  thread_id: String, // Gmail thread ID
  
  // Follow-up tracking
  followup_stage: {
    type: Number,
    required: true,
    default: 1 // 1 = initial, 2 = followup1, 3 = followup2, 4 = followup3
  },
  followup_scheduled_for: Date,
  
  // Status
  status: {
    type: String,
    enum: ['sent', 'failed', 'bounced', 'replied'],
    default: 'sent'
  },
  
  // Tracking
  opened: {
    type: Boolean,
    default: false
  },
  opened_at: Date,
  clicked: {
    type: Boolean,
    default: false
  },
  clicked_at: Date,
  replied: {
    type: Boolean,
    default: false
  },
  replied_at: Date,
  
  // Error handling
  error_message: String,
  
  // Campaign
  campaign_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign'
  }
}, {
  timestamps: true
});

// Indexes
emailLogSchema.index({ lead_id: 1 });
emailLogSchema.index({ sent_at: -1 });
emailLogSchema.index({ status: 1 });
emailLogSchema.index({ followup_stage: 1 });
emailLogSchema.index({ replied: 1 });

module.exports = mongoose.model('EmailLog', emailLogSchema);
