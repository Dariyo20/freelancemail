const connectDB = require('../config/database');
const Lead = require('../models/Lead');
const EmailLog = require('../models/EmailLog');
const Template = require('../models/Template');
const Campaign = require('../models/Campaign');
const readline = require('readline');

// Reset database - WARNING: Deletes all data!

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function resetDatabase() {
  try {
    console.log('\n⚠️  DATABASE RESET - WARNING ⚠️\n');
    console.log('This will DELETE ALL DATA from:');
    console.log('  • Leads');
    console.log('  • Email Logs');
    console.log('  • Templates (will be re-seeded)');
    console.log('  • Campaigns\n');
    
    rl.question('Are you sure? Type "YES" to confirm: ', async (answer) => {
      if (answer !== 'YES') {
        console.log('\n✗ Reset cancelled\n');
        process.exit(0);
      }
      
      console.log('\n🗑️  Resetting database...\n');
      
      await connectDB();
      
      // Delete all data
      const deletedLeads = await Lead.deleteMany({});
      const deletedEmails = await EmailLog.deleteMany({});
      const deletedTemplates = await Template.deleteMany({});
      const deletedCampaigns = await Campaign.deleteMany({});
      
      console.log(`  ✓ Deleted ${deletedLeads.deletedCount} leads`);
      console.log(`  ✓ Deleted ${deletedEmails.deletedCount} email logs`);
      console.log(`  ✓ Deleted ${deletedTemplates.deletedCount} templates`);
      console.log(`  ✓ Deleted ${deletedCampaigns.deletedCount} campaigns`);
      
      console.log('\n✅ Database reset complete!');
      console.log('\n💡 Next steps:');
      console.log('   1. Run: npm run seed-blacklist');
      console.log('   2. Run: npm run import\n');
      
      rl.close();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Error resetting database:', error.message);
    rl.close();
    process.exit(1);
  }
}

resetDatabase();
