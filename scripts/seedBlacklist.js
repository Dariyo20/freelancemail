const connectDB = require('../config/database');
const Lead = require('../models/Lead');

// Pre-seed database with already-responded emails
// These emails will be marked as "replied" to prevent sending them emails

const RESPONDED_EMAILS = [
  'ab@trydecide.co',
  'adewalea@synercomgroup.net',
  'maro.malaka@planteer.cc',
  'MAILER-DAEMON@worldbankgroup.org',
  'stylebitt@gmail.com',
  'babalola.stephen@prints48.com',
  'aogunsakin@gavelintl.com',
  'ezeani@ruut.chat'
];

async function seedRespondedEmails() {
  try {
    console.log('\n🔒 Seeding Responded Emails (Blacklist)\n');
    
    await connectDB();
    
    let created = 0;
    let existing = 0;
    
    for (const email of RESPONDED_EMAILS) {
      const normalizedEmail = email.toLowerCase().trim();
      
      // Check if already exists
      const existingLead = await Lead.findOne({ email: normalizedEmail });
      
      if (existingLead) {
        // Update to replied status
        await Lead.findByIdAndUpdate(existingLead._id, {
          $set: {
            reply_detected: true,
            reply_detected_at: new Date(),
            status: 'replied'
          }
        });
        existing++;
        console.log(`  ✓ Updated existing: ${email}`);
      } else {
        // Create new lead marked as replied
        await Lead.create({
          first_name: 'Already',
          last_name: 'Responded',
          email: normalizedEmail,
          company: 'Blacklisted',
          industry: 'N/A',
          source: 'manual',
          status: 'replied',
          reply_detected: true,
          reply_detected_at: new Date(),
          followup_stage: 0,
          notes: 'Pre-seeded as responded - do not contact'
        });
        created++;
        console.log(`  ✓ Created blacklist entry: ${email}`);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Created: ${created}`);
    console.log(`   Updated: ${existing}`);
    console.log(`   Total blacklisted: ${RESPONDED_EMAILS.length}`);
    console.log(`\n✅ These emails will be skipped during import and email sending\n`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('Error seeding responded emails:', error.message);
    process.exit(1);
  }
}

seedRespondedEmails();
