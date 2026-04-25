const connectDB = require('../config/database');
const emailService = require('../services/emailService');
const templateService = require('../services/templateService');

// Usage: node scripts/sendEmails.js [max] [group]
//   max:   number of emails to send (default 10)
//   group: US_CA | UK_EU | all  (default all)

const COUNTRY_GROUPS = {
  US_CA: ['United States', 'Canada', 'Brazil'],
  UK_EU: [
    'United Kingdom', 'France', 'Germany', 'Poland', 'Croatia',
    'Portugal', 'Austria', 'Sweden', 'Italy', 'Ireland', 'Spain',
    'Australia', 'Singapore'
  ],
  ME_AFRICA: ['Israel', 'United Arab Emirates', 'Saudi Arabia', 'Kenya']
};

(async () => {
  try {
    console.log('Email Sending Script\n');

    await connectDB();
    await templateService.seedTemplates();
    await emailService.initialize();

    const maxEmails = parseInt(process.argv[2]) || 10;
    const groupArg = (process.argv[3] || 'all').toUpperCase();
    const countryFilter = groupArg === 'ALL' ? null : COUNTRY_GROUPS[groupArg];

    if (groupArg !== 'ALL' && !countryFilter) {
      console.error(`Unknown group: ${groupArg}. Use US_CA, UK_EU, or all.`);
      process.exit(1);
    }

    console.log(`Processing up to ${maxEmails} emails (group: ${groupArg})...\n`);

    await emailService.processQueue(maxEmails, countryFilter);

    console.log('\nEmail sending complete.');
    process.exit(0);
  } catch (error) {
    console.error('Email sending failed:', error.message);
    process.exit(1);
  }
})();
