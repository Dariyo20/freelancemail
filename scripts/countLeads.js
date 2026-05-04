require('dotenv').config();
const connectDB = require('../config/database');
const Lead = require('../models/Lead');

(async () => {
  await connectDB();
  const total = await Lead.countDocuments();
  const fresh = await Lead.countDocuments({ status: 'new', emails_sent: 0 });
  const contacted = await Lead.countDocuments({ emails_sent: { $gte: 1 } });
  const replied = await Lead.countDocuments({ reply_detected: true });
  const unsubscribed = await Lead.countDocuments({ status: 'unsubscribed' });

  const titleAgg = await Lead.aggregate([
    { $match: { status: 'new', emails_sent: 0 } },
    { $group: { _id: { $toLower: '$title' }, n: { $sum: 1 } } },
    { $sort: { n: -1 } },
    { $limit: 20 }
  ]);

  console.log('---- Lead inventory ----');
  console.log('Total leads in DB:', total);
  console.log('Untouched (status=new, 0 sends):', fresh);
  console.log('Already contacted (>=1 send):', contacted);
  console.log('Replied:', replied);
  console.log('Unsubscribed:', unsubscribed);
  console.log('\nTop 20 titles among UNTOUCHED leads:');
  titleAgg.forEach(r => console.log(`  ${r.n.toString().padStart(4)}  ${r._id}`));

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
