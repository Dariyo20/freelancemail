const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  
  // Campaign settings
  status: {
    type: String,
    enum: ['active', 'paused', 'completed'],
    default: 'active'
  },
  
  // Follow-up timing (in days)
  followup_delays: {
    followup_1: { type: Number, default: 3 }, // Day 3
    followup_2: { type: Number, default: 6 }, // Day 6 (3 days after followup 1)
    followup_3: { type: Number, default: 7 }  // Day 7 (7 days after followup 2)
  },
  
  // Templates to use
  templates: {
    initial: { type: mongoose.Schema.Types.ObjectId, ref: 'Template' },
    followup_1: { type: mongoose.Schema.Types.ObjectId, ref: 'Template' },
    followup_2: { type: mongoose.Schema.Types.ObjectId, ref: 'Template' },
    followup_3: { type: mongoose.Schema.Types.ObjectId, ref: 'Template' }
  },
  
  // Stats
  stats: {
    total_leads: { type: Number, default: 0 },
    emails_sent: { type: Number, default: 0 },
    replies: { type: Number, default: 0 },
    reply_rate: { type: Number, default: 0 },
    engaged: { type: Number, default: 0 }
  },
  
  // Dates
  started_at: Date,
  completed_at: Date
}, {
  timestamps: true
});

module.exports = mongoose.model('Campaign', campaignSchema);
