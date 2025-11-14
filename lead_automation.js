const fs = require('fs');
const csv = require('csv-parser');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// 🚀 ENHANCED APOLLO LEAD AUTOMATION - 100% FREE
// Groq API (primary) + Gemini fallback + Nigerian tech news

const CONFIG = {
  CSV_DIR: './csv',
  RESEARCH_DIR: './research_reports',
  DRAFTS_DIR: './email_drafts',
  REQUEST_TIMEOUT: 15000,
  RESEARCH_DELAY: 2000,
  MAX_NEWS_ARTICLES: 5,
  NEWS_AGE_DAYS: 90, // Increased for African tech news
  MIN_CONFIDENCE_TO_SEND: 75, // Lowered slightly for better results
  MIN_CONFIDENCE_TO_REVIEW: 55,
  NIGERIAN_TECH_SOURCES: [
    'techpoint.africa',
    'techcabal.com',
    'technext.ng',
    'techeconomy.ng',
    'nairametrics.com',
    'businessday.ng',
    'guardian.ng/technology',
    'thecable.ng/category/technology',
    'venturesafrica.com'
  ]
};

const YOUR_EXPERIENCE = {
  projects: [
    {
      name: "Dassage Communication Platform",
      description: "Real-time messaging with video calls, file sharing, WebSocket architecture",
      techStack: ["React", "Node.js", "MongoDB", "WebSocket", "JWT"],
      keywords: ["real-time", "messaging", "video", "communication", "collaboration", "websocket", "chat", "unified communications", "team collaboration"],
      techMatches: ["avaya", "8x8", "vonage", "twilio", "zoom", "slack", "teams", "webrtc"],
      industryFit: ["saas", "communication", "telecommunications", "team collaboration", "remote work", "productivity", "software"],
      scale: "100+ concurrent users"
    },
    {
      name: "DAstore E-Commerce Platform",
      description: "Luxury e-commerce with 140+ products, payment processing, cart management",
      techStack: ["Next.js", "MongoDB", "REST API", "JWT", "bcrypt"],
      keywords: ["e-commerce", "payment", "cart", "checkout", "product", "shopping", "store", "retail", "paystack", "stripe"],
      techMatches: ["shopify", "woocommerce", "magento", "stripe", "paypal", "paystack", "flutterwave", "square"],
      industryFit: ["e-commerce", "retail", "marketplace", "fashion", "luxury", "shopping", "consumer", "fintech"],
      scale: "140+ products, 7 categories"
    },
    {
      name: "Crewmanage HR System",
      description: "HR management with scheduling, payroll, workflow automation, RBAC",
      techStack: ["React", "Node.js", "MongoDB", "Role-based access"],
      keywords: ["hr", "scheduling", "workflow", "automation", "employee", "payroll", "management", "workforce"],
      techMatches: ["workday", "bamboohr", "namely", "gusto", "adp", "sage"],
      industryFit: ["hr tech", "workforce", "business software", "enterprise", "staffing", "recruitment", "hrms"],
      scale: "Enterprise HR features"
    },
    {
      name: "Durl URL Shortener",
      description: "URL shortening with analytics, rate limiting, thousands of monthly redirections",
      techStack: ["Next.js", "Node.js", "MongoDB", "SHA-256", "JWT"],
      keywords: ["analytics", "url", "tracking", "metrics", "dashboard", "data", "marketing", "digital marketing"],
      techMatches: ["google analytics", "mixpanel", "amplitude", "segment", "bitly"],
      industryFit: ["marketing", "analytics", "saas", "developer tools", "martech", "digital marketing"],
      scale: "Thousands of monthly redirections"
    }
  ],
  
  skills: {
    frontend: ["React.js", "Next.js", "JavaScript", "HTML5", "CSS3", "Tailwind CSS"],
    backend: ["Node.js", "Express.js", "MongoDB", "REST APIs"],
    realtime: ["WebSocket", "Real-time data sync"],
    auth: ["JWT Authentication", "bcrypt", "Role-based access control"],
    payments: ["Payment gateway integration", "Stripe", "Paystack", "Flutterwave"],
    deployment: ["AWS", "Heroku", "Vercel"]
  }
};

class EnhancedApolloAutomation {
  constructor() {
    this.initializeDirectories();
    this.apiCallCount = { news: 0, groq: 0, gemini: 0, web: 0 };
    this.groqApiKey = process.env.GROQ_API_KEY || null;
    this.geminiClient = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
  }

