const connectDB = require('../config/database');
const replyDetectionService = require('../services/replyDetectionService');

// Script to manually check for replies
(async () => {
  try {
    console.log('🔍 Reply Detection Script\n');
    
    await connectDB();
    await replyDetectionService.initialize();
    
    const stats = await replyDetectionService.checkForReplies();
    
    console.log('\n✅ Reply detection complete!');
    
    // Show recent replies
    const replies = await replyDetectionService.getRecentReplies(30);
    
    if (replies.length > 0) {
      console.log('\n📬 Recent Replies (last 30 days):');
      replies.forEach(lead => {
        console.log(`   ✓ ${lead.first_name} ${lead.last_name} (${lead.company}) - ${lead.reply_detected_at.toLocaleDateString()}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Reply detection failed:', error.message);
    process.exit(1);
  }
})();
