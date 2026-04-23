const { Resend } = require('resend');
require('dotenv').config();

(async () => {
  const from = process.env.FROM_EMAIL;
  const to = process.env.ALERT_EMAIL;
  const apiKey = process.env.RESEND_API_KEY;

  console.log('Alert deliverability test');
  console.log(`   FROM:         ${from}`);
  console.log(`   ALERT_EMAIL:  ${to}`);
  console.log(`   RESEND_KEY:   ${apiKey ? apiKey.slice(0, 8) + '...' : '(missing)'}\n`);

  if (!from || !to || !apiKey) {
    console.error('Missing FROM_EMAIL, ALERT_EMAIL, or RESEND_API_KEY in .env');
    process.exit(1);
  }

  const resend = new Resend(apiKey);
  const stamp = new Date().toISOString();

  const samples = [
    {
      label: 'warm lead alert',
      subject: `WARM LEAD: Test Founder at Test Co is engaged`,
      text: `This is a deliverability test mimicking a real warm-lead alert.\n\nSent at: ${stamp}\nLead: test@example.com\nMatched keywords: interested, demo\n\n--- Reply Body ---\nHey Dave, this sounds interesting. Happy to hop on a call next week.\n---`
    },
    {
      label: 'referral alert',
      subject: `REFERRAL: Test Founder referred you to colleague@example.com`,
      text: `This is a deliverability test mimicking a real referral alert.\n\nSent at: ${stamp}\nOriginal lead: test@example.com\nReferred email: colleague@example.com\nMatched keywords: refer, colleague\n\n--- Reply Body ---\nI'm not the right person, but try my colleague at colleague@example.com.\n---`
    }
  ];

  let ok = 0;
  for (const s of samples) {
    try {
      const result = await resend.emails.send({
        from,
        to,
        subject: s.subject,
        text: s.text
      });
      if (result.error) {
        console.error(`FAILED (${s.label}):`, result.error);
      } else {
        console.log(`SENT (${s.label}) — id: ${result.data?.id}`);
        ok++;
      }
    } catch (err) {
      console.error(`ERROR (${s.label}):`, err.message);
    }
  }

  console.log(`\n${ok}/${samples.length} sent. Check ${to} — Inbox AND Spam/Junk.`);
  console.log('Also check Resend dashboard: https://resend.com/emails');
  process.exit(ok === samples.length ? 0 : 1);
})();
