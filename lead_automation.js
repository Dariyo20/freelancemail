const fs = require('fs');
const csv = require('csv-parser');
const axios = require('axios');
const cheerio = require('cheerio');
const nodemailer = require('nodemailer');
const path = require('path');
const { URL } = require('url');
require('dotenv').config();

// Configuration optimized for value-first outreach
const CONFIG = {
  EMAIL_DELAY_MIN: 180000, // 3 minutes
  EMAIL_DELAY_MAX: 420000, // 7 minutes
  MAX_EMAILS_PER_DAY: 100,  
  MAX_EMAILS_PER_HOUR: 15,
  REQUEST_TIMEOUT: 15000,
  MAX_CONCURRENT_ANALYSIS: 2,
  CSV_DIR: './csv',
  PROCESSED_CSV_DIR: './processed',
  OUTPUT_DIR: './output',
  REPORTS_DIR: './reports',
  EMAILS_DIR: './emails',
  MIN_VALUE_INDICATORS: 2,
  MAX_RETRY_ATTEMPTS: 2,
  SENDER_NAME: 'David Ariyo'
};

// TARGET CRITERIA - Companies most likely to need and afford custom development
const TARGET_CRITERIA = {
  // Primary targets - established companies with growth indicators
  PRIMARY_TITLES: [
    'ceo', 'founder', 'co-founder', 'cto', 'chief technology officer',
    'vp of engineering', 'head of product', 'technical director',
    'engineering manager', 'product manager'
  ],
  
  // Industries that frequently need custom development
  HIGH_VALUE_INDUSTRIES: [
    'software', 'technology', 'fintech', 'healthtech', 'saas',
    'e-commerce', 'marketplace', 'logistics', 'manufacturing',
    'professional services', 'consulting', 'media', 'education technology'
  ],
  
  // Company size sweet spot - big enough to afford custom work, small enough to be agile
  IDEAL_EMPLOYEE_RANGE: {
    min: 10,
    max: 500
  },
  
  // Exclude obvious non-targets
  EXCLUDE_INDUSTRIES: [
    'government', 'non-profit', 'religious', 'personal', 'student',
    'retired', 'unemployed', 'freelancer', 'individual'
  ]
};

// Value-first subject lines that demonstrate expertise
const VALUE_SUBJECT_TEMPLATES = [
  "Quick question about {companyName}'s tech architecture",
  "Interesting {techStack} setup at {companyName}",
  "{firstName}, curious about {companyName}'s development approach", 
  "Fellow developer - impressed by {companyName}'s {positiveAspect}",
  "{companyName}'s {industry} solution caught my attention",
  "Question about scaling {specificTech} at {companyName}",
  "{firstName}, {companyName} reminds me of a recent project",
  "Technical insight for {companyName}'s team"
];

// Value-first opening variations - lead with expertise and genuine interest
const VALUE_OPENING_VARIATIONS = [
  "I was reviewing {industry} companies and {companyName} stood out because of {specificPositive}. As someone who's built similar {solutionType} systems, {technicalObservation}.",
  
  "Your work at {companyName} caught my attention - particularly {specificPositive}. I recently completed a {relevantProject} project that had some interesting parallels.",
  
  "{firstName}, I came across {companyName} while researching {industry} tech stacks. Your {positiveAspect} approach is solid, and {technicalObservation}.",
  
  "Fellow {industry} builder here. I noticed {companyName} is doing interesting work with {specificTech}. {technicalObservation}.",
  
  "I've been working on similar {solutionType} challenges recently, so {companyName}'s approach to {specificPositive} caught my eye. {technicalObservation}."
];

// Genuine value proposition closings
const VALUE_CLOSING_VARIATIONS = [
  "If you're ever looking to explore this further, I'd be happy to share what we learned from our implementation.",
  "Worth a brief conversation if you're considering expanding your tech capabilities?",
  "Happy to share some technical insights if you're interested in this direction.",
  "If this resonates with current challenges you're facing, let me know.",
  "Would love to hear your thoughts on this approach if you have 15 minutes.",
  "Feel free to reach out if you'd like to discuss the technical details."
];

class ValueFirstOutreachSystem {
  constructor() {
    this.emailTransporter = null;
    this.processedCompanies = [];
    this.emailQueue = [];
    this.emailsSentToday = 0;
    this.emailsSentThisHour = 0;
    this.lastEmailTime = 0;
    this.processedEmails = new Set();
    this.dailyEmailLog = new Map();
    this.emailLogPath = path.join(CONFIG.OUTPUT_DIR, 'value_outreach_log.json');
    this.qualifiedLeadsLog = [];
    
    this.initializeDirectories();
    this.loadProcessedEmails();
    this.loadDailyEmailCount();
  }

