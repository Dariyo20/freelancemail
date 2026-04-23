const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const connectDB = require('../config/database');
const Lead = require('../models/Lead');
const leadImporter = require('../services/leadImporter');

// Read every CSV in processed/ and csv/, re-parse rows with the updated
// parser, then either fill in missing fields on existing leads (company,
// title, metadata) or insert leads that were silently skipped before.
// Never touches status, followup_stage, reply_detected, or thread_id.

const DRY_RUN = process.argv.includes('--dry-run');

function readCSV(filepath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filepath)
      .pipe(csv())
      .on('data', (r) => rows.push(r))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

function isEmpty(v) {
  return v === undefined || v === null || v === '' || v === 'Unknown';
}

function buildUpdate(existing, parsed) {
  const update = {};

  if (isEmpty(existing.company) && !isEmpty(parsed.company)) {
    update.company = parsed.company;
  }
  if (isEmpty(existing.first_name) && !isEmpty(parsed.first_name)) {
    update.first_name = parsed.first_name;
  }
  if (isEmpty(existing.last_name) && !isEmpty(parsed.last_name)) {
    update.last_name = parsed.last_name;
  }
  if (isEmpty(existing.title) && !isEmpty(parsed.title)) {
    update.title = parsed.title;
  }
  if (isEmpty(existing.industry) && !isEmpty(parsed.industry)) {
    update.industry = parsed.industry;
  }

  const existingMeta = existing.metadata || {};
  const metaFields = ['phone', 'linkedin_url', 'website', 'employee_count', 'location'];
  for (const f of metaFields) {
    if (isEmpty(existingMeta[f]) && !isEmpty(parsed.metadata?.[f])) {
      update[`metadata.${f}`] = parsed.metadata[f];
    }
  }

  return update;
}

(async () => {
  console.log(`Backfill leads${DRY_RUN ? ' [DRY RUN]' : ''}\n`);

  await connectDB();

  const dirs = [
    path.join(__dirname, '../processed'),
    path.join(__dirname, '../csv')
  ];

  const files = [];
  for (const d of dirs) {
    if (!fs.existsSync(d)) continue;
    fs.readdirSync(d)
      .filter((f) => f.endsWith('.csv'))
      .forEach((f) => files.push(path.join(d, f)));
  }

  console.log(`Found ${files.length} CSV file(s) to scan\n`);

  const stats = {
    rowsSeen: 0,
    rowsParsed: 0,
    rowsInvalid: 0,
    updated: 0,
    inserted: 0,
    alreadyGood: 0,
    errors: 0
  };

  const processedEmails = new Set();

  for (const filepath of files) {
    const filename = path.basename(filepath);
    let rows;
    try {
      rows = await readCSV(filepath);
    } catch (err) {
      console.error(`Failed to read ${filename}: ${err.message}`);
      stats.errors++;
      continue;
    }

    console.log(`${filename}: ${rows.length} rows`);

    for (const row of rows) {
      stats.rowsSeen++;
      let parsed;
      try {
        parsed = leadImporter.parseCSVRow(row, 'apollo_csv');
      } catch (err) {
        stats.errors++;
        continue;
      }

      if (!parsed) {
        stats.rowsInvalid++;
        continue;
      }
      stats.rowsParsed++;

      // Only process each email once (first CSV wins)
      if (processedEmails.has(parsed.email)) continue;
      processedEmails.add(parsed.email);

      try {
        const existing = await Lead.findOne({ email: parsed.email });

        if (existing) {
          const update = buildUpdate(existing, parsed);
          if (Object.keys(update).length === 0) {
            stats.alreadyGood++;
            continue;
          }
          if (DRY_RUN) {
            console.log(`  UPDATE ${parsed.email}:`, update);
          } else {
            await Lead.updateOne({ _id: existing._id }, { $set: update });
          }
          stats.updated++;
        } else {
          if (DRY_RUN) {
            console.log(`  INSERT ${parsed.email} (${parsed.company})`);
          } else {
            await Lead.create(parsed);
          }
          stats.inserted++;
        }
      } catch (err) {
        console.error(`  Error on ${parsed.email}: ${err.message}`);
        stats.errors++;
      }
    }
  }

  console.log('\nSummary:');
  console.log(`   Rows seen:       ${stats.rowsSeen}`);
  console.log(`   Rows parsed:     ${stats.rowsParsed}`);
  console.log(`   Rows invalid:    ${stats.rowsInvalid}`);
  console.log(`   Leads updated:   ${stats.updated}`);
  console.log(`   Leads inserted:  ${stats.inserted}`);
  console.log(`   Already good:    ${stats.alreadyGood}`);
  console.log(`   Errors:          ${stats.errors}`);

  if (DRY_RUN) {
    console.log('\nDRY RUN — no changes written. Re-run without --dry-run to apply.');
  }

  process.exit(0);
})();
