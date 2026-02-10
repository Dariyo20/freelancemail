const connectDB = require('../config/database');
const emailService = require('../services/emailService');
const templateService = require('../services/templateService');

// Script to manually send emails
(async () => {
  try {
    console.log('📧 Email Sending Script\n');
    
    await connectDB();
    await templateService.seedTemplates();
    await emailService.initialize();
    
    // Ask how many emails to send
    const maxEmails = parseInt(process.argv[2]) || 10;
    console.log(`Processing up to ${maxEmails} emails...\n`);
    
    const stats = await emailService.processQueue(maxEmails);
    
    console.log('\n✅ Email sending complete!');
    
    process.exit(0);
  } catch (error) {
    console.error('Email sending failed:', error.message);
    process.exit(1);
  }
})();
