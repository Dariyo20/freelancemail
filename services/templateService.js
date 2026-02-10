const Template = require('../models/Template');

class TemplateService {
  
  /**
   * Get a random template for a specific stage
   * @param {String} stage - 'initial', 'followup_1', 'followup_2', 'followup_3'
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
    
    return personalized;
  }
  
  /**
   * Create default templates for all stages
   */
  async seedTemplates() {
    try {
      const existingTemplates = await Template.countDocuments();
      if (existingTemplates > 0) {
        console.log('✓ Templates already exist, skipping seed...');
        return;
      }
      
      const templates = [
        // INITIAL EMAIL TEMPLATES
        {
          name: 'Initial Outreach - General',
          type: 'initial',
          subjects: [
            'Quick question about {{company}}',
            '{{first_name}} - potential collaboration?',
            'Helping {{company}} scale faster',
            'Thought this might interest {{company}}',
            '{{company}} + web development partnership'
          ],
          bodies: [
            `Hi {{first_name}},

I came across {{company}} and was impressed by what you're building in {{industry}}.

I'm a Full Stack Developer (MERN stack) specializing in building scalable web applications. I've recently delivered:
• Real-time communication platforms with WebSocket
• E-commerce systems processing 140+ products
• HR management systems with workflow automation

Would you be open to a quick chat about any upcoming projects where I could help {{company}} scale faster?

Best regards,
David Ariyo
Full Stack Developer (MERN)`,

            `Hi {{first_name}},

Quick intro - I'm David, a Full Stack Developer specializing in React, Node.js, and MongoDB.

I noticed {{company}} is in the {{industry}} space, and I've worked on similar projects involving real-time features, payment integrations, and scalable backends.

Is {{company}} currently looking for development support or considering any new technical projects?

Happy to share relevant case studies if helpful.

Best,
David`,

            `Hi {{first_name}},

I help {{industry}} companies build and scale their web applications using modern tech stacks (React, Node.js, MongoDB).

Recent projects include:
✓ Real-time messaging platform (WebSocket + JWT auth)
✓ E-commerce system with payment gateway integration
✓ HR automation with role-based access control

Would love to learn more about {{company}}'s current tech roadmap and see if there's a fit.

Available for a quick call this week?

David Ariyo
Full Stack Developer`
          ],
          active: true
        },
        
        // FOLLOW-UP 1 (Day 3)
        {
          name: 'Follow-up 1 - Soft Nudge',
          type: 'followup_1',
          subjects: [
            'Re: {{company}}',
            'Following up - {{first_name}}',
            'Still interested in connecting',
            'Quick check-in'
          ],
          bodies: [
            `Hi {{first_name}},

Just following up on my previous email about potential development support for {{company}}.

I understand you're likely busy - no pressure at all. If now isn't the right time, I'm happy to reconnect in a few months.

Would a quick 15-minute call work this week?

Best,
David`,

            `{{first_name}},

Wanted to bump this up in your inbox in case it got buried.

Still happy to discuss how I might be able to help {{company}} with any web development needs.

Let me know if you'd like to chat!

David`,

            `Hi {{first_name}},

Following up on my note about development services for {{company}}.

Even if you don't have immediate needs, I'd love to stay connected for future opportunities.

Sound good?

David Ariyo`
          ],
          active: true
        },
        
        // FOLLOW-UP 2 (Day 6)
        {
          name: 'Follow-up 2 - Medium Intent',
          type: 'followup_2',
          subjects: [
            'One more try - {{first_name}}',
            'Still available if needed',
            'Last check-in from me'
          ],
          bodies: [
            `Hi {{first_name}},

I know inboxes get crazy, so I wanted to reach out one more time.

If {{company}} is exploring any web development projects in Q1/Q2, I'd love to be considered.

Otherwise, I'll stop bothering you! 😊

Best,
David`,

            `{{first_name}},

Last follow-up from me - promise!

If there's any way I can support {{company}} with full-stack development (MERN), I'm here and ready to help.

Otherwise, wishing you all the best with your projects.

David`,

            `Hi {{first_name}},

Just wanted to reach out once more about potential development collaboration.

If the timing isn't right, totally understand. Feel free to reach back out whenever {{company}} needs technical support.

Cheers,
David Ariyo`
          ],
          active: true
        },
        
        // FOLLOW-UP 3 (Day 13)
        {
          name: 'Follow-up 3 - Light Close',
          type: 'followup_3',
          subjects: [
            'Final note - {{first_name}}',
            'Keeping {{company}} in mind',
            'Open door for future'
          ],
          bodies: [
            `Hi {{first_name}},

This will be my last email - don't want to clutter your inbox!

If {{company}} ever needs a Full Stack Developer down the road, feel free to reach out anytime.

Wishing you success with everything you're building.

Best regards,
David Ariyo`,

            `{{first_name}},

I'll leave you alone after this one! 😊

Just wanted to leave the door open - if {{company}} ever has development needs in the future, I'm just an email away.

Best of luck with everything!

David`,

            `Hi {{first_name}},

Final check-in from me. If the timing doesn't align now, no worries at all.

Feel free to keep my info for any future web development projects at {{company}}.

All the best,
David Ariyo
Full Stack Developer`
          ],
          active: true
        }
      ];
      
      await Template.insertMany(templates);
      console.log('✓ Default templates seeded successfully!');
      
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
      const update = replied 
        ? { $inc: { total_replies: 1 } }
        : {};
      
      const template = await Template.findOneAndUpdate(
        { name: templateName },
        update,
        { new: true }
      );
      
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
