/**
 * Manual end-to-end test.
 *
 * Two recipients in one run:
 *   1. davidariyo109@gmail.com — full 4-stage sequence; verify threading and
 *      inbox placement in Gmail.
 *   2. test-9o4d1hsmg@srv1.mail-tester.com — initial only; mail-tester scores
 *      the first email it receives, no value in sending followups.
 *
 * Test leads are recreated each run (prior records with same email deleted)
 * so we always start from a clean slate.
 */
require('dotenv').config();
const connectDB = require('../config/database');
const Lead = require('../models/Lead');
const emailService = require('../services/emailService');

const STAGE_PAUSE_MS = 8000; // pause between stages so emails arrive in order

const recipients = [
  {
    label: 'danica (full sequence — threading verification)',
    stages: [1, 2, 3, 4],
    lead: {
      first_name: 'Danica',
      last_name: 'Patrick',
      email: 'danicapatrickk8@gmail.com',
      title: 'Founder',
      company: 'traxx',
      country: 'United States',
      industry: '',
      metadata: {
        website: 'traxx.eu.com'
      },
      source: 'manual',
      status: 'new',
      followup_stage: 0,
      reply_detected: false,
      emails_sent: 0
    }
  }
];

async function runRecipient(r) {
  console.log(`\n${'#'.repeat(60)}\n# ${r.label}: ${r.lead.email}\n${'#'.repeat(60)}`);

  const removed = await Lead.deleteOne({ email: r.lead.email });
  if (removed.deletedCount) console.log('(cleared prior test record)');

  let lead = await Lead.create(r.lead);
  console.log(`Lead seeded: ${lead.email}`);

  for (const stage of r.stages) {
    console.log(`\n  STAGE ${stage} (${({1:'initial',2:'followup_1',3:'followup_2',4:'followup_3'}[stage])})`);
    lead = await Lead.findById(lead._id); // refetch — picks up last_message_id, references_chain
    try {
      await emailService.sendEmail(lead, stage);
      console.log(`  ✓ stage ${stage} sent`);
    } catch (err) {
      console.error(`  ✗ stage ${stage} failed: ${err.message}`);
      return;
    }
    if (stage !== r.stages[r.stages.length - 1]) {
      await new Promise(res => setTimeout(res, STAGE_PAUSE_MS));
    }
  }

  const final = await Lead.findById(lead._id).lean();
  console.log(`\n  → final: stage=${final.followup_stage}, sends=${final.emails_sent}`);
  console.log(`  → custom_line: ${final.metadata.custom_line ? '"' + final.metadata.custom_line + '"' : '(empty)'}`);
  console.log(`  → references_chain length: ${(final.references_chain || '').split(' ').filter(Boolean).length} ids`);
}

(async () => {
  await connectDB();
  await emailService.initialize();
  for (const r of recipients) {
    await runRecipient(r);
  }
  console.log(`\n${'='.repeat(60)}\nAll tests dispatched.`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
