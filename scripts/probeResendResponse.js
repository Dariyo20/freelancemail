/**
 * One-shot diagnostic: send via Resend, dump the full send/get response so we
 * can see whether the SMTP Message-ID is exposed anywhere on the API. If it
 * is, we can use it as the threading anchor; if not, we need a different
 * strategy (e.g. webhook capture or subject-only threading).
 */
require('dotenv').config();
const { Resend } = require('resend');

(async () => {
  const r = new Resend(process.env.RESEND_API_KEY);

  console.log('Sending probe email...');
  const sent = await r.emails.send({
    from: 'Dave Ariyo <dave@striat.dev>',
    to: 'davidariyo109@gmail.com',
    subject: 'Resend response probe — please ignore',
    html: '<p>probe</p>',
    headers: { 'Message-ID': '<probe-test-12345@striat.dev>' }
  });

  console.log('\n=== send() response ===');
  console.log(JSON.stringify(sent, null, 2));

  if (sent && sent.data && sent.data.id) {
    console.log('\nWaiting 4s for Resend to register the email...');
    await new Promise(res => setTimeout(res, 4000));

    console.log('\nFetching email metadata via emails.get()...');
    try {
      const detail = await r.emails.get(sent.data.id);
      console.log('\n=== get() response ===');
      console.log(JSON.stringify(detail, null, 2));

      // Highlight any field that looks like an SMTP Message-ID
      const flat = JSON.stringify(detail);
      const matches = flat.match(/<[^<>]+@[^<>]+>/g) || [];
      console.log('\n=== <...@...> patterns found in response ===');
      matches.forEach(m => console.log(' ', m));
    } catch (err) {
      console.error('get() failed:', err.message);
    }
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
