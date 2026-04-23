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
          '{{first_name}} \u2014 shipping something in the next month?',
          'MVP for {{company}}, 1-3 weeks',
          'Production code for {{company}}',
          '{{first_name}}, 3 weeks to a live MVP'
        ],
        bodies: [
          `Hi {{first_name}},

Saw what you're building at {{company}}. Sharp positioning.

Quick context on why I'm writing: I run Striat, a small engineering studio. We ship production MVPs for funded founders in 1-3 weeks, flat rate from $10K.

A quick proof point before I take more of your time \u2014 I'm the solo engineer behind Daily Manna's backend, the Deeper Life devotional platform, now serving millions of daily users across 190+ countries in 12+ languages. Also shipped a healthcare coordination platform with QuickBooks integration that's tracking millions in live revenue for a private medical network.

If you're planning to ship something for {{company}} in the next 30-60 days, the work is at striat.dev. Reply if it's relevant and I'll send you the three projects closest to what you're building.

If the timing's not right, no worries \u2014 I'll close the loop politely in two weeks and leave you alone.

Dave
Striat \u00b7 striat.dev`,

          `Hi {{first_name}},

Direct pitch: Striat builds production MVPs for founders like you, 1-3 weeks, flat rate from $10K, end-to-end delivery including infrastructure and handover.

Why you should keep reading for 30 more seconds: I'm the solo engineer behind Daily Manna's backend \u2014 the Deeper Life devotional platform now serving millions of daily users across 190+ countries in 12+ languages. I also shipped a full healthcare coordination system with QuickBooks integration tracking millions in live revenue.

If {{company}} needs something shipped quickly and reliably \u2014 not a prototype, production code you can actually deploy to paying users \u2014 the studio's work is at striat.dev.

Reply if it's relevant to what you're building, and I'll send the three closest case studies. If not, no follow-up spam from me.

Dave
Striat \u00b7 striat.dev`,

          `{{first_name}},

Short version: I run Striat, an engineering studio. You might need what we do.

Production MVPs in 1-3 weeks, flat rate from $10K. End-to-end \u2014 architecture, build, deploy, documentation. No hourly billing, no scope creep.

Proof: solo engineer on Daily Manna's backend \u2014 the Deeper Life devotional platform now serving millions of daily users across 190+ countries in 12+ languages. Also shipped a healthcare platform with QuickBooks revenue integration for a private clinical network, tracking millions in invoices.

The studio's selected work is at striat.dev. If {{company}} has something that needs building in the next month or two, reply and I'll send you the three most relevant case studies.

Dave
Striat \u00b7 striat.dev`
        ],
        active: true
      },

      // FOLLOW-UP 1 (Day 5)
      {
        name: 'Striat - Followup 1 - Direct Value',
        type: 'followup_1',
        subjects: [
          'Re: Quick one for {{company}}',
          '{{first_name}} \u2014 one thought',
          'Following up, {{company}}'
        ],
        bodies: [
          `{{first_name}},

Quick follow-up. You're busy, so I'll keep this short.

If {{company}} has a product you need live in the next 4-6 weeks and you're either between engineering hires, waiting on an offshore team that keeps slipping deadlines, or trying to stretch a junior team past their limit \u2014 Striat can ship the whole thing in 1-3 weeks.

Two quick questions you can reply with yes/no:
1. Is there something you need shipped in the next 60 days?
2. Is the blocker engineering capacity or speed?

If both answers are yes, we should talk. If not, I'll leave you alone.

Dave
Striat \u00b7 striat.dev`,

          `Hi {{first_name}},

Bumping my earlier note in case it got buried.

One thing I didn't mention in the first email: every Striat engagement is scoped and priced flat before any commitment. You see the full quote, timeline, and deliverables in writing before you spend a cent. No open timesheets, no surprise invoices.

If {{company}} has something concrete to build, the work is at striat.dev. Happy to scope a quote if you want to see what that looks like for your specific project.

Dave
Striat \u00b7 striat.dev`,

          `{{first_name}},

Still here, still available. One last useful thing from me:

The typical shape of a Striat engagement for a founder at your stage \u2014 discovery call, written scope, flat quote, 1-3 week build, production deployment, handover with documentation and two weeks of post-launch support. Everything is written before the build starts. No surprises.

If that's useful to {{company}}, reply. If the timing isn't right, I'll close the loop next week and leave you alone.

Dave
Striat \u00b7 striat.dev`
        ],
        active: true
      },

      // FOLLOW-UP 2 (Day 12 - FINAL)
      {
        name: 'Striat - Followup 2 - Final Open Door',
        type: 'followup_2',
        subjects: [
          'Closing the loop, {{first_name}}',
          '{{company}} \u2014 keeping the door open',
          'Final note from Striat'
        ],
        bodies: [
          `{{first_name}},

Closing the loop on this thread.

If {{company}} ends up needing production engineering in the next few months \u2014 MVP build, infrastructure work, or a specific system shipped end-to-end \u2014 Striat is at striat.dev.

The studio keeps a tight pipeline. We take on one new engagement a month. If the timing aligns later, reach out directly and I'll prioritize your slot.

Dave
Striat \u00b7 striat.dev`,

          `{{first_name}},

Last note from me on this thread. No follow-up after this.

If {{company}} needs engineering work shipped in the next quarter, you know where to find the studio. Reach out whenever the timing makes sense.

Dave
Striat \u00b7 striat.dev`,

          `Hi {{first_name}},

Final email on this sequence. Since I said I wouldn't follow up aggressively, I'm keeping that.

If {{company}} has engineering work coming up \u2014 MVP, infrastructure, or a specific system \u2014 the door is open. Reply anytime, doesn't have to be now.

Dave
Striat \u00b7 striat.dev`
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