  initializeDirectories() {
    [CONFIG.RESEARCH_DIR, CONFIG.DRAFTS_DIR].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async batchResearch(csvFile) {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 ENHANCED APOLLO LEAD AUTOMATION (100% FREE)');
    console.log('   Groq + Gemini Fallback | Nigerian Tech News Enabled');
    console.log('='.repeat(70) + '\n');
    
    // Check API status
    console.log('🔑 API Configuration:');
    if (this.groqApiKey) {
      console.log('   ✅ Groq API configured (14,400/day free)');
    } else {
      console.log('   ⚠️  Groq API not found - add GROQ_API_KEY to .env');
    }
    if (this.geminiClient) {
      console.log('   ✅ Gemini API configured (1,500/day free) - FALLBACK READY');
    } else {
      console.log('   ⚠️  Gemini API not found - add GEMINI_API_KEY to .env');
    }
    if (!this.groqApiKey && !this.geminiClient) {
      console.log('   ⚠️  No AI APIs configured - using template emails');
    }
    console.log('');
    
    const prospects = await this.readCSV(csvFile);
    console.log(`📊 Found ${prospects.length} prospects from Apollo\n`);
    
    // Smart filtering
    const filtered = this.smartFilter(prospects);
    console.log(`✅ After smart filtering: ${filtered.length} qualified prospects\n`);
    
    // Skip already researched
    const newProspects = filtered.filter(p => {
      const filename = `${p['Company Name'].replace(/[^a-z0-9]/gi, '_')}_research.json`;
      return !fs.existsSync(path.join(CONFIG.RESEARCH_DIR, filename));
    });
    
    console.log(`🔍 Researching ${newProspects.length} new prospects\n`);
    
    let processed = 0;
    let readyToSend = 0;
    let needsReview = 0;
    let skipped = 0;
    
    for (const prospect of newProspects) {
      console.log(`\n[${processed + 1}/${newProspects.length}] 🎯 ${prospect['Company Name']} (${prospect['First Name']} ${prospect['Last Name']})`);
      
      try {
        const intel = await this.deepResearch(prospect);
        await this.saveIntelligence(prospect, intel);
        
        if (intel.confidence.score >= CONFIG.MIN_CONFIDENCE_TO_SEND) readyToSend++;
        else if (intel.confidence.score >= CONFIG.MIN_CONFIDENCE_TO_REVIEW) needsReview++;
        else skipped++;
        
        processed++;
        
        const emoji = intel.confidence.score >= 75 ? '🟢' : intel.confidence.score >= 55 ? '🟡' : '🔴';
        console.log(`${emoji} ${intel.confidence.level} (${intel.confidence.score}/100) - ${intel.recommendation}`);
        
      } catch (error) {
        console.log(`❌ Error: ${error.message}`);
      }
      
      if (processed < newProspects.length) {
        await this.sleep(CONFIG.RESEARCH_DELAY);
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📈 RESEARCH COMPLETE');
    console.log('='.repeat(70));
    console.log(`Total processed: ${processed}`);
    console.log(`🟢 Ready to send: ${readyToSend} (${Math.round(readyToSend/processed*100)}%)`);
    console.log(`🟡 Needs review: ${needsReview} (${Math.round(needsReview/processed*100)}%)`);
    console.log(`🔴 Skip/Low priority: ${skipped} (${Math.round(skipped/processed*100)}%)`);
    console.log(`\n📊 API Usage: News=${this.apiCallCount.news}, Groq=${this.apiCallCount.groq}, Gemini=${this.apiCallCount.gemini}, Web=${this.apiCallCount.web}`);
    console.log(`\n📁 Reports saved to: ${CONFIG.RESEARCH_DIR}/`);
    console.log(`\n▶️  Next: node lead_automation.js review`);
  }

  smartFilter(prospects) {
    console.log('🔍 Smart filtering Apollo data...\n');
    
    let filtered = prospects;
    const initial = filtered.length;
    
    // Filter 1: Email must be verified or valid
    filtered = filtered.filter(p => {
      const status = p['Email Status'];
      return status === 'Verified' || status === 'Likely' || status === '';
    });
    console.log(`  ✓ Email verification: ${filtered.length}/${initial} (removed ${initial - filtered.length} invalid)`);
    
    // Filter 2: Skip if already contacted
    const beforeContact = filtered.length;
    filtered = filtered.filter(p => !p['Last Contacted'] || p['Last Contacted'].trim() === '');
    console.log(`  ✓ Not contacted: ${filtered.length}/${beforeContact} (removed ${beforeContact - filtered.length} already contacted)`);
    
    // Filter 3: Prioritize decision makers (C-suite, VP, Director, Manager)
    const decisionMakers = filtered.filter(p => {
      const title = (p['Title'] || '').toLowerCase();
      const seniority = (p['Seniority'] || '').toLowerCase();
      return seniority.includes('c suite') || 
             seniority.includes('vp') ||
             seniority.includes('director') ||
             title.includes('cto') ||
             title.includes('ceo') ||
             title.includes('coo') ||
             title.includes('cfo') ||
             title.includes('president') ||
             title.includes('founder') ||
             title.includes('co-founder') ||
             title.includes('vp') ||
             title.includes('director') ||
             title.includes('head of') ||
             title.includes('lead') ||
             title.includes('manager');
    });
    
    if (decisionMakers.length > filtered.length * 0.3) {
      filtered = decisionMakers;
      console.log(`  ✓ Decision makers only: ${filtered.length} (focusing on C-suite/Directors)`);
    } else {
      console.log(`  ℹ️  Keeping all levels (${decisionMakers.length} decision makers found)`);
    }
    
    // Filter 4: Must have website
    const beforeWebsite = filtered.length;
    filtered = filtered.filter(p => p['Website'] && p['Website'].trim() !== '');
    console.log(`  ✓ Has website: ${filtered.length}/${beforeWebsite} (removed ${beforeWebsite - filtered.length} without website)`);
    
    console.log('');
    return filtered;
  }

  async deepResearch(prospect) {
    const intel = {
      prospect: this.parseApolloData(prospect),
      findings: {
        news: [],
        nigerianTechNews: [],
        pressReleases: [],
        blog: [],
        linkedInPosts: [],
        techStack: prospect['Technologies'] ? prospect['Technologies'].split(',').map(t => t.trim()) : [],
        websiteWorks: false,
        aboutContent: null,
        careersPage: false
      },
      apollo: {
        emailVerified: prospect['Email Status'] === 'Verified',
        emailConfidence: prospect['Email Confidence'] || 'unknown',
        catchAll: prospect['Primary Email Catch-all Status'] === 'Catch-all',
        seniority: prospect['Seniority'],
        departments: prospect['Departments'],
        funding: {
          total: prospect['Total Funding'],
          latest: prospect['Latest Funding'],
          latestAmount: prospect['Latest Funding Amount'],
          lastRaised: prospect['Last Raised At']
        }
      },
      analysis: {
        companyStage: null,
        industryMatch: null,
        growthSignals: [],
        techStackMatch: []
      },
      matches: [],
      angles: [],
      aiDraft: null,
      confidence: {},
      recommendation: null
    };

    // 1. Website verification
    console.log('  → Website check...');
    intel.findings.websiteWorks = await this.verifyWebsite(prospect['Website']);

    // 2. Scrape company website content
    if (intel.findings.websiteWorks) {
      console.log('  → Scraping company content...');
      const websiteData = await this.scrapeCompanyWebsite(prospect['Website']);
      intel.findings.aboutContent = websiteData.about;
      intel.findings.careersPage = websiteData.careers;
      intel.findings.pressReleases = websiteData.press;
      intel.findings.blog = websiteData.blog;
    }

    // 3. News search (NewsAPI + Nigerian tech blogs)
    console.log('  → News search (global + African tech)...');
    const allNews = await this.searchNews(prospect['Company Name'], prospect['Website'], prospect['Country']);
    intel.findings.news = allNews.global;
    intel.findings.nigerianTechNews = allNews.african;

    // 4. LinkedIn company updates (public)
    console.log('  → LinkedIn check...');
    if (prospect['Company Linkedin Url']) {
      intel.findings.linkedInPosts = await this.getLinkedInUpdates(prospect['Company Linkedin Url']);
    }

    // 5. Analysis
    console.log('  → Company analysis...');
    intel.analysis = this.analyzeCompany(intel, prospect);

    // 6. Experience matching
    console.log('  → Experience matching...');
    intel.matches = this.matchExperience(intel.analysis, intel.findings.techStack, prospect);

    // 7. Generate angles
    intel.angles = this.generateAngles(intel);

    // 8. AI-powered email draft (Groq → Gemini fallback)
    console.log('  → AI email generation...');
    intel.aiDraft = await this.generateAIDraft(intel);

    // 9. Calculate confidence
    intel.confidence = this.calculateConfidence(intel);
    intel.recommendation = this.getRecommendation(intel.confidence.score);

    return intel;
  }

  parseApolloData(prospect) {
    return {
      firstName: prospect['First Name'],
      lastName: prospect['Last Name'],
      name: `${prospect['First Name']} ${prospect['Last Name']}`,
      title: prospect['Title'],
      email: prospect['Email'],
      company: prospect['Company Name'],
      industry: prospect['Industry'],
      employees: prospect['# Employees'],
      website: prospect['Website'],
      linkedIn: prospect['Person Linkedin Url'],
      companyLinkedIn: prospect['Company Linkedin Url'],
      seniority: prospect['Seniority'],
      departments: prospect['Departments'],
      city: prospect['City'],
      state: prospect['State'],
      country: prospect['Country'],
      keywords: prospect['Keywords']
    };
  }

  async verifyWebsite(url) {
    try {
      const cleanUrl = this.cleanUrl(url);
      if (!cleanUrl) return false;

      this.apiCallCount.web++;
      const response = await axios.get(cleanUrl, {
        timeout: CONFIG.REQUEST_TIMEOUT,
        maxRedirects: 5,
        validateStatus: (status) => status < 500,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });

      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async scrapeCompanyWebsite(url) {
    const data = {
      about: null,
      careers: false,
      press: [],
      blog: { found: false, posts: [] }
    };

    try {
      const cleanUrl = this.cleanUrl(url);
      
      // 1. Check for About page
      const aboutPaths = ['/about', '/about-us', '/company', '/who-we-are', '/about.html'];
      for (const path of aboutPaths) {
        try {
          const aboutUrl = `${cleanUrl}${path}`;
          const response = await axios.get(aboutUrl, {
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
          });
          
          const $ = cheerio.load(response.data);
          $('script, style, nav, header, footer').remove(); // Remove noise
          const text = $('main, article, .content, #content, .about').text().trim();
          if (text.length > 100) {
            data.about = text.substring(0, 600);
            break;
          }
        } catch (error) {
          continue;
        }
      }

      // 2. Check for careers page
      const careerPaths = ['/careers', '/jobs', '/join-us', '/work-with-us', '/hiring'];
      for (const path of careerPaths) {
        try {
          const careerUrl = `${cleanUrl}${path}`;
          const response = await axios.get(careerUrl, {
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
          });
          if (response.status === 200) {
            data.careers = true;
            break;
          }
        } catch (error) {
          continue;
        }
      }

      // 3. Check for press/news
      const pressPaths = ['/press', '/news', '/press-release', '/media', '/newsroom'];
      for (const path of pressPaths) {
        try {
          const pressUrl = `${cleanUrl}${path}`;
          const response = await axios.get(pressUrl, {
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
          });
          
          const $ = cheerio.load(response.data);
          $('article h2, article h3, .news-title, .press-title, h2, h3').slice(0, 5).each((i, el) => {
            const title = $(el).text().trim();
            if (title.length > 15 && title.length < 200) {
              data.press.push({ title, source: 'company website' });
            }
          });
          
          if (data.press.length > 0) break;
        } catch (error) {
          continue;
        }
      }

      // 4. Check for blog
      const blogPaths = ['/blog', '/insights', '/articles', '/resources', '/news'];
      for (const path of blogPaths) {
        try {
          const blogUrl = `${cleanUrl}${path}`;
          const response = await axios.get(blogUrl, {
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
          });
          
          const $ = cheerio.load(response.data);
          $('article h2, article h3, .post-title, .blog-title, h2.entry-title').slice(0, 5).each((i, el) => {
            const title = $(el).text().trim();
            if (title.length > 15 && title.length < 200) {
              data.blog.posts.push({ title });
            }
          });
          
          if (data.blog.posts.length > 0) {
            data.blog.found = true;
            data.blog.url = blogUrl;
            break;
          }
        } catch (error) {
          continue;
        }
      }

    } catch (error) {
      // Silent fail
    }

    return data;
  }

  async searchNews(companyName, website, country) {
    const news = { global: [], african: [] };
    
    // 1. Try NewsAPI (global news)
    if (process.env.NEWSAPI_KEY) {
      try {
        this.apiCallCount.news++;
        
        const response = await axios.get('https://newsapi.org/v2/everything', {
          params: {
            apiKey: process.env.NEWSAPI_KEY,
            q: `"${companyName}"`,
            language: 'en',
            sortBy: 'publishedAt',
            pageSize: CONFIG.MAX_NEWS_ARTICLES,
            from: this.getDateXDaysAgo(CONFIG.NEWS_AGE_DAYS)
          },
          timeout: CONFIG.REQUEST_TIMEOUT
        });

        if (response.data.articles) {
          response.data.articles.forEach(article => {
            const text = (article.title + ' ' + (article.description || '')).toLowerCase();
            if (text.includes(companyName.toLowerCase())) {
              news.global.push({
                title: article.title,
                snippet: article.description || article.content?.substring(0, 200),
                url: article.url,
                date: this.formatDate(article.publishedAt),
                source: article.source.name,
                type: this.categorizeNews(article.title, article.description),
                verified: true
              });
            }
          });
        }
      } catch (error) {
        // Silent fail
      }
    }

    // 2. Search Nigerian/African tech blogs (if company is African)
    const isAfrican = country && ['Nigeria', 'NG', 'Ghana', 'Kenya', 'South Africa', 'Egypt'].some(c => 
      country.toLowerCase().includes(c.toLowerCase())
    );
    
    if (isAfrican && process.env.GOOGLE_API_KEY && process.env.GOOGLE_CX_ID) {
      try {
        this.apiCallCount.news++;
        
        // Search specifically on Nigerian tech sites
        const siteQuery = CONFIG.NIGERIAN_TECH_SOURCES.map(s => `site:${s}`).join(' OR ');
        const searchQuery = `"${companyName}" (${siteQuery})`;
        
        const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
          params: {
            key: process.env.GOOGLE_API_KEY,
            cx: process.env.GOOGLE_CX_ID,
            q: searchQuery,
            dateRestrict: `d${CONFIG.NEWS_AGE_DAYS}`,
            num: 5
          },
          timeout: CONFIG.REQUEST_TIMEOUT
        });

        if (response.data.items) {
          response.data.items.forEach(item => {
            news.african.push({
              title: item.title,
              snippet: item.snippet,
              url: item.link,
              date: this.extractDate(item),
              source: this.extractSource(item.link),
              type: this.categorizeNews(item.title, item.snippet),
              verified: true,
              category: 'African Tech News'
            });
          });
        }
      } catch (error) {
        // Silent fail
      }
    }

    return news;
  }

  extractSource(url) {
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      return domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
    } catch (error) {
      return 'News Source';
    }
  }

  async getLinkedInUpdates(linkedInUrl) {
    // For now, we'll return empty since LinkedIn scraping requires auth
    // In production, use PhantomBuster or similar service
    return [];
  }

  analyzeCompany(intel, prospect) {
    const analysis = {
      companyStage: null,
      industryMatch: null,
      growthSignals: [],
      techStackMatch: []
    };

    const employees = parseInt(prospect['# Employees']) || 0;

    // Determine stage
    if (employees < 20) analysis.companyStage = 'Early Stage Startup';
    else if (employees < 100) analysis.companyStage = 'Growth Stage';
    else if (employees < 500) analysis.companyStage = 'Established Company';
    else analysis.companyStage = 'Enterprise';

    // Funding signals
    if (intel.apollo.funding.latest) {
      analysis.companyStage += ` (${intel.apollo.funding.latest})`;
      analysis.growthSignals.push(`Recent funding: ${intel.apollo.funding.latest}`);
    }

    // Growth signals
    const totalNews = intel.findings.news.length + intel.findings.nigerianTechNews.length;
    if (totalNews >= 2) {
      analysis.growthSignals.push(`Active in news (${totalNews} articles)`);
    }
    if (intel.findings.careersPage) {
      analysis.growthSignals.push('Hiring (careers page active)');
    }
    if (intel.findings.blog.found) {
      analysis.growthSignals.push('Active content marketing');
    }
    if (intel.findings.pressReleases.length > 0) {
      analysis.growthSignals.push(`${intel.findings.pressReleases.length} press releases`);
    }

    // Industry matching
    const industry = (prospect['Industry'] || '').toLowerCase();
    const keywords = (prospect['Keywords'] || '').toLowerCase();
    analysis.industryMatch = this.matchIndustry(industry, keywords);

    // Tech stack matching
    intel.findings.techStack.forEach(tech => {
      YOUR_EXPERIENCE.projects.forEach(project => {
        if (project.techMatches.some(match => tech.toLowerCase().includes(match))) {
          analysis.techStackMatch.push({
            tech,
            project: project.name
          });
        }
      });
    });

    return analysis;
  }

  matchIndustry(industry, keywords) {
    const matches = {
      'telecommunications': ['telecom', 'communication', 'unified communications', 'isp', 'connectivity'],
      'saas': ['saas', 'software', 'platform', 'cloud', 'b2b software'],
      'fintech': ['fintech', 'payment', 'financial', 'banking', 'finance', 'paystack', 'flutterwave'],
      'ecommerce': ['e-commerce', 'ecommerce', 'retail', 'shopping', 'marketplace', 'online store'],
      'hr': ['hr', 'human resources', 'recruitment', 'workforce', 'hrms', 'payroll'],
      'logistics': ['logistics', 'delivery', 'shipping', 'supply chain', 'transportation'],
      'marketing': ['marketing', 'advertising', 'martech', 'analytics', 'digital marketing', 'seo'],
      'it services': ['it services', 'it consulting', 'managed services', 'it solutions', 'software development']
    };

    const searchText = industry + ' ' + keywords;
    
    for (const [key, terms] of Object.entries(matches)) {
      if (terms.some(term => searchText.includes(term))) {
        return key;
      }
    }

    return null;
  }

  matchExperience(analysis, techStack, prospect) {
    const matches = [];
    const industry = (prospect['Industry'] || '').toLowerCase();
    const keywords = (prospect['Keywords'] || '').toLowerCase();
    const searchText = industry + ' ' + keywords + ' ' + techStack.join(' ').toLowerCase();

    YOUR_EXPERIENCE.projects.forEach(project => {
      let score = 0;
      const reasons = [];

      // Industry fit
      project.industryFit.forEach(fit => {
        if (searchText.includes(fit)) {
          score += 25;
          reasons.push(`Industry: ${fit}`);
        }
      });

      // Tech stack match (strong signal)
      project.techMatches.forEach(tech => {
        if (searchText.includes(tech)) {
          score += 30;
          reasons.push(`Tech: ${tech}`);
        }
      });

      // Keyword matches
      project.keywords.forEach(keyword => {
        if (searchText.includes(keyword)) {
          score += 5;
        }
      });

      if (score >= 25) {
        matches.push({
          project: project.name,
          description: project.description,
          score,
          reasons: reasons.slice(0, 3),
          techStack: project.techStack.slice(0, 4).join(', '),
          scale: project.scale
        });
      }
    });

    return matches.sort((a, b) => b.score - a.score);
  }

  generateAngles(intel) {
    const angles = [];

    // 1. Funding angle (highest priority)
    if (intel.apollo.funding.latest) {
      angles.push({
        type: 'funding',
        priority: 'highest',
        content: `Recent funding: ${intel.apollo.funding.latest}`,
        details: intel.apollo.funding.latestAmount
      });
    }

    // 2. African tech news (high priority for local companies)
    if (intel.findings.nigerianTechNews.length > 0) {
      const news = intel.findings.nigerianTechNews[0];
      angles.push({
        type: 'african_tech_news',
        priority: 'high',
        content: `Featured in ${news.source}: "${news.title}"`,
        source: news.url
      });
    }

    // 3. Global news angle
    if (intel.findings.news.length > 0) {
      const news = intel.findings.news[0];
      angles.push({
        type: 'news',
        priority: 'high',
        content: `Recent ${news.type}: "${news.title}"`,
        source: news.url
      });
    }

    // 4. Press release from their website
    if (intel.findings.pressReleases.length > 0) {
      angles.push({
        type: 'press',
        priority: 'high',
        content: `Company announcement: "${intel.findings.pressReleases[0].title}"`
      });
    }

    // 5. Hiring signal
    if (intel.findings.careersPage) {
      angles.push({
        type: 'hiring',
        priority: 'medium',
        content: 'Active hiring (careers page updated)'
      });
    }

    // 6. Blog angle
    if (intel.findings.blog.found && intel.findings.blog.posts.length > 0) {
      angles.push({
        type: 'blog',
        priority: 'medium',
        content: `Recent post: "${intel.findings.blog.posts[0].title}"`,
        source: intel.findings.blog.url
      });
    }

    // 7. Tech stack match
    if (intel.analysis.techStackMatch.length > 0) {
      angles.push({
        type: 'tech',
        priority: 'medium',
        content: `Tech stack match: ${intel.analysis.techStackMatch[0].tech} (${intel.analysis.techStackMatch[0].project})`
      });
    }

    // 8. Experience match
    if (intel.matches.length > 0) {
      angles.push({
        type: 'experience',
        priority: intel.matches[0].score > 50 ? 'high' : 'medium',
        content: `${intel.matches[0].project} relevant to their ${intel.analysis.industryMatch || 'industry'}`
      });
    }

    return angles;
  }

  async generateAIDraft(intel) {
    // Try Groq first
    if (this.groqApiKey) {
      try {
        return await this.generateGroqDraft(intel);
      } catch (error) {
        console.log('    ⚠️  Groq failed, trying Gemini...');
      }
    }

    // Fallback to Gemini
    if (this.geminiClient) {
      try {
        return await this.generateGeminiDraft(intel);
      } catch (error) {
        console.log('    ⚠️  Gemini failed, using template');
      }
    }

    // Final fallback: template
    return this.generateTemplateDraft(intel);
  }

  async generateGroqDraft(intel) {
    this.apiCallCount.groq++;

    const prompt = this.buildAIPrompt(intel);
    
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.1-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at writing personalized, concise outreach emails for freelance developers. Keep emails under 150 words, highly specific, and focused on value. Never use generic phrases like "I hope this email finds you well".'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      },
      {
        headers: {
          'Authorization': `Bearer ${this.groqApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    console.log('    ✅ Groq AI generated email');
    return response.data.choices[0].message.content.trim();
  }

  async generateGeminiDraft(intel) {
    this.apiCallCount.gemini++;

    const prompt = this.buildAIPrompt(intel);
    
    const model = this.geminiClient.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [{
          text: `You are an expert at writing personalized, concise outreach emails for freelance developers. Keep emails under 150 words, highly specific, and focused on value. Never use generic phrases.\n\n${prompt}`
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500,
      }
    });

    console.log('    ✅ Gemini AI generated email');
    return result.response.text().trim();
  }

  buildAIPrompt(intel) {
    let prompt = `Write a personalized cold email for this prospect:\n\n`;
    prompt += `TO: ${intel.prospect.firstName} ${intel.prospect.lastName}\n`;
    prompt += `TITLE: ${intel.prospect.title}\n`;
    prompt += `COMPANY: ${intel.prospect.company} (${intel.analysis.companyStage})\n`;
    prompt += `INDUSTRY: ${intel.prospect.industry}\n`;
    prompt += `LOCATION: ${intel.prospect.city}, ${intel.prospect.country}\n\n`;

    prompt += `PERSONALIZATION ANGLES (use 1-2 BEST ones):\n`;
    intel.angles.slice(0, 4).forEach((angle, i) => {
      prompt += `${i+1}. [${angle.priority}] ${angle.type}: ${angle.content}\n`;
    });

    if (intel.matches.length > 0) {
      const match = intel.matches[0];
      prompt += `\nMY RELEVANT PROJECT:\n`;
      prompt += `Name: ${match.project}\n`;
      prompt += `Description: ${match.description}\n`;
      prompt += `Tech: ${match.techStack}\n`;
      prompt += `Scale: ${match.scale}\n`;
    }

    prompt += `\nREQUIREMENTS:\n`;
    prompt += `- Subject line (max 8 words)\n`;
    prompt += `- Body under 120 words\n`;
    prompt += `- Use the BEST personalization angle from the list\n`;
    prompt += `- Mention my relevant project naturally\n`;
    prompt += `- End with simple question (not "Would you be open to...")\n`;
    prompt += `- Casual, confident tone\n`;
    prompt += `- NO generic phrases like "I hope this email finds you well"\n`;
    prompt += `- If they're in Nigeria, acknowledge local tech ecosystem naturally\n\n`;

    prompt += `MY INFO:\n`;
    prompt += `David Ariyo | Full Stack Developer (MERN)\n`;
    prompt += `Email: davidariyo109@gmail.com\n`;
    prompt += `Phone: (+234) 903-6184-863\n`;
    prompt += `Portfolio: davidariyo.onrender.com`;

    return prompt;
  }

  generateTemplateDraft(intel) {
    if (intel.angles.length === 0) {
      return "⚠️ INSUFFICIENT DATA - Manual research required\n\nNo strong personalization angles found. Consider:\n1. Manual LinkedIn research\n2. Company website deep dive\n3. Recent news search\n4. Industry-specific research";
    }

    const bestAngle = intel.angles[0];
    let draft = '';

    // Subject
    if (bestAngle.type === 'funding') {
      draft += `SUBJECT: ${intel.prospect.firstName} - congrats on the funding\n\n`;
    } else if (bestAngle.type === 'african_tech_news') {
      draft += `SUBJECT: ${intel.prospect.firstName} - saw ${intel.prospect.company} in the news\n\n`;
    } else if (bestAngle.type === 'news') {
      draft += `SUBJECT: ${intel.prospect.firstName} - impressive news\n\n`;
    } else if (bestAngle.type === 'hiring') {
      draft += `SUBJECT: ${intel.prospect.firstName} - ${intel.prospect.company} development support\n\n`;
    } else {
      draft += `SUBJECT: ${intel.prospect.firstName} - quick question\n\n`;
    }

    // Opening
    draft += `Hi ${intel.prospect.firstName},\n\n`;

    if (bestAngle.type === 'funding') {
      draft += `Congrats on ${intel.apollo.funding.latest}`;
      if (intel.apollo.funding.latestAmount) {
        draft += ` (${intel.apollo.funding.latestAmount})`;
      }
      draft += `! Exciting growth phase ahead.\n\n`;
    } else if (bestAngle.type === 'african_tech_news' || bestAngle.type === 'news') {
      const newsSource = intel.findings.nigerianTechNews[0] || intel.findings.news[0];
      draft += `Saw ${intel.prospect.company} featured in ${newsSource.source} - ${newsSource.type}. Impressive!\n\n`;
    } else if (bestAngle.type === 'hiring') {
      draft += `Noticed ${intel.prospect.company} is hiring. Scaling the team?\n\n`;
    } else {
      draft += `I've been following ${intel.prospect.industry} companies in ${intel.prospect.country || 'the region'}.\n\n`;
    }

    // Experience
    if (intel.matches.length > 0) {
      const match = intel.matches[0];
      draft += `I'm David Ariyo, Full Stack Developer. Recently built ${match.project} - ${match.description}.\n\n`;
      draft += `Tech: ${match.techStack} | ${match.scale}\n\n`;
    } else {
      draft += `I'm David Ariyo, Full Stack Developer (MERN stack). I build scalable web applications for growing companies.\n\n`;
    }

    // Tech stack mention if relevant
    if (intel.analysis.techStackMatch.length > 0) {
      draft += `Noticed you use ${intel.analysis.techStackMatch[0].tech} - I've worked with similar systems.\n\n`;
    }

    // Location-specific touch
    if (intel.prospect.country === 'Nigeria' || intel.prospect.country === 'NG') {
      draft += `Based in Nigeria too - always excited to support local tech growth.\n\n`;
    }

    // CTA
    draft += `Ever need freelance dev support at ${intel.prospect.company}?\n\n`;

    // Signature
    draft += `Best,\nDavid Ariyo\n`;
    draft += `Full Stack Developer | MERN Stack\n`;
    draft += `davidariyo109@gmail.com | (+234) 903-6184-863\n`;
    draft += `davidariyo.onrender.com`;

    return draft;
  }

  calculateConfidence(intel) {
    let score = 0;
    const factors = [];

    // Apollo email verification (strong signal)
    if (intel.apollo.emailVerified) {
      score += 25;
      factors.push('Email verified by Apollo');
    } else if (!intel.apollo.catchAll) {
      score += 10;
      factors.push('Email not catch-all');
    }

    // Decision maker
    if (intel.prospect.seniority?.toLowerCase().includes('c suite') || 
        intel.prospect.seniority?.toLowerCase().includes('vp') ||
        intel.prospect.title?.toLowerCase().includes('cto') ||
        intel.prospect.title?.toLowerCase().includes('ceo') ||
        intel.prospect.title?.toLowerCase().includes('founder') ||
        intel.prospect.title?.toLowerCase().includes('director')) {
      score += 12;
      factors.push('Decision maker level');
    }

    // Website working
    if (intel.findings.websiteWorks) {
      score += 10;
      factors.push('Website verified');
    } else {
      score -= 5;
      factors.push('Website inaccessible');
    }

    // Funding (very high value)
    if (intel.apollo.funding.latest) {
      score += 18;
      factors.push(`Recent funding: ${intel.apollo.funding.latest}`);
    }

    // African tech news (high value for local companies)
    if (intel.findings.nigerianTechNews.length >= 1) {
      score += 15;
      factors.push(`${intel.findings.nigerianTechNews.length} African tech news`);
    }

    // Global news
    if (intel.findings.news.length >= 2) {
      score += 12;
      factors.push(`${intel.findings.news.length} news articles`);
    } else if (intel.findings.news.length === 1) {
      score += 8;
      factors.push('1 news article');
    }

    // Company press releases
    if (intel.findings.pressReleases.length > 0) {
      score += 10;
      factors.push(`${intel.findings.pressReleases.length} press releases`);
    }

    // About content (shows active website)
    if (intel.findings.aboutContent) {
      score += 5;
      factors.push('Company info found');
    }

    // Hiring signal
    if (intel.findings.careersPage) {
      score += 8;
      factors.push('Active hiring');
    }

    // Blog
    if (intel.findings.blog.found) {
      score += 6;
      factors.push('Active blog');
    }

    // Tech stack match (high value)
    if (intel.analysis.techStackMatch.length > 0) {
      score += 12;
      factors.push(`Tech match: ${intel.analysis.techStackMatch[0].tech}`);
    }

    // Strong experience match
    if (intel.matches.length > 0 && intel.matches[0].score >= 50) {
      score += 12;
      factors.push('Strong experience match');
    } else if (intel.matches.length > 0) {
      score += 6;
      factors.push('Moderate experience match');
    }

    // Multiple growth signals
    if (intel.analysis.growthSignals.length >= 3) {
      score += 5;
      factors.push('Multiple growth signals');
    }

    score = Math.max(0, Math.min(100, score));

    let level = 'Low';
    if (score >= 75) level = 'Very High';
    else if (score >= 65) level = 'High';
    else if (score >= 55) level = 'Medium';
    else if (score >= 40) level = 'Low';
    else level = 'Very Low';

    return {
      score,
      level,
      factors
    };
  }

  getRecommendation(score) {
    if (score >= CONFIG.MIN_CONFIDENCE_TO_SEND) return 'SEND';
    if (score >= CONFIG.MIN_CONFIDENCE_TO_REVIEW) return 'REVIEW';
    if (score >= 40) return 'MANUAL RESEARCH';
    return 'SKIP';
  }

  async saveIntelligence(prospect, intel) {
    const filename = `${prospect['Company Name'].replace(/[^a-z0-9]/gi, '_')}_research.json`;
    const filepath = path.join(CONFIG.RESEARCH_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(intel, null, 2));

    const txtFile = filename.replace('.json', '.txt');
    const txtPath = path.join(CONFIG.RESEARCH_DIR, txtFile);
    fs.writeFileSync(txtPath, this.formatReport(intel));
  }

  formatReport(intel) {
    let r = '';
    
    r += '='.repeat(80) + '\n';
    r += `🎯 RESEARCH REPORT: ${intel.prospect.company}\n`;
    r += '='.repeat(80) + '\n\n';
    
    r += `📋 CONTACT INFO:\n`;
    r += `  Name: ${intel.prospect.name}\n`;
    r += `  Title: ${intel.prospect.title}\n`;
    r += `  Seniority: ${intel.prospect.seniority}\n`;
    r += `  Email: ${intel.prospect.email} `;
    if (intel.apollo.emailVerified) r += '✅ VERIFIED\n';
    else if (intel.apollo.catchAll) r += '⚠️ CATCH-ALL\n';
    else r += '\n';
    r += `  Company: ${intel.prospect.company}\n`;
    r += `  Industry: ${intel.prospect.industry}\n`;
    r += `  Size: ${intel.prospect.employees} employees\n`;
    r += `  Location: ${intel.prospect.city}${intel.prospect.state ? ', ' + intel.prospect.state : ''}, ${intel.prospect.country}\n`;
    r += `  Website: ${intel.prospect.website} ${intel.findings.websiteWorks ? '✅' : '❌'}\n`;
    r += `  LinkedIn: ${intel.prospect.linkedIn}\n`;
    r += `  Company LinkedIn: ${intel.prospect.companyLinkedIn}\n\n`;
    
    r += `🎯 CONFIDENCE: ${intel.confidence.level} (${intel.confidence.score}/100)\n`;
    r += `📊 RECOMMENDATION: ${intel.recommendation}\n`;
    r += `Factors: ${intel.confidence.factors.join(', ')}\n\n`;
    
    r += `💰 APOLLO DATA:\n`;
    if (intel.apollo.funding.latest) {
      r += `  Funding: ${intel.apollo.funding.latest}`;
      if (intel.apollo.funding.latestAmount) r += ` (${intel.apollo.funding.latestAmount})`;
      r += `\n`;
      if (intel.apollo.funding.lastRaised) r += `  Last Raised: ${intel.apollo.funding.lastRaised}\n`;
    }
    if (intel.findings.techStack.length > 0) {
      r += `  Tech Stack: ${intel.findings.techStack.slice(0, 10).join(', ')}\n`;
    }
    r += `\n`;
    
    r += `🔍 FINDINGS:\n`;
    
    if (intel.findings.nigerianTechNews.length > 0) {
      r += `\n  🌍 AFRICAN TECH NEWS (${intel.findings.nigerianTechNews.length} verified):\n`;
      intel.findings.nigerianTechNews.forEach((n, i) => {
        r += `  ${i+1}. [${n.type}] ${n.title}\n`;
        r += `     ${n.date} | ${n.source}\n`;
        r += `     ${n.url}\n`;
      });
    }
    
    if (intel.findings.news.length > 0) {
      r += `\n  📰 GLOBAL NEWS (${intel.findings.news.length} verified):\n`;
      intel.findings.news.forEach((n, i) => {
        r += `  ${i+1}. [${n.type}] ${n.title}\n`;
        r += `     ${n.date} | ${n.source}\n`;
        r += `     ${n.url}\n`;
      });
    }
    
    if (intel.findings.pressReleases.length > 0) {
      r += `\n  📢 PRESS RELEASES (from company website):\n`;
      intel.findings.pressReleases.forEach((p, i) => {
        r += `  ${i+1}. ${p.title}\n`;
      });
    }
    
    if (intel.findings.blog.found) {
      r += `\n  📝 BLOG: Found at ${intel.findings.blog.url}\n`;
      intel.findings.blog.posts.slice(0, 3).forEach((p, i) => {
        r += `  ${i+1}. "${p.title}"\n`;
      });
    }
    
    if (intel.findings.careersPage) {
      r += `\n  💼 CAREERS: Active hiring page found\n`;
    }
    
    if (intel.findings.aboutContent) {
      r += `\n  ℹ️  ABOUT: ${intel.findings.aboutContent.substring(0, 300)}...\n`;
    }
    
    r += `\n📊 ANALYSIS:\n`;
    r += `  Stage: ${intel.analysis.companyStage}\n`;
    if (intel.analysis.industryMatch) {
      r += `  Industry Match: ${intel.analysis.industryMatch}\n`;
    }
    if (intel.analysis.growthSignals.length > 0) {
      r += `  Growth Signals:\n`;
      intel.analysis.growthSignals.forEach(s => r += `    • ${s}\n`);
    }
    if (intel.analysis.techStackMatch.length > 0) {
      r += `  Tech Stack Matches:\n`;
      intel.analysis.techStackMatch.forEach(m => {
        r += `    • ${m.tech} → ${m.project}\n`;
      });
    }
    
    if (intel.matches.length > 0) {
      r += `\n🎯 EXPERIENCE MATCHES:\n`;
      intel.matches.forEach((m, i) => {
        r += `  ${i+1}. ${m.project} (Score: ${m.score})\n`;
        r += `     ${m.description}\n`;
        r += `     Tech: ${m.techStack}\n`;
        if (m.reasons.length > 0) {
          r += `     Why: ${m.reasons.join(', ')}\n`;
        }
      });
    }
    
    if (intel.angles.length > 0) {
      r += `\n💡 PERSONALIZATION ANGLES:\n`;
      intel.angles.forEach((a, i) => {
        r += `  ${i+1}. [${a.priority}] ${a.type}: ${a.content}\n`;
        if (a.source) r += `     Source: ${a.source}\n`;
      });
    }
    
    r += `\n${'='.repeat(80)}\n`;
    const aiType = this.apiCallCount.groq > 0 ? 'GROQ AI' : this.apiCallCount.gemini > 0 ? 'GEMINI AI' : 'TEMPLATE';
    r += `📧 ${aiType}-GENERATED EMAIL DRAFT\n`;
    r += '='.repeat(80) + '\n\n';
    r += intel.aiDraft || 'No draft generated';
    r += `\n\n${'='.repeat(80)}\n`;
    
    if (intel.recommendation === 'SEND') {
      r += `\n✅ ACTION: Ready to send!\n`;
      r += `  1. Verify news links are current\n`;
      r += `  2. Check LinkedIn profile for recent activity\n`;
      r += `  3. Add final personal touch if needed\n`;
      r += `  4. SEND!\n`;
    } else if (intel.recommendation === 'REVIEW') {
      r += `\n⚠️  ACTION: Spend 5-10 min reviewing\n`;
      r += `  1. Visit website for more context\n`;
      r += `  2. Check LinkedIn for recent posts/activity\n`;
      r += `  3. Strengthen personalization\n`;
      r += `  4. Then decide: send or skip\n`;
    } else {
      r += `\n❌ ACTION: Skip or do 15+ min manual research\n`;
      r += `  Low confidence - not worth the time unless you have extra capacity\n`;
      r += `  Focus on higher-scoring prospects first\n`;
    }
    
    return r;
  }

  async reviewMode() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 REVIEW MODE - Apollo Lead Research Summary');
    console.log('='.repeat(80) + '\n');
    
    const reports = fs.readdirSync(CONFIG.RESEARCH_DIR)
      .filter(f => f.endsWith('_research.json'))
      .map(f => {
        const data = JSON.parse(fs.readFileSync(path.join(CONFIG.RESEARCH_DIR, f), 'utf8'));
        return { file: f, data };
      })
      .sort((a, b) => b.data.confidence.score - a.data.confidence.score);
    
    if (reports.length === 0) {
      console.log('❌ No reports found. Run research first:\n');
      console.log('   node lead_automation.js research ./csv/apollo_export.csv\n');
      return;
    }

    const readyToSend = reports.filter(r => r.data.confidence.score >= CONFIG.MIN_CONFIDENCE_TO_SEND);
    const needsReview = reports.filter(r => r.data.confidence.score >= CONFIG.MIN_CONFIDENCE_TO_REVIEW && r.data.confidence.score < CONFIG.MIN_CONFIDENCE_TO_SEND);
    const skip = reports.filter(r => r.data.confidence.score < CONFIG.MIN_CONFIDENCE_TO_REVIEW);

    console.log(`📈 Total prospects researched: ${reports.length}\n`);
    
    // Ready to Send
    console.log(`🟢 READY TO SEND (${readyToSend.length}) - Confidence ${CONFIG.MIN_CONFIDENCE_TO_SEND}+`);
    console.log('   High confidence, verified emails, strong personalization\n');
    
    if (readyToSend.length > 0) {
      readyToSend.forEach((r, i) => {
        const intel = r.data;
        const topAngle = intel.angles[0];
        console.log(`   ${i+1}. ${intel.prospect.company} (${intel.confidence.score}/100)`);
        console.log(`      ${intel.prospect.name} - ${intel.prospect.title}`);
        console.log(`      Email: ${intel.prospect.email} ${intel.apollo.emailVerified ? '✅' : ''}`);
        if (topAngle) {
          console.log(`      Angle: ${topAngle.type} - ${topAngle.content.substring(0, 60)}...`);
        }
        console.log(`      Report: ${r.file.replace('.json', '.txt')}\n`);
      });
    } else {
      console.log('   None found - try exporting better-qualified leads from Apollo\n');
      console.log('   💡 TIP: Filter Apollo for: funded companies, active tech companies, 50-500 employees\n');
    }
    
    // Needs Review
    console.log(`\n🟡 NEEDS REVIEW (${needsReview.length}) - Confidence ${CONFIG.MIN_CONFIDENCE_TO_REVIEW}-${CONFIG.MIN_CONFIDENCE_TO_SEND-1}`);
    console.log('   Good potential, add 5-10 min research before sending\n');
    
    if (needsReview.length > 0) {
      needsReview.slice(0, 5).forEach((r, i) => {
        console.log(`   ${i+1}. ${r.data.prospect.company} (${r.data.confidence.score}/100)`);
        console.log(`      ${r.data.prospect.name} - ${r.data.prospect.title}`);
        console.log(`      Why review: ${r.data.confidence.factors.slice(0, 2).join(', ')}\n`);
      });
      if (needsReview.length > 5) {
        console.log(`   ... and ${needsReview.length - 5} more\n`);
      }
    }
    
    // Skip
    console.log(`\n🔴 SKIP/LOW PRIORITY (${skip.length}) - Confidence <${CONFIG.MIN_CONFIDENCE_TO_REVIEW}`);
    console.log('   Insufficient data or weak match - skip unless you have extra time\n');
    
    // Statistics
    console.log('\n' + '='.repeat(80));
    console.log('📊 STATISTICS');
    console.log('='.repeat(80));
    console.log(`Ready to send: ${readyToSend.length} (${Math.round(readyToSend.length/reports.length*100)}%)`);
    console.log(`Needs review: ${needsReview.length} (${Math.round(needsReview.length/reports.length*100)}%)`);
    console.log(`Skip: ${skip.length} (${Math.round(skip.length/reports.length*100)}%)`);
    
    // Email verification stats
    const verifiedEmails = reports.filter(r => r.data.apollo.emailVerified).length;
    const catchAll = reports.filter(r => r.data.apollo.catchAll).length;
    console.log(`\nEmail verification: ${verifiedEmails} verified, ${catchAll} catch-all`);
    
    // Funding signals
    const funded = reports.filter(r => r.data.apollo.funding.latest).length;
    console.log(`Recently funded: ${funded}`);
    
    // African tech news
    const africanNews = reports.filter(r => r.data.findings.nigerianTechNews.length > 0).length;
    console.log(`Featured in African tech news: ${africanNews}`);
    
    // Decision makers
    const decisionMakers = reports.filter(r => 
      r.data.prospect.seniority?.toLowerCase().includes('c suite') ||
      r.data.prospect.seniority?.toLowerCase().includes('vp') ||
      r.data.prospect.title?.toLowerCase().includes('founder')
    ).length;
    console.log(`Decision makers (C-suite/VP/Founder): ${decisionMakers}`);
    
    console.log('\n' + '='.repeat(80));
    console.log('🚀 NEXT STEPS');
    console.log('='.repeat(80));
    console.log('1. Focus on 🟢 READY TO SEND prospects first');
    console.log('2. Read TXT reports in: ' + CONFIG.RESEARCH_DIR);
    console.log('3. Verify personalization angles (click news links)');
    console.log('4. Check LinkedIn profiles for recent activity');
    console.log('5. Copy/customize AI-generated emails');
    console.log('6. Send 5-10 HIGH-QUALITY emails per day\n');
    console.log('💡 TIP: One great, personalized email beats 10 generic ones.\n');
    console.log('💡 TIP: If scores are low, try better Apollo filters (funded, tech-focused, active online)\n');
  }

  // Utility functions
  cleanUrl(url) {
    if (!url) return null;
    try {
      let clean = url.trim().toLowerCase();
      if (clean.startsWith('www.')) clean = 'https://' + clean;
      else if (!clean.startsWith('http')) clean = 'https://' + clean;
      return clean;
    } catch (error) {
      return null;
    }
  }

  getDateXDaysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  }

  formatDate(dateString) {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return '1 day ago';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (error) {
      return 'Recent';
    }
  }

  extractDate(item) {
    const match = item.snippet?.match(/(\d{1,2}\s+(days?|weeks?|months?)\s+ago)/i);
    if (match) return match[0];
    
    const specificDate = item.snippet?.match(/(\w+\s+\d{1,2},?\s+\d{4})/);
    if (specificDate) return specificDate[0];
    
    return 'Recent';
  }

  categorizeNews(title, snippet) {
    const text = ((title || '') + ' ' + (snippet || '')).toLowerCase();
    
    if (text.includes('fund') || text.includes('raise') || text.includes('investment') || text.includes('series')) {
      return 'funding'; 
    }
    if (text.includes('launch') || text.includes('release') || text.includes('unveil') || text.includes('introduce')) {
      return 'product launch';
    }
    if (text.includes('partner') || text.includes('acquisition') || text.includes('merge') || text.includes('collaborate')) {
      return 'partnership';
    }
    if (text.includes('expand') || text.includes('open') || text.includes('grow') || text.includes('hire')) {
      return 'expansion';
    }
    if (text.includes('award') || text.includes('win') || text.includes('recognition')) {
      return 'achievement';
    }
    
    return 'announcement';
  }

  async readCSV(filePath) {
    return new Promise((resolve, reject) => {
      const prospects = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => prospects.push(data))
        .on('end', () => resolve(prospects))
        .on('error', reject);
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// MAIN EXECUTION
async function main() {
  const assistant = new EnhancedApolloAutomation();
  const command = process.argv[2];

  if (command === 'research' || command === 'batch') {
    const csvFile = process.argv[3] || path.join(CONFIG.CSV_DIR, 'apollo_export.csv');
    
    if (!fs.existsSync(csvFile)) {
      console.log(`\n❌ ERROR: CSV file not found: ${csvFile}\n`);
      console.log('Usage: node lead_automation.js research <csv-file>\n');
      console.log('Example: node lead_automation.js research ./csv/apollo_export.csv\n');
      return;
    }
    
    await assistant.batchResearch(csvFile);
    
  } else if (command === 'review') {
    await assistant.reviewMode();
    
  } else if (command === 'setup') {
    console.log('\n' + '='.repeat(80));
    console.log('🚀 SETUP GUIDE - Enhanced Apollo + Groq/Gemini + African Tech News');
    console.log('='.repeat(80) + '\n');
    
    console.log('✅ STEP 1: Get FREE AI APIs\n');
    
    console.log('🤖 GROQ API (Primary - RECOMMENDED)\n');
    console.log('   • Visit: https://console.groq.com');
    console.log('   • Sign up with GitHub/Google');
    console.log('   • Create API key (free: 14,400 requests/day!)');
    console.log('   • Add to .env file:\n');
    console.log('     GROQ_API_KEY=gsk_your_key_here\n');
    
    console.log('🔮 GEMINI API (Fallback - You already have AI Pro!)\n');
    console.log('   • Visit: https://aistudio.google.com/app/apikey');
    console.log('   • Create API key (free: 1,500 requests/day)');
    console.log('   • Add to .env file:\n');
    console.log('     GEMINI_API_KEY=your_key_here\n');
    
    console.log('📰 NEWSAPI (Optional but recommended)\n');
    console.log('   • Visit: https://newsapi.org/register');
    console.log('   • Free tier: 100 requests/day');
    console.log('   • Add to .env file:\n');
    console.log('     NEWSAPI_KEY=your_key_here\n');
    
    console.log('🔍 GOOGLE CUSTOM SEARCH (Optional - for African tech news)\n');
    console.log('   • Visit: https://console.cloud.google.com');
    console.log('   • Enable Custom Search API');
    console.log('   • Create search engine: https://programmablesearchengine.google.com');
    console.log('   • Add to .env file:\n');
    console.log('     GOOGLE_API_KEY=your_key_here');
    console.log('     GOOGLE_CX_ID=your_search_engine_id\n');
    
    console.log('📦 INSTALL DEPENDENCIES\n');
    console.log('   npm install @google/generative-ai\n');
    
    console.log('📊 STEP 2: Apollo.io Setup\n');
    console.log('   💡 RECOMMENDED FILTERS for better results:\n');
    console.log('   • Company size: 50-500 employees (sweet spot)');
    console.log('   • Location: Nigeria, Ghana, Kenya, South Africa (for African tech)');
    console.log('   • Funding: Any funding stage (shows growth)');
    console.log('   • Industry: Technology, SaaS, Fintech, E-commerce');
    console.log('   • Seniority: C-suite, VP, Director, Manager');
    console.log('   • Email status: Verified only\n');
    console.log('   • Technologies: React, Node.js, MongoDB, AWS (matches your stack)\n');
    
    console.log('🎯 STEP 3: Export & Run\n');
    console.log('   1. Export 50-100 leads from Apollo (ALL columns)');
    console.log('   2. Save as CSV in ./csv/ folder');
    console.log('   3. Run: node lead_automation.js research ./csv/apollo_export.csv');
    console.log('   4. Wait for AI research to complete');
    console.log('   5. Run: node lead_automation.js review');
    console.log('   6. Send high-confidence emails!\n');
    
    console.log('🌍 AFRICAN TECH NEWS SOURCES (Auto-enabled)\n');
    console.log('   ✅ TechPoint Africa');
    console.log('   ✅ TechCabal');
    console.log('   ✅ Technext');
    console.log('   ✅ TechEconomy');
    console.log('   ✅ Nairametrics');
    console.log('   ✅ BusinessDay Nigeria');
    console.log('   ✅ Ventures Africa\n');
    
    console.log('💡 PRO TIPS FOR BETTER RESULTS\n');
    console.log('   • Start with funded companies (they have budget)');
    console.log('   • Focus on tech/SaaS companies (more online presence = better research)');
    console.log('   • Larger companies (50-500) = more news = higher confidence');
    console.log('   • Check LinkedIn before sending (verify they\'re still there)');
    console.log('   • Send 5-10 quality emails/day (not 50 generic ones)');
    console.log('   • Track responses, iterate on what works\n');
    
  } else {
    console.log('\n' + '='.repeat(80));
    console.log('🚀 ENHANCED APOLLO LEAD AUTOMATION (100% FREE)');
    console.log('   Groq + Gemini Fallback | African Tech News Enabled');
    console.log('='.repeat(80) + '\n');
    
    console.log('📋 COMMANDS:\n');
    console.log('   node lead_automation.js research <csv>  - Research Apollo leads');
    console.log('   node lead_automation.js review          - Review results & prioritize');
    console.log('   node lead_automation.js setup           - Setup guide\n');
    
    console.log('✨ KEY FEATURES:\n');
    console.log('   🤖 Dual AI system: Groq (primary) + Gemini (fallback)');
    console.log('   🌍 African tech news integration (TechPoint, TechCabal, etc.)');
    console.log('   ✅ Smart Apollo data parsing (email verification, funding, tech)');
    console.log('   📰 Multi-source news research (global + local)');
    console.log('   🏢 Company website deep scraping (press, blog, careers, about)');
    console.log('   🔧 Tech stack matching (from Apollo)');
    console.log('   💰 Funding signal prioritization');
    console.log('   📊 Enhanced confidence scoring (0-100)');
    console.log('   🎨 Intelligent personalization angles');
    console.log('   💼 Nigerian market optimization\n');
    
    console.log('🆓 100% FREE:\n');
    console.log('   • Groq API: 14,400 requests/day');
    console.log('   • Gemini API: 1,500 requests/day (you have AI Pro!)');
    console.log('   • NewsAPI: 100 requests/day');
    console.log('   • Website scraping: Unlimited');
    console.log('   • Combined: 15,900 AI requests/day FREE\n');
    
    console.log('📈 EXPECTED RESULTS:\n');
    console.log('   From 100 Apollo leads:');
    console.log('   • 🟢 Ready to send (75+): 15-25%');
    console.log('   • 🟡 Needs review (55-74): 25-35%');
    console.log('   • 🔴 Skip (<55): 40-60%\n');
    console.log('   Focus on quality over quantity!\n');
    
    console.log('🚀 QUICK START:\n');
    console.log('   1. node lead_automation.js setup');
    console.log('   2. Get Groq + Gemini API keys');
    console.log('   3. Export 50-100 Apollo leads (use recommended filters)');
    console.log('   4. node lead_automation.js research ./csv/apollo_export.csv');
    console.log('   5. node lead_automation.js review');
    console.log('   6. Send your first AI-personalized emails!\n');
    
    console.log('💡 NEED HELP?\n');
    console.log('   • Low confidence scores? Export better leads from Apollo');
    console.log('   • AI failing? Check your .env file');
    console.log('   • No news? Normal for smaller/private companies\n');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = EnhancedApolloAutomation;