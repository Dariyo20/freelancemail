const { Resend } = require('resend');
const connectDB = require('../config/database');
const templateService = require('../services/templateService');
const emailService = require('../services/emailService');
require('dotenv').config();

// Sends the real initial template (randomly picked from DB) to your own
// inboxes + mail-tester so you can see exactly where it lands and get
// a deliverability score. Uses the same code path production sends use.

const TEST_RECIPIENTS = [
  'musicworldyb1@gmail.com',
  'davidariyo109@gmail.com',
  'test-hic8kdvaq@srv1.mail-tester.com'
];

// Fake lead used purely for token personalization (no DB writes)
const FAKE_LEAD = {
  first_name: 'Dave',
  last_name: 'Ariyo',
  company: 'Striat',
  industry: 'software',
  title: 'Founder'
};

(async () => {
  console.log('Self-send deliverability test\n');

  if (!process.env.RESEND_API_KEY) {
    console.error('Missing RESEND_API_KEY');
    process.exit(1);
  }

  await connectDB();

  const fromEmail = process.env.FROM_EMAIL || 'dave@striat.dev';
  const resend = new Resend(process.env.RESEND_API_KEY);

  // Pull a random initial template so we test what leads actually get
  const tpl = await templateService.getTemplate('initial');
  const subject = templateService.personalize(tpl.subject, FAKE_LEAD);
  const body = templateService.personalize(tpl.body, FAKE_LEAD);
  const html = emailService.textToHtml(body);

  console.log(`From:     ${fromEmail}`);
  console.log(`Template: ${tpl.template_name}`);
  console.log(`Subject:  ${subject}\n`);
  console.log('--- Body preview ---');
  console.log(body);
  console.log('--------------------\n');

  let ok = 0;
  for (const to of TEST_RECIPIENTS) {
    try {
      const res = await resend.emails.send({
        from: fromEmail,
        to,
        subject,
        html,
        reply_to: fromEmail
      });
      if (res.error) {
        console.error(`FAIL  ${to}: ${res.error.message || JSON.stringify(res.error)}`);
      } else {
        console.log(`SENT  ${to}  (id: ${res.data?.id})`);
        ok++;
      }
    } catch (err) {
      console.error(`ERROR ${to}: ${err.message}`);
    }
    // Small delay between sends to avoid hitting any burst limit
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`\n${ok}/${TEST_RECIPIENTS.length} sent`);
  console.log('\nNext:');
  console.log('  - Check each inbox: Inbox vs Spam vs Promotions');
  console.log('  - Mail-tester report: https://www.mail-tester.com/test-hic8kdvaq');
  console.log('  - Resend logs: https://resend.com/emails');

  process.exit(ok === TEST_RECIPIENTS.length ? 0 : 1);
})();
