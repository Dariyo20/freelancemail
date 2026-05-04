const Template = require('../models/Template');

class TemplateService {

  /**
   * Get a random template for a specific stage
   * @param {String} stage - 'initial', 'followup_1', 'followup_2'
   * @returns {Object} Template with random subject and body
   */
  async getTemplate(stage) {
    try {
      const templates = await Template.find({ type: stage, active: true });

      if (!templates || templates.length === 0) {
        throw new Error(`No active templates found for stage: ${stage}`);
      }

      // Pick random template
      const template = templates[Math.floor(Math.random() * templates.length)];

      // Pick random subject
      const subject = template.subjects[Math.floor(Math.random() * template.subjects.length)];

      // Pick random body
      const body = template.bodies[Math.floor(Math.random() * template.bodies.length)];

      // Update usage stats
      await Template.findByIdAndUpdate(template._id, {
        $inc: { times_used: 1, total_sent: 1 },
        $set: { last_used_at: new Date() }
      });

      return {
        template_name: template.name,
        subject,
        body
      };
    } catch (error) {
      console.error('Error getting template:', error.message);
      throw error;
    }
  }

  /**
   * Personalize email content with lead data
   * @param {String} content - Email content with tokens
   * @param {Object} lead - Lead data
   * @returns {String} Personalized content
   */
  personalize(content, lead) {
    let personalized = content;

    // Replace tokens
    personalized = personalized.replace(/\{\{first_name\}\}/gi, lead.first_name || '');
    personalized = personalized.replace(/\{\{last_name\}\}/gi, lead.last_name || '');
    personalized = personalized.replace(/\{\{company\}\}/gi, lead.company || '');
    personalized = personalized.replace(/\{\{title\}\}/gi, lead.title || '');

    // Industry token: when blank, strip the token AND the trailing space so
    // "most {{industry}} teams" reads as "most teams" instead of "most  teams".
    if (lead.industry && lead.industry.trim()) {
      personalized = personalized.replace(/\{\{industry\}\}/gi, lead.industry);
    } else {
      personalized = personalized.replace(/\{\{industry\}\}\s+/gi, '');
      personalized = personalized.replace(/\{\{industry\}\}/gi, '');
    }

    // Dynamic quarter tokens
    const { currentQuarter, nextQuarter } = this.getCurrentQuarters();
    personalized = personalized.replace(/\{\{currentQuarter\}\}/gi, currentQuarter);
    personalized = personalized.replace(/\{\{nextQuarter\}\}/gi, nextQuarter);

    // Custom-line placeholder: if filled, splice in. If empty/null, collapse
    // the placeholder line + surrounding blank lines so we never ship "[CUSTOM_LINE]"
    // literally and never leave a triple-blank gap where the line would have been.
    const customLine = (lead.metadata && lead.metadata.custom_line || '').trim();
    if (customLine) {
      personalized = personalized.replace(/\[CUSTOM_LINE\]/g, customLine);
    } else {
      personalized = personalized.replace(/\n\n\[CUSTOM_LINE\]\n\n/g, '\n\n');
      personalized = personalized.replace(/\[CUSTOM_LINE\]/g, '');
    }

    return personalized;
  }

  /**
   * Get current quarter and next quarter for dynamic content
   */
  getCurrentQuarters() {
    const now = new Date();
    const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
    const nextQuarter = currentQuarter === 4 ? 1 : currentQuarter + 1;
    return { currentQuarter, nextQuarter };
  }