  initializeDirectories() {
    [CONFIG.CSV_DIR, CONFIG.PROCESSED_CSV_DIR, CONFIG.OUTPUT_DIR, 
     CONFIG.REPORTS_DIR, CONFIG.EMAILS_DIR].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
      }
    });
  }

  loadProcessedEmails() {
    console.log('Loading outreach history...');
    
    try {
      if (fs.existsSync(this.emailLogPath)) {
        const emailLog = JSON.parse(fs.readFileSync(this.emailLogPath, 'utf8'));
        emailLog.forEach(entry => {
          this.processedEmails.add(entry.email.toLowerCase());
        });
        console.log(`Found ${this.processedEmails.size} previously contacted prospects`);
      }
    } catch (error) {
      console.log('Starting fresh outreach log:', error.message);
    }
  }

  loadDailyEmailCount() {
    const today = new Date().toDateString();
    const countPath = path.join(CONFIG.OUTPUT_DIR, 'daily_email_count.json');
    
    try {
      if (fs.existsSync(countPath)) {
        const dailyData = JSON.parse(fs.readFileSync(countPath, 'utf8'));
        if (dailyData.date === today) {
          this.emailsSentToday = dailyData.count || 0;
          console.log(`Already sent ${this.emailsSentToday} emails today`);
        }
      }
    } catch (error) {
      console.log('Error loading daily count:', error.message);
    }
  }

  saveDailyEmailCount() {
    const today = new Date().toDateString();
    const countPath = path.join(CONFIG.OUTPUT_DIR, 'daily_email_count.json');
    
    try {
      fs.writeFileSync(countPath, JSON.stringify({
        date: today,
        count: this.emailsSentToday
      }, null, 2));
    } catch (error) {
      console.error('Error saving daily count:', error.message);
    }
  }

  async setupEmailTransporter() {
    try {
      this.emailTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        },
        tls: {
          rejectUnauthorized: false
        },
        pool: true,
        maxConnections: 1,
        maxMessages: 2,
        rateDelta: 30000,
        rateLimit: 1
      });
      
      await this.emailTransporter.verify();
      console.log('Email system configured for value-first outreach');
      
    } catch (error) {
      console.error('Email setup failed:', error.message);
      throw error;
    }
  }

  // ENHANCED TARGET QUALIFICATION
  isHighValueTarget(company) {
    const title = (company['Title'] || '').toLowerCase();
    const industry = (company['Industry'] || '').toLowerCase();
    const employees = parseInt(company['# Employees']) || 0;
    const companyName = (company['Company'] || '').toLowerCase();

    // Check if decision maker
    const isDecisionMaker = TARGET_CRITERIA.PRIMARY_TITLES.some(targetTitle => 
      title.includes(targetTitle)
    );
    
    if (!isDecisionMaker) {
      console.log(`Skipping ${company['Company']} - not a technical decision maker (${title})`);
      return false;
    }

    // Check industry fit
    const isGoodIndustry = TARGET_CRITERIA.HIGH_VALUE_INDUSTRIES.some(targetIndustry => 
      industry.includes(targetIndustry) || companyName.includes(targetIndustry)
    );
    
    const isBadIndustry = TARGET_CRITERIA.EXCLUDE_INDUSTRIES.some(excludeIndustry => 
      industry.includes(excludeIndustry) || companyName.includes(excludeIndustry)
    );
    
    if (isBadIndustry) {
      console.log(`Skipping ${company['Company']} - excluded industry (${industry})`);
      return false;
    }

    // Company size check
    if (employees > 0 && (employees < TARGET_CRITERIA.IDEAL_EMPLOYEE_RANGE.min || 
        employees > TARGET_CRITERIA.IDEAL_EMPLOYEE_RANGE.max)) {
      console.log(`Skipping ${company['Company']} - outside ideal size range (${employees} employees)`);
      return false;
    }

    if (!isGoodIndustry && !industry.includes('technology') && !industry.includes('software')) {
      console.log(`Skipping ${company['Company']} - industry not in target list (${industry})`);
      return false;
    }

    return true;
  }

  // VALUE-FIRST SUBJECT GENERATION
  generateValueSubject(company, analysis) {
    const template = VALUE_SUBJECT_TEMPLATES[Math.floor(Math.random() * VALUE_SUBJECT_TEMPLATES.length)];
    const firstName = company['First Name'] || 'there';
    const companyName = company['Company'];
    const industry = this.cleanIndustryName(company['Industry'] || 'tech');
    
    const techStack = analysis.detectedTechnologies?.primary || 
                     analysis.detectedTechnologies?.cms?.[0] || 
                     analysis.detectedTechnologies?.frontend?.[0] || 
                     'tech stack';
                     
    const positiveAspect = analysis.positiveObservations?.[0] || 'technical approach';
    const specificTech = analysis.detectedTechnologies?.interesting?.[0] || techStack;

    return template
      .replace('{firstName}', firstName)
      .replace('{companyName}', companyName)
      .replace('{techStack}', techStack)
      .replace('{industry}', industry)
      .replace('{positiveAspect}', positiveAspect)
      .replace('{specificTech}', specificTech);
  }

  cleanIndustryName(industry) {
    return industry
      .replace('Information Technology and Services', 'tech')
      .replace('Computer Software', 'software')
      .replace('Internet', 'web')
      .toLowerCase();
  }

  // COMPREHENSIVE VALUE-FIRST ANALYSIS
  async analyzeForValue(company) {
    console.log(`Analyzing value proposition for ${company['Company']}...`);
    
    const analysis = {
      company: company['Company'],
      website: company['Website'],
      timestamp: new Date().toISOString(),
      positiveObservations: [],
      technicalInsights: [],
      relevantExperience: [],
      valueProposition: null,
      detectedTechnologies: {},
      businessContext: null,
      targetScore: 0,
      analysisSuccess: false,
      skipReason: null
    };

    // Always analyze company context first
    await this.analyzeCompanyContext(company, analysis);
    await this.identifyRelevantExperience(company, analysis);

    try {
      const cleanUrl = this.cleanWebsiteUrl(company['Website']);
      if (!cleanUrl) {
        console.log(`No website for ${company['Company']} - using company data only`);
        await this.generateContextualValue(company, analysis);
        analysis.analysisSuccess = true;
        analysis.skipReason = "No website - using company context";
        return analysis;
      }

      // Attempt website analysis
      let websiteAnalyzed = false;
      for (let attempt = 1; attempt <= CONFIG.MAX_RETRY_ATTEMPTS; attempt++) {
        try {
          console.log(`  Website analysis attempt ${attempt}/${CONFIG.MAX_RETRY_ATTEMPTS}`);
          
          const response = await axios.get(cleanUrl, { 
            timeout: CONFIG.REQUEST_TIMEOUT,
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; TechAnalyzer/1.0)'
            },
            maxRedirects: 5
          });

          const $ = cheerio.load(response.data);
          
          await this.analyzeTechnicalStack($, analysis);
          await this.identifyPositiveAspects($, analysis, company);
          await this.generateTechnicalInsights($, analysis, cleanUrl);

          websiteAnalyzed = true;
          console.log(`Website analysis successful for ${company['Company']}`);
          break;

        } catch (error) {
          console.log(`  Attempt ${attempt} failed: ${error.message}`);
          
          if (attempt < CONFIG.MAX_RETRY_ATTEMPTS) {
            await this.sleep(3000 * attempt);
          }
        }
      }

      if (!websiteAnalyzed) {
        console.log(`Website analysis failed - generating contextual value for ${company['Company']}`);
        await this.generateContextualValue(company, analysis);
        analysis.skipReason = "Website inaccessible - using company context";
      }

      analysis.analysisSuccess = true;

    } catch (error) {
      console.log(`Generating contextual value for ${company['Company']}`);
      await this.generateContextualValue(company, analysis);
      analysis.analysisSuccess = true;
      analysis.skipReason = `Using company context - ${error.message}`;
    }

    // Calculate final target score
    await this.calculateTargetScore(analysis, company);

    return analysis;
  }

  async analyzeCompanyContext(company, analysis) {
    const industry = (company['Industry'] || '').toLowerCase();
    const employees = parseInt(company['# Employees']) || 0;
    const title = (company['Title'] || '').toLowerCase();
    const companyName = company['Company'].toLowerCase();

    // Determine business context
    if (industry.includes('saas') || industry.includes('software')) {
      analysis.businessContext = 'SaaS/Software Company';
    } else if (industry.includes('fintech') || industry.includes('financial')) {
      analysis.businessContext = 'Financial Technology';
    } else if (industry.includes('health') || industry.includes('medical')) {
      analysis.businessContext = 'Healthcare Technology';
    } else if (industry.includes('education')) {
      analysis.businessContext = 'Education Technology';
    } else if (industry.includes('e-commerce') || industry.includes('retail')) {
      analysis.businessContext = 'E-commerce/Retail';
    } else if (industry.includes('logistics') || industry.includes('supply')) {
      analysis.businessContext = 'Logistics/Supply Chain';
    } else if (industry.includes('media') || industry.includes('marketing')) {
      analysis.businessContext = 'Media/Marketing Technology';
    } else {
      analysis.businessContext = 'Technology Company';
    }

    // Add contextual positive observations
    if (employees > 50) {
      analysis.positiveObservations.push('established team size and market presence');
    } else if (employees > 10) {
      analysis.positiveObservations.push('growing team and scaling operations');
    }

    if (title.includes('founder') || title.includes('ceo')) {
      analysis.positiveObservations.push('strong leadership and vision');
    } else if (title.includes('cto') || title.includes('technical')) {
      analysis.positiveObservations.push('technical leadership and architecture focus');
    }
  }

  async identifyRelevantExperience(company, analysis) {
    const industry = (company['Industry'] || '').toLowerCase();
    const businessContext = analysis.businessContext.toLowerCase();

    // Match relevant project experience
    const experienceMap = {
      'saas': {
        project: 'DAstore E-commerce Platform',
        description: 'Full-stack SaaS platform with subscription management, payment processing, and analytics',
        relevance: 'scalable architecture patterns and subscription billing systems'
      },
      'communication': {
        project: 'Dassage Communication Platform', 
        description: 'Real-time messaging system with video calls, file sharing, and team collaboration',
        relevance: 'real-time communication systems and team collaboration tools'
      },
      'hr': {
        project: 'Crewmanage HR System',
        description: 'Complete HR platform with scheduling, payroll, and workflow management',
        relevance: 'business process automation and workflow optimization'
      },
      'ecommerce': {
        project: 'Multi-vendor Marketplace',
        description: 'Custom marketplace platform with vendor management and payment splitting',
        relevance: 'complex business logic and multi-tenant architecture'
      },
      'fintech': {
        project: 'Financial Dashboard',
        description: 'Real-time financial analytics with secure payment integrations',
        relevance: 'secure financial systems and real-time data processing'
      }
    };

    // Select most relevant experience
    if (businessContext.includes('saas') || businessContext.includes('software')) {
      analysis.relevantExperience.push(experienceMap.saas);
    } else if (businessContext.includes('communication') || industry.includes('media')) {
      analysis.relevantExperience.push(experienceMap.communication);
    } else if (businessContext.includes('financial') || industry.includes('fintech')) {
      analysis.relevantExperience.push(experienceMap.fintech);
    } else if (businessContext.includes('ecommerce') || businessContext.includes('retail')) {
      analysis.relevantExperience.push(experienceMap.ecommerce);
    } else {
      // Default to most universally applicable
      analysis.relevantExperience.push(experienceMap.saas);
    }

    // Always add HR system if they have significant team size
    const employees = parseInt(company['# Employees']) || 0;
    if (employees > 20) {
      analysis.relevantExperience.push(experienceMap.hr);
    }
  }

  async analyzeTechnicalStack($, analysis) {
    const technologies = {
      frontend: [],
      backend: [],
      cms: [],
      frameworks: [],
      interesting: [],
      primary: null
    };

    const scripts = $('script[src]').map((i, el) => $(el).attr('src')).get();
    const links = $('link[href]').map((i, el) => $(el).attr('href')).get();
    const pageContent = $('body').html() || '';
    const allContent = scripts.join(' ') + ' ' + links.join(' ') + ' ' + pageContent;

    // Modern framework detection
    if (allContent.includes('react') || allContent.includes('_next/')) {
      technologies.frontend.push('React');
      technologies.interesting.push('React');
      if (!technologies.primary) technologies.primary = 'React';
    }
    if (allContent.includes('vue') || allContent.includes('nuxt')) {
      technologies.frontend.push('Vue.js');
      technologies.interesting.push('Vue.js');
      if (!technologies.primary) technologies.primary = 'Vue.js';
    }
    if (allContent.includes('angular')) {
      technologies.frontend.push('Angular');
      technologies.interesting.push('Angular');
      if (!technologies.primary) technologies.primary = 'Angular';
    }

    // Backend/Platform detection
    if (allContent.includes('wp-content') || allContent.includes('wordpress')) {
      technologies.cms.push('WordPress');
      technologies.primary = technologies.primary || 'WordPress';
    }
    if (allContent.includes('shopify')) {
      technologies.cms.push('Shopify');
      technologies.interesting.push('Shopify');
      technologies.primary = technologies.primary || 'Shopify';
    }
    if (allContent.includes('webflow')) {
      technologies.cms.push('Webflow');
      technologies.primary = technologies.primary || 'Webflow';
    }

    // Set default if nothing detected
    if (!technologies.primary) {
      technologies.primary = 'custom stack';
    }

    analysis.detectedTechnologies = technologies;
  }

  async identifyPositiveAspects($, analysis, company) {
    const pageText = $('body').text().toLowerCase();
    const title = $('title').text();
    const metaDescription = $('meta[name="description"]').attr('content') || '';

    // Look for genuine positive indicators
    const positiveIndicators = {
      'clean, modern design': pageText.length > 1000 && $('nav').length > 0,
      'strong brand presence': title.length > 10 && metaDescription.length > 50,
      'user-focused content': pageText.includes('customer') || pageText.includes('user'),
      'established platform': pageText.includes('since') || pageText.includes('established'),
      'growth indicators': pageText.includes('growing') || pageText.includes('expanding'),
      'technical sophistication': analysis.detectedTechnologies.frontend.length > 0,
      'professional presentation': $('img').length > 3 && $('section').length > 2
    };

    // Add genuine observations
    Object.entries(positiveIndicators).forEach(([observation, condition]) => {
      if (condition) {
        analysis.positiveObservations.push(observation);
      }
    });

    // Ensure at least one positive observation
    if (analysis.positiveObservations.length === 0) {
      analysis.positiveObservations.push('professional online presence');
    }
  }

  async generateTechnicalInsights($, analysis, websiteUrl) {
    const pageContent = $('body').html() || '';
    const technologies = analysis.detectedTechnologies;

    // Generate genuine technical insights based on what we observe
    if (technologies.primary === 'React' && technologies.frontend.includes('React')) {
      analysis.technicalInsights.push('React implementation suggests strong frontend capabilities - similar architecture to our recent SaaS projects');
    }
    
    if (technologies.cms.includes('WordPress') && pageContent.length > 5000) {
      analysis.technicalInsights.push('WordPress site with substantial content - good foundation for headless CMS architecture we\'ve implemented elsewhere');
    }

    if (technologies.cms.includes('Shopify')) {
      analysis.technicalInsights.push('Shopify platform indicates e-commerce focus - we\'ve built custom integrations and advanced features for similar setups');
    }

    if (pageContent.includes('api') || pageContent.includes('integration')) {
      analysis.technicalInsights.push('API/integration mentions suggest technical depth - aligns with our integration expertise');
    }

    // Default insight if none generated
    if (analysis.technicalInsights.length === 0) {
      analysis.technicalInsights.push(`${technologies.primary} setup indicates solid technical foundation - reminds me of architecture decisions we made in recent projects`);
    }
  }

  async generateContextualValue(company, analysis) {
    const industry = (company['Industry'] || '').toLowerCase();
    const employees = parseInt(company['# Employees']) || 0;
    const title = (company['Title'] || '').toLowerCase();

    // Generate contextual insights without website
    if (industry.includes('software') || industry.includes('technology')) {
      analysis.technicalInsights.push('Technology company suggests sophisticated development needs - similar to scaling challenges we\'ve solved recently');
      analysis.positiveObservations.push('established technology focus and team');
    }

    if (employees > 50) {
      analysis.technicalInsights.push('Team size indicates mature operations - similar to enterprise-scale solutions we\'ve built');
      analysis.positiveObservations.push('substantial team and operational scale');
    }

    if (title.includes('cto') || title.includes('technical')) {
      analysis.technicalInsights.push('Technical leadership role suggests architecture-level thinking - aligns with our strategic development approach');
    }

    // Ensure minimum positive observations
    if (analysis.positiveObservations.length === 0) {
      analysis.positiveObservations.push('established market presence and team');
    }

    if (analysis.technicalInsights.length === 0) {
      analysis.technicalInsights.push(`${analysis.businessContext} focus indicates development needs that align with our recent project experience`);
    }
  }

  async calculateTargetScore(analysis, company) {
    let score = 0;
    
    // Base score for being a qualified target
    score += 3;
    
    // Technical insights quality
    score += Math.min(analysis.technicalInsights.length * 1.5, 3);
    
    // Positive observations
    score += Math.min(analysis.positiveObservations.length * 0.5, 2);
    
    // Relevant experience match
    score += analysis.relevantExperience.length;
    
    // Website analysis success
    if (analysis.analysisSuccess && !analysis.skipReason?.includes('Website')) {
      score += 1;
    }
    
    // Decision maker level
    const title = (company['Title'] || '').toLowerCase();
    if (title.includes('ceo') || title.includes('founder')) score += 2;
    else if (title.includes('cto') || title.includes('technical')) score += 1.5;
    
    analysis.targetScore = Math.min(score, 10);
  }

  // VALUE-FIRST EMAIL GENERATION
  generateValueProposal(company, analysis) {
    if (!this.shouldContact(analysis)) {
      return null;
    }

    console.log(`Generating value-first proposal for ${company['Company']}...`);
    
    const proposal = {
      companyName: company['Company'],
      contactName: `${company['First Name']} ${company['Last Name']}`,
      firstName: company['First Name'],
      title: company['Title'],
      industry: company['Industry'],
      email: company['Email'],
      businessContext: analysis.businessContext,
      positiveObservations: analysis.positiveObservations,
      technicalInsights: analysis.technicalInsights,
      relevantExperience: analysis.relevantExperience,
      detectedTechnologies: analysis.detectedTechnologies,
      valueMessage: this.createValueMessage(company, analysis),
      valueSubject: this.generateValueSubject(company, analysis),
      targetScore: analysis.targetScore
    };

    return proposal;
  }

  createValueMessage(company, analysis) {
    const firstName = company['First Name'] || 'there';
    const companyName = company['Company'];
    const industry = this.cleanIndustryName(company['Industry'] || 'tech');
    
    // Dynamic opening
    const openingTemplate = VALUE_OPENING_VARIATIONS[Math.floor(Math.random() * VALUE_OPENING_VARIATIONS.length)];
    
    const specificPositive = analysis.positiveObservations[0] || 'professional approach';
    const technicalObservation = analysis.technicalInsights[0] || `it reminds me of architecture challenges we've solved recently`;
    const solutionType = analysis.businessContext.toLowerCase();
    const relevantProject = analysis.relevantExperience[0]?.project || 'similar platform';
    const positiveAspect = analysis.positiveObservations[0] || 'technical approach';
    const specificTech = analysis.detectedTechnologies?.primary || 'tech stack';

    let message = `${openingTemplate
      .replace('{firstName}', firstName)
      .replace('{companyName}', companyName)
      .replace('{industry}', industry)
      .replace('{specificPositive}', specificPositive)
      .replace('{technicalObservation}', technicalObservation)
      .replace('{solutionType}', solutionType)
      .replace('{relevantProject}', relevantProject)
      .replace('{positiveAspect}', positiveAspect)
      .replace('{specificTech}', specificTech)}\n\n`;

    // Professional introduction
    message += `I'm David Ariyo, a Full Stack Developer specializing in MERN stack solutions. `;
    message += `I focus on building scalable, production-ready applications for ${solutionType.includes('tech') ? 'technology companies' : `${industry} companies`}.\n\n`;

    // Relevant experience (specific and credible)
    const primaryExperience = analysis.relevantExperience[0];
    if (primaryExperience) {
      message += `Recent relevant work:\n`;
      message += `• ${primaryExperience.project}: ${primaryExperience.description}\n`;
      if (analysis.relevantExperience.length > 1) {
        message += `• ${analysis.relevantExperience[1].project}: ${analysis.relevantExperience[1].description}\n`;
      }
      message += `\n`;
      message += `This experience is relevant because ${primaryExperience.relevance}.\n\n`;
    }

    // Technical insight (shows we understand their context)
    message += `Technical insight: ${analysis.technicalInsights[0] || `Your ${analysis.businessContext} setup suggests similar scaling challenges to projects we've recently completed`}.\n\n`;

    // Value-focused closing
    const closingTemplate = VALUE_CLOSING_VARIATIONS[Math.floor(Math.random() * VALUE_CLOSING_VARIATIONS.length)];
    message += closingTemplate.replace('{companyName}', companyName) + '\n\n';

    // Professional signature
    message += this.generateValueSignature();

    return message;
  }

  generateValueSignature() {
    return `Best regards,\n` +
           `${CONFIG.SENDER_NAME}\n` +
           `Full Stack Developer | MERN Stack Specialist\n` +
           `Recent Projects: SaaS Platforms, Real-time Applications, E-commerce Systems\n` +
           `davidariyo109@gmail.com | (+234) 903-6184-863\n` +
           `Portfolio: davidariyo.onrender.com\n` +
           `LinkedIn: linkedin.com/in/david-ariyo-123da`;
  }

  shouldContact(analysis) {
    // Only contact high-value targets with genuine value proposition
    if (analysis.targetScore < 5) {
      console.log(`Low target score: ${analysis.targetScore}/10`);
      return false;
    }

    if (analysis.technicalInsights.length === 0) {
      console.log('No genuine technical insights identified');
      return false;
    }

    if (analysis.positiveObservations.length === 0) {
      console.log('No positive observations to reference');
      return false;
    }

    return true;
  }

  // EMAIL VALIDATION (enhanced for business quality)
  async validateHighValueProspects(companies) {
    console.log('Validating high-value prospects...');
    
    const validCompanies = [];
    const rejectedProspects = [];
    
    for (const company of companies) {
      const email = company['Email'];
      
      // Basic email validation
      if (!email || !this.isValidBusinessEmail(email)) {
        rejectedProspects.push({
          company: company['Company'],
          email: email || 'missing',
          reason: 'Invalid or non-business email'
        });
        continue;
      }

      // Target qualification check
      if (!this.isHighValueTarget(company)) {
        rejectedProspects.push({
          company: company['Company'],
          email: email,
          reason: 'Not in target criteria (title/industry/size)'
        });
        continue;
      }

      const correctedEmail = this.correctCommonEmailTypos(email);
      if (correctedEmail !== email) {
        console.log(`Auto-corrected: ${email} -> ${correctedEmail}`);
        company['Email'] = correctedEmail;
      }

      validCompanies.push(company);
    }

    if (rejectedProspects.length > 0) {
      const rejectedPath = path.join(CONFIG.OUTPUT_DIR, 'rejected_prospects.json');
      fs.writeFileSync(rejectedPath, JSON.stringify(rejectedProspects, null, 2));
      console.log(`${rejectedProspects.length} prospects rejected (see rejected_prospects.json)`);
    }

    console.log(`${validCompanies.length} high-value prospects qualified`);
    return validCompanies;
  }

  isValidBusinessEmail(email) {
    if (!email || typeof email !== 'string') return false;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return false;
    
    // Enhanced business email detection
    const personalDomains = [
      'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 
      'aol.com', 'icloud.com', 'protonmail.com', 'mail.com',
      'yandex.com', 'zoho.com'
    ];
    
    const domain = email.split('@')[1]?.toLowerCase();
    return !personalDomains.includes(domain);
  }

  correctCommonEmailTypos(email) {
    const corrections = {
      'gmial.com': 'gmail.com',
      'gmai.com': 'gmail.com',
      'yahooo.com': 'yahoo.com',
      'yaho.com': 'yahoo.com',
      'hotmial.com': 'hotmail.com',
      'outlokk.com': 'outlook.com'
    };

    let corrected = email.toLowerCase();
    for (const [typo, correct] of Object.entries(corrections)) {
      corrected = corrected.replace(typo, correct);
    }

    return corrected;
  }

  // ENHANCED EMAIL SENDING
  async sendValueEmail(proposal) {
    if (!proposal.email || !this.isValidBusinessEmail(proposal.email)) {
      console.log(`Invalid email for ${proposal.companyName}`);
      return false;
    }

    if (this.emailsSentToday >= CONFIG.MAX_EMAILS_PER_DAY) {
      console.log('Daily email limit reached. Quality over quantity approach maintained.');
      return false;
    }

    if (this.emailsSentThisHour >= CONFIG.MAX_EMAILS_PER_HOUR) {
      console.log('Hourly limit reached - maintaining professional pacing...');
      await this.sleep(3600000); // Wait 1 hour
      this.emailsSentThisHour = 0;
    }

    const timeSinceLastEmail = Date.now() - this.lastEmailTime;
    if (timeSinceLastEmail < CONFIG.EMAIL_DELAY_MIN) {
      const delay = CONFIG.EMAIL_DELAY_MIN - timeSinceLastEmail;
      console.log(`Professional pacing: waiting ${Math.round(delay/1000)}s...`);
      await this.sleep(delay);
    }

    const mailOptions = {
      from: `"${CONFIG.SENDER_NAME} - Full Stack Developer" <${process.env.EMAIL_USER}>`,
      to: proposal.email,
      subject: proposal.valueSubject,
      text: proposal.valueMessage,
      html: this.convertToHTML(proposal.valueMessage),
      replyTo: process.env.EMAIL_USER
    };

    try {
      await this.emailTransporter.sendMail(mailOptions);
      console.log(`Value-first outreach sent to ${proposal.contactName} at ${proposal.companyName} (Score: ${proposal.targetScore}/10)`);
      
      this.processedEmails.add(proposal.email.toLowerCase());
      this.emailsSentToday++;
      this.emailsSentThisHour++;
      this.lastEmailTime = Date.now();
      
      this.logValueOutreach(proposal);
      this.saveDailyEmailCount();
      
      return true;
    } catch (error) {
      console.error(`Failed to send to ${proposal.companyName}:`, error.message);
      return false;
    }
  }

  convertToHTML(message) {
    return message
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<div style="font-family: Georgia, serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;"><p>')
      .replace(/$/, '</p></div>')
      .replace(/• /g, '• '); // Preserve bullet points
  }

  logValueOutreach(proposal) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      company: proposal.companyName,
      contact: proposal.contactName,
      email: proposal.email,
      subject: proposal.valueSubject,
      businessContext: proposal.businessContext,
      targetScore: proposal.targetScore,
      positiveObservations: proposal.positiveObservations.length,
      technicalInsights: proposal.technicalInsights.length,
      relevantExperience: proposal.relevantExperience.map(exp => exp.project)
    };
    
    let logs = [];
    
    try {
      if (fs.existsSync(this.emailLogPath)) {
        logs = JSON.parse(fs.readFileSync(this.emailLogPath, 'utf8'));
      }
      
      logs.push(logEntry);
      fs.writeFileSync(this.emailLogPath, JSON.stringify(logs, null, 2));
    } catch (error) {
      console.error('Error logging outreach:', error.message);
    }
  }

  // MAIN EXECUTION
  async run() {
    console.log('Starting Value-First Developer Outreach...');
    console.log(`Daily limit: ${CONFIG.MAX_EMAILS_PER_DAY} high-quality emails`);
    console.log(`Current target: Technical decision makers at 10-500 person companies`);
    console.log(`Already sent today: ${this.emailsSentToday} emails`);
    
    try {
      await this.setupEmailTransporter();
      
      const { companies, processedFiles } = await this.processCSVFiles();
      
      if (companies.length === 0) {
        console.log('No new companies to process');
        return;
      }

      console.log(`\nTARGET QUALIFICATION:`);
      console.log(`Initial prospects: ${companies.length}`);

      const validatedCompanies = await this.validateHighValueProspects(companies);
      
      if (validatedCompanies.length === 0) {
        console.log('No qualified high-value targets found');
        console.log('\nTARGET CRITERIA REMINDER:');
        console.log('• Title: CEO, CTO, Founder, VP Engineering, Technical Director');
        console.log('• Industry: Technology, Software, SaaS, FinTech, E-commerce');
        console.log('• Size: 10-500 employees');
        console.log('• Email: Business domain only');
        return;
      }
      
      console.log(`Qualified high-value targets: ${validatedCompanies.length}`);
      console.log(`Analyzing for value proposition and technical fit...`);
      
      const batchSize = CONFIG.MAX_CONCURRENT_ANALYSIS;
      let totalProcessed = 0;
      let totalQualified = 0;
      let totalRejected = 0;
      
      for (let i = 0; i < validatedCompanies.length; i += batchSize) {
        const batch = validatedCompanies.slice(i, i + batchSize);
        const batchNumber = Math.floor(i/batchSize) + 1;
        const totalBatches = Math.ceil(validatedCompanies.length/batchSize);
        
        console.log(`\nAnalyzing batch ${batchNumber}/${totalBatches} (${batch.length} companies)`);
        
        const batchResults = await Promise.allSettled(batch.map(async (company) => {
          try {
            if (this.isAlreadyProcessed(company)) {
              console.log(`Skipping ${company['Company']} - already contacted`);
              return { status: 'skipped', reason: 'already contacted' };
            }

            const analysis = await this.analyzeForValue(company);
            const proposal = this.generateValueProposal(company, analysis);
            
            if (!proposal) {
              console.log(`Rejected ${company['Company']} - insufficient value proposition (Score: ${analysis.targetScore}/10)`);
              this.qualifiedLeadsLog.push({
                company: company['Company'],
                reason: 'insufficient value proposition',
                targetScore: analysis.targetScore,
                technicalInsights: analysis.technicalInsights.length,
                positiveObservations: analysis.positiveObservations.length
              });
              return { status: 'rejected', reason: 'insufficient value' };
            }
            
            this.emailQueue.push({ proposal });
            
            await this.saveValueAnalysis(company, analysis, proposal);
            
            console.log(`✓ Qualified ${company['Company']} for outreach (Score: ${proposal.targetScore}/10)`);
            return { status: 'qualified', company: company['Company'], score: proposal.targetScore };
            
          } catch (error) {
            console.error(`Error analyzing ${company['Company']}:`, error.message);
            return { status: 'error', company: company['Company'], error: error.message };
          }
        }));
        
        batchResults.forEach(result => {
          if (result.status === 'fulfilled') {
            if (result.value.status === 'qualified') totalQualified++;
            else if (result.value.status === 'rejected') totalRejected++;
            totalProcessed++;
          }
        });
        
        // Professional pacing between batches
        if (i + batchSize < validatedCompanies.length) {
          console.log('Pausing between analysis batches...');
          await this.sleep(10000);
        }
      }
      
      console.log(`\nANALYSIS COMPLETE:`);
      console.log(`  Total analyzed: ${totalProcessed}`);
      console.log(`  Qualified for value outreach: ${totalQualified}`);
      console.log(`  Rejected (insufficient value): ${totalRejected}`);
      
      if (this.emailQueue.length > 0 && this.emailsSentToday < CONFIG.MAX_EMAILS_PER_DAY) {
        const remainingCapacity = CONFIG.MAX_EMAILS_PER_DAY - this.emailsSentToday;
        const emailsToSend = Math.min(this.emailQueue.length, remainingCapacity);
        
        console.log(`\nStarting high-value outreach (${emailsToSend} qualified prospects)...`);
        
        // Sort by target score (highest first)
        this.emailQueue.sort((a, b) => b.proposal.targetScore - a.proposal.targetScore);
        
        await this.processValueEmailQueue(emailsToSend);
      } else if (this.emailsSentToday >= CONFIG.MAX_EMAILS_PER_DAY) {
        console.log(`Daily email limit reached (${this.emailsSentToday}/${CONFIG.MAX_EMAILS_PER_DAY}). Quality-focused approach maintained.`);
      }
      
      // Move processed files
      for (const file of processedFiles) {
        await this.moveProcessedCSV(file);
      }
      
      await this.generateValueReport();
      
      console.log('\nValue-first outreach campaign complete!');
      
    } catch (error) {
      console.error('System error:', error);
    }
  }

  async processValueEmailQueue(maxEmails = null) {
    const emailsToProcess = maxEmails ? this.emailQueue.slice(0, maxEmails) : this.emailQueue;
    
    if (emailsToProcess.length === 0) {
      console.log('No qualified prospects for outreach');
      return;
    }

    console.log(`Sending value-first outreach to ${emailsToProcess.length} high-quality prospects...`);
    let successfulSends = 0;
    let skippedEmails = 0;
    
    for (const emailData of emailsToProcess) {
      if (this.emailsSentToday >= CONFIG.MAX_EMAILS_PER_DAY) {
        console.log('Daily email limit reached. Remaining high-quality prospects saved for tomorrow.');
        break;
      }

      const success = await this.sendValueEmail(emailData.proposal);
      
      if (success) {
        successfulSends++;
      } else {
        skippedEmails++;
      }

      // Professional pacing with more variation
      const baseDelay = CONFIG.EMAIL_DELAY_MIN;
      const randomVariation = Math.random() * (CONFIG.EMAIL_DELAY_MAX - CONFIG.EMAIL_DELAY_MIN);
      const totalDelay = baseDelay + randomVariation;
      
      console.log(`Professional pacing: ${Math.round(totalDelay/1000)}s delay...`);
      await this.sleep(totalDelay);
    }
    
    console.log(`Value outreach complete: ${successfulSends} sent, ${skippedEmails} skipped`);
    console.log(`Daily total: ${this.emailsSentToday}/${CONFIG.MAX_EMAILS_PER_DAY} quality emails sent`);
  }

  async saveValueAnalysis(company, analysis, proposal) {
    const result = {
      company: company['Company'],
      contact: `${company['First Name']} ${company['Last Name']}`,
      email: company['Email'],
      targetScore: analysis.targetScore,
      businessContext: analysis.businessContext,
      analysis,
      proposal,
      processedAt: new Date().toISOString()
    };
    
    const filename = `${company['Company'].replace(/[^a-z0-9]/gi, '_')}_value_analysis.json`;
    const filepath = path.join(CONFIG.OUTPUT_DIR, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
    this.processedCompanies.push(result);
  }

  async generateValueReport() {
    const highValueContacts = this.processedCompanies.filter(c => c.targetScore >= 7);
    const mediumValueContacts = this.processedCompanies.filter(c => c.targetScore >= 5 && c.targetScore < 7);
    
    const summary = {
      campaignType: 'Value-First Technical Outreach',
      totalAnalyzed: this.processedCompanies.length,
      totalContacted: this.emailsSentToday,
      highValueContacts: highValueContacts.length,
      mediumValueContacts: mediumValueContacts.length,
      averageTargetScore: this.calculateAverageTargetScore(),
      topIndustries: this.getTopIndustries(),
      targetCriteriaMet: this.emailQueue.length,
      rejectedLowValue: this.qualifiedLeadsLog.length,
      generatedAt: new Date().toISOString()
    };
    
    const summaryPath = path.join(CONFIG.OUTPUT_DIR, 'value_campaign_summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    
    console.log('\nVALUE CAMPAIGN SUMMARY:');
    console.log('========================');
    console.log(`Companies analyzed: ${summary.totalAnalyzed}`);
    console.log(`High-value targets (7+ score): ${summary.highValueContacts}`);
    console.log(`Emails sent today: ${summary.totalContacted}/${CONFIG.MAX_EMAILS_PER_DAY}`);
    console.log(`Average target score: ${summary.averageTargetScore.toFixed(1)}/10`);
    console.log(`Top industries: ${summary.topIndustries.join(', ')}`);
  }

  calculateAverageTargetScore() {
    if (this.processedCompanies.length === 0) return 0;
    
    const totalScore = this.processedCompanies.reduce((sum, c) => sum + (c.targetScore || 0), 0);
    return totalScore / this.processedCompanies.length;
  }

  getTopIndustries() {
    const industries = {};
    this.processedCompanies.forEach(c => {
      const industry = c.analysis?.businessContext || 'Unknown';
      industries[industry] = (industries[industry] || 0) + 1;
    });
    
    return Object.entries(industries)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([industry]) => industry);
  }

  // CSV PROCESSING (same as before but with validation)
  async processCSVFiles() {
    const csvFiles = await this.findCSVFiles();
    
    if (csvFiles.length === 0) {
      console.log('No CSV files found in csv/ directory');
      console.log('Please add your Apollo CSV exports to the csv/ folder');
      console.log('\nTarget CSV should include: First Name, Last Name, Title, Company, Email, Website, Industry, # Employees');
      return { companies: [], processedFiles: [] };
    }

    let allCompanies = [];
    let processedFiles = [];

    for (const file of csvFiles) {
      console.log(`\nProcessing: ${file.name}`);
      
      const validation = await this.validateCSV(file.path);
      if (!validation.isValid) {
        console.log(`Skipping ${file.name} - missing required columns`);
        continue;
      }

      try {
        const companies = await this.readCSV(file.path);
        const originalCount = companies.length;
        
        const newCompanies = companies.filter(company => {
          const email = company['Email'];
          if (!email) return false;
          
          const isProcessed = this.processedEmails.has(email.toLowerCase());
          
          if (isProcessed) {
            console.log(`Skipping ${company['Company']} - already contacted`);
          }
          
          return !isProcessed;
        });

        console.log(`${file.name}: ${originalCount} total, ${newCompanies.length} new, ${originalCount - newCompanies.length} already processed`);
        
        if (newCompanies.length > 0) {
          allCompanies = allCompanies.concat(newCompanies);
          processedFiles.push(file);
        }

      } catch (error) {
        console.log(`Error processing ${file.name}: ${error.message}`);
      }
    }

    console.log(`\nTotal new prospects to analyze: ${allCompanies.length}`);
    return { companies: allCompanies, processedFiles };
  }

  cleanWebsiteUrl(url) {
    if (!url) return null;
    
    try {
      let cleanUrl = url.trim().toLowerCase();
      
      if (cleanUrl.startsWith('www.')) {
        cleanUrl = 'https://' + cleanUrl;
      } else if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = 'https://' + cleanUrl;
      }
      
      const urlObj = new URL(cleanUrl);
      
      const invalidDomains = ['example.com', 'test.com', 'placeholder.com', 'domain.com'];
      if (invalidDomains.some(domain => urlObj.hostname.includes(domain))) {
        return null;
      }
      
      return cleanUrl;
    } catch (error) {
      return null;
    }
  }

  async validateCSV(filePath) {
    console.log(`Validating CSV format: ${path.basename(filePath)}`);
    
    return new Promise((resolve) => {
      const requiredColumns = [
        'First Name', 'Last Name', 'Title', 'Company', 
        'Email', 'Website', 'Industry', '# Employees'
      ];
      
      let headerChecked = false;
      let isValid = false;
      let foundColumns = [];

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('headers', (headers) => {
          foundColumns = headers;
          const hasRequired = requiredColumns.every(col => headers.includes(col));
          
          if (hasRequired) {
            console.log('CSV format validated - all required columns present');
            isValid = true;
          } else {
            const missing = requiredColumns.filter(col => !headers.includes(col));
            console.log(`CSV missing required columns: ${missing.join(', ')}`);
          }
          headerChecked = true;
        })
        .on('data', () => {
          if (headerChecked) {
            resolve({ isValid, foundColumns });
          }
        })
        .on('end', () => {
          if (!headerChecked) {
            resolve({ isValid: false, foundColumns: [] });
          } else {
            resolve({ isValid, foundColumns });
          }
        })
        .on('error', (error) => {
          console.log(`Error reading CSV: ${error.message}`);
          resolve({ isValid: false, foundColumns: [] });
        });
    });
  }

  async readCSV(filePath) {
    return new Promise((resolve, reject) => {
      const companies = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => companies.push(data))
        .on('end', () => resolve(companies))
        .on('error', reject);
    });
  }

  async findCSVFiles() {
    console.log('Scanning for CSV files...');
    
    if (!fs.existsSync(CONFIG.CSV_DIR)) {
      console.log(`CSV directory not found: ${CONFIG.CSV_DIR}`);
      console.log('Please create a "csv" folder and place your Apollo CSV files there');
      return [];
    }

    const files = fs.readdirSync(CONFIG.CSV_DIR)
      .filter(file => file.toLowerCase().endsWith('.csv'))
      .map(file => ({
        name: file,
        path: path.join(CONFIG.CSV_DIR, file),
        stats: fs.statSync(path.join(CONFIG.CSV_DIR, file))
      }))
      .sort((a, b) => b.stats.mtime - a.stats.mtime);

    console.log(`Found ${files.length} CSV files:`);
    files.forEach((file, index) => {
      console.log(`${index + 1}. ${file.name} (${file.stats.size} bytes)`);
    });

    return files;
  }

  isAlreadyProcessed(company) {
    const email = company['Email'];
    if (!email) return true;
    
    return this.processedEmails.has(email.toLowerCase());
  }

  async moveProcessedCSV(file) {
    const timestamp = new Date().toISOString().split('T')[0];
    const newName = `${timestamp}_${file.name}`;
    const newPath = path.join(CONFIG.PROCESSED_CSV_DIR, newName);
    
    try {
      fs.renameSync(file.path, newPath);
      console.log(`Moved processed CSV: ${file.name} -> processed/${newName}`);
    } catch (error) {
      console.log(`Could not move CSV file: ${error.message}`);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // UTILITY METHODS
  async getStatus() {
    const csvFiles = await this.findCSVFiles();
    const processedCSVs = fs.existsSync(CONFIG.PROCESSED_CSV_DIR) ? 
      fs.readdirSync(CONFIG.PROCESSED_CSV_DIR).filter(f => f.endsWith('.csv')) : [];
    
    console.log('\nVALUE-FIRST OUTREACH SYSTEM STATUS:');
    console.log('====================================');
    console.log(`CSV files ready: ${csvFiles.length}`);
    console.log(`CSV files processed: ${processedCSVs.length}`);
    console.log(`High-value prospects contacted: ${this.processedEmails.size}`);
    console.log(`Emails sent today: ${this.emailsSentToday}/${CONFIG.MAX_EMAILS_PER_DAY}`);
    console.log('');
    console.log('TARGET CRITERIA:');
    console.log(`• Titles: ${TARGET_CRITERIA.PRIMARY_TITLES.slice(0, 5).join(', ')}...`);
    console.log(`• Industries: ${TARGET_CRITERIA.HIGH_VALUE_INDUSTRIES.slice(0, 5).join(', ')}...`);
    console.log(`• Company size: ${TARGET_CRITERIA.IDEAL_EMPLOYEE_RANGE.min}-${TARGET_CRITERIA.IDEAL_EMPLOYEE_RANGE.max} employees`);
    console.log(`• Email: Business domains only`);
    console.log('');
    console.log('VALUE-FIRST FEATURES:');
    console.log(`• ${VALUE_SUBJECT_TEMPLATES.length} professional subject variations`);
    console.log(`• ${VALUE_OPENING_VARIATIONS.length} value-focused openings`);
    console.log(`• Technical insight generation`);
    console.log(`• Relevant experience matching`);
    console.log(`• Professional pacing (${CONFIG.EMAIL_DELAY_MIN/1000}-${CONFIG.EMAIL_DELAY_MAX/1000}s)`);
    console.log(`• Quality scoring (5+ required)`);
    
    return {
      pendingCSVs: csvFiles.length,
      processedCSVs: processedCSVs.length,
      contactedProspects: this.processedEmails.size,
      dailyEmailCount: this.emailsSentToday,
      dailyLimit: CONFIG.MAX_EMAILS_PER_DAY,
      targetQuality: 'High-value technical decision makers'
    };
  }

  resetOutreachHistory() {
    console.log('Resetting outreach history...');
    this.processedEmails.clear();
    this.emailsSentToday = 0;
    
    try {
      if (fs.existsSync(this.emailLogPath)) {
        fs.unlinkSync(this.emailLogPath);
      }
      const dailyCountPath = path.join(CONFIG.OUTPUT_DIR, 'daily_email_count.json');
      if (fs.existsSync(dailyCountPath)) {
        fs.unlinkSync(dailyCountPath);
      }
      console.log('All tracking files deleted');
      console.log('All prospects can now be contacted again');
    } catch (error) {
      console.error('Error deleting files:', error.message);
    }
  }
}

// MAIN EXECUTION
async function main() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.log('Email credentials required!');
    console.log('');
    console.log('GMAIL SETUP:');
    console.log('1. Enable 2-Factor Authentication');
    console.log('2. Generate App Password: https://support.google.com/accounts/answer/185833');
    console.log('3. Create .env file:');
    console.log('   EMAIL_USER=your-email@gmail.com');
    console.log('   EMAIL_PASSWORD=your-16-char-app-password');
    return;
  }

  const system = new ValueFirstOutreachSystem();
  
  const command = process.argv[2];
  
  if (command === 'status') {
    await system.getStatus();
    return;
  }
  
  if (command === 'reset') {
    system.resetOutreachHistory();
    return;
  }
  
  if (command === 'test') {
    console.log('Running in test mode...');
    CONFIG.MAX_CONCURRENT_ANALYSIS = 1;
    CONFIG.MAX_EMAILS_PER_DAY = 3;
    CONFIG.MAX_EMAILS_PER_HOUR = 1;
    console.log('Test mode: 1 concurrent analysis, max 3 emails/day, 1/hour');
  }
  
  try {
    await system.run();
  } catch (error) {
    console.error('System error:', error);
    process.exit(1);
  }
}

