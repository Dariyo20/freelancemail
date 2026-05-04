/**
 * One-shot filter-aware import for the new dollar_pipeline_v3 CSVs.
 *
 * Filter rules (per Dave's call on 2026-05-03):
 *  - KEEP: titles matching Founder / Co-founder / VP / Director / Head of
 *    (incl. founder+CEO combos like "Co-founder & CEO" — small-co founders are
 *    explicitly the buyer)
 *  - DROP: pure C-suite / Counsel / Partner without a founder marker
 *  - DROP: blank or non-matching titles (held back for manual review)
 *
 * Company-size filter (>500 employees) is unenforceable — these CSVs lack
 * employee_count. Companies in the keeper set are visually small-startup
 * shape; spot-check before scaling.
 *
 * After import each lead enters the pipeline at status=new, followup_stage=0.
 * AI personalization (lead.metadata.custom_line) is computed lazily on first
 * send, NOT here, to keep the import fast and avoid burning API on leads
 * the worker may never reach.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const connectDB = require('../config/database');
const Lead = require('../models/Lead');

const KEEPER_RX = /(founder|co-?founder|cofounder|vice president|^vp\b|^director\b|director of|head of)/i;
const C_PURE_RX = /(senior counsel|general counsel|^counsel\b|^cfo\b|chief financial officer|^ceo\b|chief executive officer|^cto\b|chief technology officer|^coo\b|chief operating officer|^cmo\b|chief marketing officer|^cro\b|chief revenue officer|^cpo\b|chief product officer|chief of staff|chief legal officer|^clo\b|^cio\b|chief information officer|chief commercial officer|chief growth officer|chief business officer|chief scientist|chief information security|chief data officer|managing partner|^partner\b)/i;

const CSV_DIR = path.join(__dirname, '..', 'csv');
const PROCESSED_DIR = path.join(__dirname, '..', 'processed');

function classify(title) {
  const t = (title || '').toLowerCase();
  const isK = KEEPER_RX.test(t);
  const isC = C_PURE_RX.test(t);
  if (isK) return 'keeper';        // includes founder+CEO combos
  if (isC) return 'drop_csuite';
  return 'drop_other';
}

function normalizeCountry(raw) {
  if (!raw) return '';
  return String(raw).toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function parseRow(row) {
  const email = row['contact_professions_email'] || row['Email'] || '';
  if (!email || !isValidEmail(email)) return null;

  let first_name = row['prospect_first_name'] || '';
  let last_name = row['prospect_last_name'] || '';
  if (!first_name && row['prospect_full_name']) {
    const parts = row['prospect_full_name'].trim().split(/\s+/);
    first_name = parts[0] || '';
    last_name = parts.slice(1).join(' ');
  }

  const title = (row['prospect_job_title'] || '').trim();
  const company = (row['prospect_company_name'] || 'Unknown').trim();
  const country = normalizeCountry(row['prospect_country_name'] || '');
  const department = (row['prospect_job_department'] || '').trim();

  return {
    first_name: first_name.trim(),
    last_name: last_name.trim(),
    email: email.toLowerCase().trim(),
    title,
    company,
    industry: department,
    country,
    metadata: {
      linkedin_url: row['prospect_linkedin'] || '',
      website: row['prospect_company_website'] || '',
      location: row['prospect_city'] || country || ''
    }
  };
}

async function importFile(filename) {
  const filepath = path.join(CSV_DIR, filename);
  console.log(`\n${'='.repeat(60)}\n📥 ${filename}\n${'='.repeat(60)}`);

  const stats = { total: 0, keeper: 0, drop_csuite: 0, drop_other: 0, dup: 0, imported: 0, error: 0 };
  const keepers = [];

  await new Promise((resolve, reject) => {
    fs.createReadStream(filepath)
      .pipe(csv())
      .on('data', row => {
        stats.total++;
        try {
          const lead = parseRow(row);
          if (!lead) { stats.drop_other++; return; }
          const verdict = classify(lead.title);
          stats[verdict]++;
          if (verdict === 'keeper') keepers.push(lead);
        } catch (err) {
          stats.error++;
        }
      })
      .on('end', resolve)
      .on('error', reject);
  });

  console.log(`  total rows           : ${stats.total}`);
  console.log(`  keepers (founder/VP/Dir): ${stats.keeper}`);
  console.log(`  dropped: pure C-suite : ${stats.drop_csuite}`);
  console.log(`  dropped: other/blank  : ${stats.drop_other}`);

  for (const lead of keepers) {
    try {
      const existing = await Lead.findOne({ email: lead.email });
      if (existing) {
        stats.dup++;
        continue;
      }
      await Lead.create({
        ...lead,
        source: 'apollo_csv',
        status: 'new',
        followup_stage: 0,
        reply_detected: false
      });
      stats.imported++;
    } catch (err) {
      console.warn(`  ✗ ${lead.email}: ${err.message}`);
      stats.error++;
    }
  }

  console.log(`  imported new          : ${stats.imported}`);
  console.log(`  duplicates (skipped)  : ${stats.dup}`);
  if (stats.error) console.log(`  errors                : ${stats.error}`);

  // Move processed CSV out of csv/
  if (!fs.existsSync(PROCESSED_DIR)) fs.mkdirSync(PROCESSED_DIR, { recursive: true });
  const dest = path.join(PROCESSED_DIR, `${new Date().toISOString().split('T')[0]}_filtered_${filename}`);
  fs.renameSync(filepath, dest);
  console.log(`  moved → processed/`);

  return stats;
}

(async () => {
  await connectDB();
  const files = fs.readdirSync(CSV_DIR).filter(f => f.endsWith('.csv'));
  if (!files.length) {
    console.log('No CSV files in csv/');
    process.exit(0);
  }

  const totals = { total: 0, keeper: 0, drop_csuite: 0, drop_other: 0, dup: 0, imported: 0, error: 0 };
  for (const f of files) {
    const s = await importFile(f);
    for (const k of Object.keys(totals)) totals[k] += s[k] || 0;
  }

  console.log(`\n${'='.repeat(60)}\n📊 GRAND TOTAL\n${'='.repeat(60)}`);
  console.log(`  rows processed   : ${totals.total}`);
  console.log(`  keepers found    : ${totals.keeper}`);
  console.log(`  dropped C-suite  : ${totals.drop_csuite}`);
  console.log(`  dropped other    : ${totals.drop_other}`);
  console.log(`  newly imported   : ${totals.imported}`);
  console.log(`  duplicates       : ${totals.dup}`);
  if (totals.error) console.log(`  errors           : ${totals.error}`);

  const fresh = await Lead.countDocuments({ status: 'new', emails_sent: 0 });
  console.log(`\n  Untouched queue is now: ${fresh}`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
