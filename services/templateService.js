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
    personalized = personalized.replace(/\{\{industry\}\}/gi, lead.industry || '');
    personalized = personalized.replace(/\{\{title\}\}/gi, lead.title || '');

    // Dynamic quarter tokens
    const { currentQuarter, nextQuarter } = this.getCurrentQuarters();
    personalized = personalized.replace(/\{\{currentQuarter\}\}/gi, currentQuarter);
    personalized = personalized.replace(/\{\{nextQuarter\}\}/gi, nextQuarter);

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
      for (const body of t.bodies) {
        if (body.includes('MERN') || body.includes('Full Stack Developer')) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Seed Striat studio templates (v2)
   * Deletes all existing templates and inserts new studio sequence
   */
  async seedStudioTemplates() {
    // Wipe existing templates
    await Template.deleteMany({});
    console.log('  Cleared old templates');

    const templates = [
      // INITIAL EMAIL (Day 0)
      {
        name: 'Striat - Initial - MVP Offer',
        type: 'initial',
        subjects: [
          'Quick one for {{company}}',
          '{{first_name}}, shipping something in the next month?',
          'MVP for {{company}}, 1-3 weeks',
          'Production code for {{company}}',
          '{{first_name}}, 3 weeks to a live MVP'
        ],
        bodies: [
          `Hi {{first_name}},

Saw what you're building at {{company}}, wanted to keep this quick.

I run Striat, a small engineering studio. We ship production MVPs for funded founders in 1-3 weeks, flat rate from $10K.

I'm the solo engineer behind Daily Manna's backend, the Deeper Life devotional platform now serving millions of daily users across 190+ countries in 12+ languages. Also shipped a healthcare coordination platform with QuickBooks integration tracking millions in live revenue for a private medical network.

If {{company}} needs something shipped in the next 30-60 days, the work is at striat.dev. Reply and I'll send the three projects closest to what you're building.

If the timing is off, I'll close the loop in two weeks and leave you alone.

Dave
striat.dev`,

          `Hi {{first_name}},

Quick one. Striat builds production MVPs for founders, 1-3 weeks, flat rate from $10K, end-to-end including infrastructure and handover.

I'm the solo engineer behind Daily Manna's backend, the Deeper Life devotional platform now serving millions of daily users across 190+ countries in 12+ languages. Also shipped a full healthcare coordination system with QuickBooks integration tracking millions in live revenue.

If {{company}} needs something built fast, not a prototype but production code you can ship to paying users, the work is at striat.dev.

Reply if it's relevant and I'll send the three closest case studies. If not, no follow-up spam.

Dave
striat.dev`,

          `{{first_name}},

I run Striat, a small engineering studio. Might be useful to you.

Production MVPs in 1-3 weeks, flat rate from $10K. End-to-end: architecture, build, deploy, documentation. No hourly billing, no scope creep.

Solo engineer on Daily Manna's backend, the Deeper Life devotional platform now serving millions of daily users across 190+ countries in 12+ languages. Also shipped a healthcare platform with QuickBooks revenue integration for a private clinical network, tracking millions in invoices.

Work is at striat.dev. If {{company}} has something to build in the next month or two, reply and I'll send the three most relevant case studies.

Dave
striat.dev`
        ],
        active: true
      },

      // FOLLOW-UP 1 (Day 5)
      {
        name: 'Striat - Followup 1 - Direct Value',
        type: 'followup_1',
        subjects: [
          'Re: Quick one for {{company}}',
          '{{first_name}}, one thought',
          'Following up, {{company}}'
        ],
        bodies: [
          `{{first_name}},

Following up from last week.

If {{company}} has something that needs shipping in the next 4-6 weeks, and you're between engineering hires, waiting on an offshore team that keeps slipping deadlines, or stretching a junior team past their limit, Striat can ship the whole thing in 1-3 weeks.

Two yes/no questions:
1. Is there something you need shipped in the next 60 days?
2. Is the blocker engineering capacity or speed?

If both are yes, worth a call. If not, I'll leave you alone.

Dave
striat.dev`,

          `Hi {{first_name}},

Bumping my earlier note in case it got buried.

One thing I didn't mention: every Striat engagement is scoped and priced flat before any commitment. You see the full quote, timeline, and deliverables in writing before you spend a cent. No open timesheets, no surprise invoices.

If {{company}} has something concrete to build, the work is at striat.dev. Happy to put together a quote so you can see what it would look like for your project.

Dave
striat.dev`,

          `{{first_name}},

Checking back in.

The typical shape of a Striat engagement for a founder at your stage: discovery call, written scope, flat quote, 1-3 week build, production deployment, handover with documentation, and two weeks of post-launch support. Everything written before the build starts.

If that's useful to {{company}}, reply. If the timing isn't right, I'll close the loop next week and leave you alone.

Dave
striat.dev`
        ],
        active: true
      },

      // FOLLOW-UP 2 (Day 12 - FINAL)
      {
        name: 'Striat - Followup 2 - Final Open Door',
        type: 'followup_2',
        subjects: [
          'Closing the loop, {{first_name}}',
          '{{company}}, keeping the door open',
          'Final note from Striat'
        ],
        bodies: [
          `{{first_name}},

Closing the loop on this thread.

If {{company}} ends up needing production engineering in the next few months, MVP build, infrastructure work, or a specific system shipped end-to-end, Striat is at striat.dev.

The studio takes on one new engagement a month. If the timing aligns later, reach out and I'll hold a slot.

Dave
striat.dev`,

          `{{first_name}},

Last note from me on this thread. No follow-up after this.

If {{company}} needs engineering work shipped in the next quarter, you know where to find the studio. Reach out whenever the timing makes sense.

Dave
striat.dev`,

          `Hi {{first_name}},

Final email on this sequence. Said I'd leave you alone, so I'm keeping that.

If {{company}} has engineering work coming up, MVP, infrastructure, or a specific system, the door is open. Reply anytime, doesn't have to be now.

Dave
striat.dev`
        ],
        active: true
      }
    ];

    await Template.insertMany(templates);
    console.log('\u2713 Striat studio templates seeded (3 stages: initial, followup_1, followup_2)');
  }

  /**
   * Create default templates for all stages
   * Auto-detects v1 templates and upgrades to v2 Striat studio sequence
   */
  async seedTemplates() {
    try {
      const existingCount = await Template.countDocuments();

      if (existingCount === 0) {
        console.log('  No templates found, seeding Striat studio templates...');
        await this.seedStudioTemplates();
        return;
      }

      // Check for v1 templates (freelancer MERN positioning) and auto-upgrade
      const isV1 = await this.isV1Templates();
      if (isV1) {
        console.log('  v1 templates detected (MERN/freelancer), upgrading to Striat studio v2...');
        await this.seedStudioTemplates();
        return;
      }

      console.log('\u2713 Striat studio templates already seeded');
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
