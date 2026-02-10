const connectDB = require('../config/database');
const leadImporter = require('../services/leadImporter');

// Script to manually import leads from CSV
(async () => {
  try {
    console.log('🚀 Lead Import Script\n');
    
    await connectDB();
    
    // Import all CSVs in csv/ directory
    await leadImporter.importAllCSVs();
    
    // Show stats
    const stats = await leadImporter.getStats();
    console.log('\n📊 Database Statistics:');
    console.log(`   Total leads: ${stats.total}`);
    console.log('\n   By Status:');
    stats.byStatus.forEach(s => {
      console.log(`   - ${s._id}: ${s.count}`);
    });
    console.log('\n   By Source:');
    stats.bySource.forEach(s => {
      console.log(`   - ${s._id}: ${s.count}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Import failed:', error.message);
    process.exit(1);
  }
})();
