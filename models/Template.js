const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['initial', 'followup_1', 'followup_2', 'followup_3'],
    required: true
  },
  
  // Subject pool (rotate randomly)
  subjects: [{
    type: String,
    trim: true
  }],
  
  // Body variations (rotate randomly)
  bodies: [{
    type: String,
    trim: true
  }],
  
  // Metadata
  active: {
    type: Boolean,
    default: true
  },
  
  // Usage stats
  times_used: {
    type: Number,
    default: 0
  },
  last_used_at: Date,
  
  // Performance tracking
  reply_rate: {
    type: Number,
    default: 0
  },
  total_sent: {
    type: Number,
    default: 0
  },
  total_replies: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Template', templateSchema);
