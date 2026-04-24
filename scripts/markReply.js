const connectDB = require('../config/database');
const Lead = require('../models/Lead');
const EmailLog = require('../models/EmailLog');

// Usage: node scripts/markReply.js <email> [class]
//   class: warm | soft_no | referral | auto_responder  (default: warm)
//
// Examples:
//   node scripts/markReply.js founder@acme.com
//   node scripts/markReply.js founder@acme.com soft_no
//   node scripts/markReply.js founder@acme.com warm

const STATUS_BY_CLASS = {
  warm: 'engaged',
  soft_no: 'unresponsive',
  referral: 'replied',
  auto_responder: 'contacted'
};

(async () => {
  const [, , emailArg, classArg = 'warm'] = process.argv;

  if (!emailArg) {
    console.error('Usage: node scripts/markReply.js <email> [warm|soft_no|referral|auto_responder]');
    process.exit(1);
  }

  if (!STATUS_BY_CLASS[classArg]) {
    console.error(`Invalid class: ${classArg}. Must be one of: ${Object.keys(STATUS_BY_CLASS).join(', ')}`);
    process.exit(1);
  }

  const email = emailArg.toLowerCase().trim();
  await connectDB();

  const lead = await Lead.findOne({ email });
  if (!lead) {
    console.error(`No lead found with email: ${email}`);
    process.exit(1);
  }

  const newStatus = STATUS_BY_CLASS[classArg];
  const before = {
    status: lead.status,
    reply_detected: lead.reply_detected,
    followup_stage: lead.followup_stage
  };

  // auto_responder keeps sequence going but pushes follow-up out
  if (classArg === 'auto_responder') {
    const pushDate = new Date();
    pushDate.setDate(pushDate.getDate() + 7);
    lead.followup_due_date = pushDate;
    await lead.save();
  } else {
    lead.reply_detected = true;
    lead.reply_detected_at = new Date();
    lead.status = newStatus;
    lead.reply_class = classArg;
    await lead.save();

    // Stop future follow-ups in the email log queue
    await EmailLog.updateMany(
      { lead_id: lead._id, status: 'queued' },
      { $set: { status: 'cancelled' } }
    );
  }

  console.log(`Updated ${email}:`);
  console.log(`  status:          ${before.status} -> ${lead.status}`);
  console.log(`  reply_detected:  ${before.reply_detected} -> ${lead.reply_detected}`);
  console.log(`  reply_class:     ${classArg}`);
  console.log(`  company:         ${lead.company}`);

  if (classArg === 'warm') {
    console.log('\nThis was a warm lead. Reach out directly from your inbox.');
  } else if (classArg === 'referral') {
    console.log('\nRemember to create a new lead for the referred contact if relevant.');
  }

  process.exit(0);
})();
