/**
 * Per-lead AI personalization for the [CUSTOM_LINE] slot in initial cold emails.
 *
 * Pipeline: lead.metadata.website -> fetch homepage -> extract title/meta/h1/h2/p
 * -> Claude Haiku 4.5 with strict prompt -> single line or empty string.
 *
 * Empty results are CACHED to lead.metadata.custom_line so we don't retry
 * forever. Hallucination is a worse failure than no personalization, so the
 * prompt explicitly authorises an empty response when nothing recent shows up.
 */
const cheerio = require('cheerio');
const Anthropic = require('@anthropic-ai/sdk');
const Lead = require('../models/Lead');
require('dotenv').config();

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_LINE_CHARS = 200;
const FETCH_TIMEOUT_MS = 8000;
const RESEARCH_MAX_CHARS = 4000;

class PersonalizationService {
  constructor() {
    this.client = null;
  }

  /**
   * Lazy-initialise the Anthropic client. Returns false if the API key is
   * missing — callers should treat that as "personalization disabled" and
   * fall back to empty custom_line, which renders the email cleanly.
   */
  init() {
    if (this.client) return true;
    if (!process.env.ANTHROPIC_API_KEY) return false;
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    return true;
  }

  /**
   * Fetch a company homepage and extract a compact research snippet
   * (title + meta description + h1/h2 + first few paragraphs).
   * Returns '' on any failure — never throws.
   */
  async fetchWebsiteText(url) {
    if (!url) return '';
    let target = String(url).trim();
    if (!target) return '';
    if (!/^https?:/i.test(target)) target = 'https://' + target;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const res = await fetch(target, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; StriatBot/1.0; +https://striat.dev)',
          'Accept': 'text/html,application/xhtml+xml'
        }
      });
      clearTimeout(timer);

      if (!res.ok) return '';
      const ctype = res.headers.get('content-type') || '';
      if (!ctype.includes('html')) return '';

      const html = await res.text();
      const $ = cheerio.load(html);
      $('script, style, noscript, nav, footer, svg, header').remove();

      const title = ($('title').first().text() || '').trim();
      const meta = ($('meta[name="description"]').attr('content')
                  || $('meta[property="og:description"]').attr('content')
                  || '').trim();
      const h1 = $('h1').map((_, e) => $(e).text().trim()).get().filter(Boolean).slice(0, 3).join(' | ');
      const h2 = $('h2').map((_, e) => $(e).text().trim()).get().filter(Boolean).slice(0, 5).join(' | ');
      const p = $('p').map((_, e) => $(e).text().trim()).get().filter(t => t.length > 30).slice(0, 8).join(' ');

      const combined = [
        title && `Title: ${title}`,
        meta && `Description: ${meta}`,
        h1 && `H1: ${h1}`,
        h2 && `H2: ${h2}`,
        p && `Body: ${p}`
      ].filter(Boolean).join('\n');

      return combined.slice(0, RESEARCH_MAX_CHARS);
    } catch (err) {
      return '';
    }
  }

  /**
   * Call Claude with the strict prompt. Returns either a single line of
   * 1-200 chars or '' (empty cache). Never throws to caller — failure mode
   * is silent omission, which is the user's explicit preference over fakes.
   */
  async generateCustomLine(lead) {
    if (!this.init()) return '';

    const website = (lead.metadata && lead.metadata.website) || '';
    const research = await this.fetchWebsiteText(website);
    if (!research || research.length < 80) return '';

    const prompt = `You are writing one custom line to insert into a cold email to ${lead.first_name} at ${lead.company}.

RESEARCH (scraped from their public website):
"""
${research}
"""

APOLLO METADATA:
- Recipient title: ${lead.title || '(unknown)'}
- Recipient industry: ${lead.industry || '(unknown)'}

REQUIREMENTS:
- Output a SINGLE line, max 20 words.
- Reference something SPECIFIC and RECENT about ${lead.company} that is visible in the research above.
- Voice: confident peer, not flattering. Factual observation only.
- DO NOT use emotional language ("love", "amazed", "excited", "huge fan").
- DO NOT invent details not in the research. Hallucinated personalization destroys trust.

GOOD EXAMPLES:
"Saw the agentic-workflows API you launched in your latest release."
"Noticed your platform now covers lab integration and billing."
"Your case study on the multi-tenant rebuild caught my eye."

BAD EXAMPLES (do NOT generate):
"Love what you're building at ${lead.company}!"
"Amazed by your growth!"
"Saw your recent post" (without specifics)

If the research contains no specific recent signal, return an EMPTY STRING. An empty response is correct and expected for many leads.

Output ONLY the custom line, OR an empty string. No quotes, no prefix, no explanation.`;

    try {
      const msg = await this.client.messages.create({
        model: MODEL,
        max_tokens: 80,
        messages: [{ role: 'user', content: prompt }]
      });
      const block = msg.content && msg.content[0];
      const raw = (block && block.type === 'text' && block.text) || '';
      let line = raw.trim().replace(/^["'`]+|["'`]+$/g, '').trim();
      // Collapse multiline output to first line — model should never emit one but defensive
      line = line.split(/\r?\n/)[0].trim();
      if (!line) return '';
      if (line.length > MAX_LINE_CHARS) return '';
      // Reject if model tried to refuse / explain
      if (/^(i\s|i'm|sorry|unfortunately|note:|caveat:|empty)/i.test(line)) return '';
      return line;
    } catch (err) {
      console.warn(`  personalization API error for ${lead.email}: ${err.message}`);
      return '';
    }
  }

  /**
   * Returns the cached custom_line for a lead, computing+caching on first
   * access. The cache stores '' as a valid value (means "we tried, no signal")
   * so we don't burn API calls on repeat sends.
   */
  async getOrComputeForLead(lead) {
    if (lead.metadata && typeof lead.metadata.custom_line === 'string') {
      return lead.metadata.custom_line;
    }
    const line = await this.generateCustomLine(lead);
    try {
      await Lead.findByIdAndUpdate(lead._id, {
        $set: { 'metadata.custom_line': line }
      });
    } catch (err) {
      console.warn(`  failed to cache custom_line for ${lead.email}: ${err.message}`);
    }
    return line;
  }
}

module.exports = new PersonalizationService();
