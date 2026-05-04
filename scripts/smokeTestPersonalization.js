/**
 * Smoke test: pick one untouched lead with a website, run the full
 * personalization pipeline, show the rendered email body. Does NOT send.
 */
require('dotenv').config();
const connectDB = require('../config/database');
const Lead = require('../models/Lead');
const Template = require('../models/Template');
const personalizationService = require('../services/personalizationService');
const templateService = require('../services/templateService');

(async () => {
  await connectDB();

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('✗ ANTHROPIC_API_KEY not set in .env');
    process.exit(1);
  }

  const lead = await Lead.findOne({
    status: 'new',
    emails_sent: 0,
    'metadata.website': { $exists: true, $ne: '' }
  });

  if (!lead) {
    console.log('No untouched lead with website found');
    process.exit(0);
  }

  console.log(`Test lead: ${lead.email} | ${lead.title} | ${lead.company}`);
  console.log(`Website  : ${lead.metadata.website}\n`);

  console.log('1. Fetching website...');
  const research = await personalizationService.fetchWebsiteText(lead.metadata.website);
  console.log(`   Got ${research.length} chars of research text`);
  if (research.length < 80) {
    console.log('   ⚠ Below 80-char floor — would return empty (no API call)');
  } else {
    console.log(`   First 200 chars: ${research.slice(0, 200).replace(/\n/g, ' / ')}...\n`);
  }

  console.log('2. Calling Claude (Haiku 4.5)...');
  const line = await personalizationService.generateCustomLine(lead);
  console.log(`   Custom line: ${line ? '"' + line + '"' : '(empty — no signal found)'}\n`);

  // Render the initial email body to show what would actually ship
  const tmpl = await Template.findOne({ type: 'initial' });
  const body = tmpl.bodies[0];
  lead.metadata.custom_line = line;
  const rendered = templateService.personalize(body, lead);

  console.log('3. Rendered initial email body:\n' + '─'.repeat(60));
  console.log(rendered);
  console.log('─'.repeat(60));

  console.log('\n(Lead NOT updated in DB — this was a dry run)');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
