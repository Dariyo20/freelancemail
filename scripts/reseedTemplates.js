require('dotenv').config();
const connectDB = require('../config/database');
const templateService = require('../services/templateService');
const Template = require('../models/Template');

(async () => {
  await connectDB();
  console.log('Forcing v3.1 reseed (deletes all existing templates first)...\n');
  await templateService.seedStudioTemplates();
  const all = await Template.find({}).select('name type subjects bodies');
  console.log(`\nTemplates now in DB: ${all.length}`);
  all.forEach(t => console.log(`  ${t.type.padEnd(11)} ${t.name}  (subjects=${t.subjects.length}, bodies=${t.bodies.length})`));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