// SYSTEM INFORMATION
console.log('Value-First Developer Outreach System');
console.log('=====================================');
console.log('Focus: High-quality prospects who want to hear from you');
console.log('');
console.log('KEY FEATURES:');
console.log('• Targets technical decision makers (CTO, CEO, Founders)');
console.log('• 10-500 employee companies in tech/software/SaaS');
console.log('• Business email addresses only');
console.log('• Value-first messaging (no assumptions about problems)');
console.log('• Technical insights based on real analysis');
console.log('• Relevant experience matching');
console.log('• Professional pacing and daily limits');
console.log('');
console.log('DIRECTORY STRUCTURE:');
console.log('  csv/       - Place Apollo CSV exports here');
console.log('  processed/ - Processed CSV files');
console.log('  output/    - Analysis results and logs');
console.log('');
console.log('COMMANDS:');
console.log('  node value-outreach.js        - Run value-first outreach');
console.log('  node value-outreach.js status - System status');
console.log('  node value-outreach.js reset  - Reset outreach history');
console.log('  node value-outreach.js test   - Test mode (limited)');
console.log('');
console.log('TARGET REMINDER:');
console.log('Best results with Apollo exports targeting:');
console.log('• CTOs, CEOs, Founders, VPs of Engineering');
console.log('• Software/Technology/SaaS companies');
console.log('• 10-500 employees');
console.log('• Business email addresses');

if (require.main === module) {
  main().catch(console.error);
}

module.exports = ValueFirstOutreachSystem;