  /**
   * Detect if existing templates are v1 (freelancer MERN positioning)
   */
  async isV1Templates() {
    const templates = await Template.find({});
    for (const t of templates) {
      for (const body of t.bodies || []) {
        if (body.includes('MERN') || body.includes('Full Stack Developer')) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Detect v2 templates (the "$10K flat rate / Quick one for ..." studio
   * sequence) so they auto-upgrade to v3.1 on next seed run.
   */
  async isV2Templates() {
    const templates = await Template.find({});
    for (const t of templates) {
      for (const subj of t.subjects || []) {
        if (subj.includes('Quick one for')) return true;
      }
      for (const body of t.bodies || []) {
        if (body.includes('flat rate from $10K') || body.includes('$10K')) return true;
      }
    }
    return false;
  }

  /**
   * Seed Striat studio templates (v3.1)
   * - Proof-led opens, [CUSTOM_LINE] hook slot for AI personalization
   * - 4-stage cadence: Day 0 / Day 3 / Day 7 / Day 14
   * - Pricing language softened ("flat-rate, scoped-and-quoted") \u2014 no $ figure
   * - Day 7 is value-only (no ask)
   * Deletes all existing templates and inserts the new sequence.
   */
  async seedStudioTemplates() {
    await Template.deleteMany({});
    console.log('  Cleared old templates');

    const templates = [
      // INITIAL (Day 0) \u2014 proof-first, binary CTA
      {
        name: 'Striat - Initial - Proof First',
        type: 'initial',
        subjects: [
          'Built Daily Manna solo \u2014 relevant for {{company}}?',
          'Built infrastructure for millions \u2014 relevant for {{company}}?',
          'Solo engineer, millions of users \u2014 {{company}} fit?',
          '{{first_name}}, case study for {{company}}?'
        ],
        bodies: [
          `Hi {{first_name}},

[CUSTOM_LINE]

I built Daily Manna's backend solo \u2014 Deeper Life's devotional platform now serving millions of daily readers across 190+ countries.

Also shipped a healthcare coordination platform handling patient flow, lab integration, and billing for a Nigerian medical network. Both shipped solo, end-to-end, in under 12 weeks each.

I run Striat, a one-person engineering studio. Flat-rate engagements, scoped and quoted in writing before any commitment, typically 1-3 weeks from kickoff to production.

Want me to send the closest case study to {{company}}?

Dave
striat.dev`,

          `{{first_name}},

[CUSTOM_LINE]

Quick context. Daily Manna \u2014 Deeper Life's devotional platform serving millions of daily readers across 190+ countries \u2014 I built that backend solo. Also shipped a healthcare coordination platform handling patient flow, lab integration, and billing for a Nigerian medical network. Both end-to-end, both solo, both under 12 weeks.

I run Striat, a one-person engineering studio. Scope and quote in writing first, flat rate, 1-3 weeks to production.

If {{company}} has something to ship in the next 30-60 days, want me to send the closest case study to what you're building?

Dave
striat.dev`
        ],
        active: true
      },

      // FOLLOW-UP 1 (Day 3) \u2014 micro-value insight + escalated ask
      {
        name: 'Striat - Followup 1 - Micro Value',
        type: 'followup_1',
        subjects: [
          'Re: case study for {{company}}',
          '{{first_name}}, 15 min Tue or Wed?',
          '{{first_name}}, one thing'
        ],
        bodies: [
          `{{first_name}},

Bumping briefly. Sharing one thing in case useful: most {{industry}} teams I see ship faster when they freeze the v1 spec for 2 weeks hard, no exceptions, even when stakeholders push for changes. Sounds obvious, almost nobody does it.

If {{company}} has something to ship in the next 30-60 days, 15 min Tue or Wed?

Dave
striat.dev`
        ],
        active: true
      },

      // FOLLOW-UP 2 (Day 7) \u2014 value-only, no ask (the converter)
      {
        name: 'Striat - Followup 2 - Value Only',
        type: 'followup_2',
        subjects: [
          '{{first_name}}, one observation',
          'Pattern I keep seeing',
          'Quick thought, {{first_name}}'
        ],
        bodies: [
          `{{first_name}},

No ask this time, just sharing something I keep seeing.

The biggest delta between a 12-week MVP and a 6-month one isn't the team's coding speed \u2014 it's three or four architectural decisions made in week one, mostly around data shape, auth boundaries, and what to defer. Get those right and the rest of the build basically writes itself. Get them wrong and you'll spend weeks unwinding choices that looked fine on a whiteboard.

Sharing in case it's useful as you scope your next sprint at {{company}}. No reply needed.

Dave
striat.dev`,

          `Hi {{first_name}},

Quick observation, no ask.

Most founders I talk to think the bottleneck on shipping is engineering capacity. Closer to 70% of the time it's actually scope clarity \u2014 the team is fast enough, but the spec keeps moving, so each week's work overwrites last week's. The fix isn't more engineers, it's a frozen scope and a hard date before code starts.

Sharing in case it's useful as {{company}} plans the next quarter. No reply needed.

Dave
striat.dev`
        ],
        active: true
      },

      // FOLLOW-UP 3 (Day 14) \u2014 soft close with re-anchor link
      {
        name: 'Striat - Followup 3 - Door Open',
        type: 'followup_3',
        subjects: [
          'Closing the loop, {{first_name}}',
          '{{company}}, door open'
        ],
        bodies: [
          `{{first_name}},

Last note from me on this thread.

If {{company}} ends up needing engineering work shipped in the next quarter \u2014 MVP, infrastructure, or a specific system \u2014 Striat is at striat.dev. Daily Manna case study lives at striat.dev/work/daily-manna if it's ever useful.

Reply whenever the timing makes sense, doesn't have to be now.

Dave
striat.dev`
        ],
        active: true
      }
    ];

    await Template.insertMany(templates);
    console.log('\u2713 Striat studio templates v3.1 seeded (4 stages: initial, followup_1, followup_2, followup_3)');
  }

  /**
   * Create default templates for all stages.
   * Auto-detects v1 (MERN/freelancer) and v2 ($10K offer) templates and
   * upgrades them to v3.1 in place.
   */
  async seedTemplates() {
    try {
      const existingCount = await Template.countDocuments();

      if (existingCount === 0) {
        console.log('  No templates found, seeding Striat studio v3.1 templates...');
        await this.seedStudioTemplates();
        return;
      }

      const isV1 = await this.isV1Templates();
      if (isV1) {
        console.log('  v1 templates detected (MERN/freelancer), upgrading to v3.1...');
        await this.seedStudioTemplates();
        return;
      }

      const isV2 = await this.isV2Templates();
      if (isV2) {
        console.log('  v2 templates detected ($10K offer), upgrading to v3.1...');
        await this.seedStudioTemplates();
        return;
      }

      console.log('\u2713 Striat studio v3.1 templates already seeded');
    } catch (error) {
      console.error('Error seeding templates:', error.message);
      throw error;
    }
  }

  /**
   * Get all templates grouped by type
   */
  async getAllTemplates() {
    try {
      const templates = await Template.find().sort({ type: 1, createdAt: -1 });
      return templates;
    } catch (error) {
      console.error('Error fetching templates:', error.message);
      throw error;
    }
  }

  /**
   * Update template performance metrics
   */
  async updateTemplateStats(templateName, replied = false) {
    try {
      if (replied) {
        await Template.findOneAndUpdate(
          { name: templateName },
          { $inc: { total_replies: 1 } }
        );
      }

      const template = await Template.findOne({ name: templateName });

      if (template && template.total_sent > 0) {
        template.reply_rate = (template.total_replies / template.total_sent) * 100;
        await template.save();
      }

    } catch (error) {
      console.error('Error updating template stats:', error.message);
    }
  }
}

module.exports = new TemplateService();
