const fs = require('fs');
const path = require('path');

function parseCSV(text) {
  const rows = [];
  let cur = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i+1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQ = false; }
      else { field += c; }
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { cur.push(field); field = ''; }
      else if (c === '\n') { cur.push(field); rows.push(cur); cur = []; field = ''; }
      else if (c === '\r') { /* skip */ }
      else field += c;
    }
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  return rows;
}

const files = [
  'csv/dollar_pipeline_v3_batch1_20260503021114_full.csv',
  'csv/dollar_pipeline_v3_batch2_20260503021210_full.csv'
];

const KEEPER_RX = /(founder|co-?founder|cofounder|vice president|^vp\b|^director\b|director of|head of)/i;
const C_PURE_RX = /(senior counsel|general counsel|^counsel\b|^cfo\b|chief financial officer|^ceo\b|chief executive officer|^cto\b|chief technology officer|^coo\b|chief operating officer|^cmo\b|chief marketing officer|^cro\b|chief revenue officer|^cpo\b|chief product officer|chief of staff|chief legal officer|^clo\b|^cio\b|chief information officer|chief commercial officer|chief growth officer|chief business officer|chief scientist|managing partner|^partner\b)/i;

let total = 0;
const titles = {}, senior = {}, depts = {};
const companies = new Set();
const buckets = { founder_vp_dir: 0, founder_csuite_combo: 0, pure_csuite: 0, other: 0 };
const examples = { keeper: [], drop: [] };

for (const f of files) {
  const text = fs.readFileSync(path.resolve(f), 'utf-8');
  const rows = parseCSV(text);
  const header = rows[0];
  const idx = (n) => header.indexOf(n);
  const iTitle = idx('prospect_job_title');
  const iSen = idx('prospect_job_seniority_level');
  const iDept = idx('prospect_job_department');
  const iCo = idx('prospect_company_name');
  const iEmail = idx('contact_professions_email');
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length < 2) continue;
    total++;
    const title = (row[iTitle] || '').trim();
    const tl = title.toLowerCase();
    const s = (row[iSen] || '').trim().toLowerCase();
    const d = (row[iDept] || '').trim();
    const co = (row[iCo] || '').trim();
    const email = (row[iEmail] || '').trim();
    titles[tl] = (titles[tl] || 0) + 1;
    senior[s] = (senior[s] || 0) + 1;
    depts[d] = (depts[d] || 0) + 1;
    companies.add(co);

    const isK = KEEPER_RX.test(tl);
    const isC = C_PURE_RX.test(tl);
    let bucket;
    if (isK && !isC) bucket = 'founder_vp_dir';
    else if (isK && isC) bucket = 'founder_csuite_combo';
    else if (isC) bucket = 'pure_csuite';
    else bucket = 'other';
    buckets[bucket]++;
    if ((bucket === 'founder_vp_dir' || bucket === 'founder_csuite_combo') && examples.keeper.length < 6)
      examples.keeper.push(`${email} | ${title} | ${co}`);
    if (bucket === 'pure_csuite' && examples.drop.length < 6)
      examples.drop.push(`${email} | ${title} | ${co}`);
  }
}

console.log(`Total rows: ${total}`);
console.log(`Unique companies: ${companies.size}\n`);

console.log('Seniority level distribution:');
Object.entries(senior).sort((a,b)=>b[1]-a[1]).slice(0,12).forEach(([k,v]) => console.log(`  ${String(v).padStart(4)}  ${k || '(blank)'}`));

console.log('\nDepartment distribution:');
Object.entries(depts).sort((a,b)=>b[1]-a[1]).slice(0,8).forEach(([k,v]) => console.log(`  ${String(v).padStart(4)}  ${k || '(blank)'}`));

console.log('\nFilter buckets (title-based only — CSVs have no employee_count):');
console.log(`  Founder/VP/Director (no C-suite)     : ${buckets.founder_vp_dir}  KEEP`);
console.log(`  Founder + C-suite combo              : ${buckets.founder_csuite_combo}  KEEP (small-co founders)`);
console.log(`  Pure C-suite/Counsel                  : ${buckets.pure_csuite}  DROP`);
console.log(`  Other / blank                         : ${buckets.other}  REVIEW`);
const keep = buckets.founder_vp_dir + buckets.founder_csuite_combo;
console.log(`\nEstimated keepers: ${keep} of ${total} (${(keep/total*100).toFixed(0)}%)`);

console.log('\nTop 20 titles:');
Object.entries(titles).sort((a,b)=>b[1]-a[1]).slice(0,20).forEach(([k,v]) => console.log(`  ${String(v).padStart(4)}  ${k}`));

console.log('\nSample keepers:');
examples.keeper.forEach(e => console.log('  ', e));
console.log('\nSample drops (pure C-suite):');
examples.drop.forEach(e => console.log('  ', e));
