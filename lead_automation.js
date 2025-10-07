const fs = require('fs');
const csv = require('csv-parser');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
require('dotenv').config();

// PRODUCTION-READY LEAD RESEARCH ASSISTANT
// Uses NewsAPI for accurate company news + fallback strategies

const CONFIG = {
  CSV_DIR: './csv',
  RESEARCH_DIR: './research_reports',
  DRAFTS_DIR: './email_drafts',
  REQUEST_TIMEOUT: 15000,
  RESEARCH_DELAY: 2000,
  MAX_NEWS_ARTICLES: 10,
  NEWS_AGE_DAYS: 60
};

const YOUR_EXPERIENCE = {
  projects: [
    {
      name: "Dassage Communication Platform",
      description: "Real-time messaging with video calls, file sharing, WebSocket architecture",
      techStack: ["React", "Node.js", "MongoDB", "WebSocket", "JWT"],
      keywords: ["real-time", "messaging", "video", "communication", "collaboration", "websocket", "chat"],
      industryFit: ["saas", "communication", "team collaboration", "remote work", "productivity", "software"],
      scale: "100+ concurrent users"
    },
    {
      name: "DAstore E-Commerce Platform",
      description: "Luxury e-commerce with 140+ products, payment processing, cart management",
      techStack: ["Next.js", "MongoDB", "REST API", "JWT", "bcrypt"],
      keywords: ["e-commerce", "payment", "cart", "checkout", "product", "shopping", "store"],
      industryFit: ["e-commerce", "retail", "marketplace", "fashion", "luxury", "shopping", "consumer"],
      scale: "140+ products, 7 categories"
    },
    {
      name: "Crewmanage HR System",
      description: "HR management with scheduling, payroll, workflow automation, RBAC",
      techStack: ["React", "Node.js", "MongoDB", "Role-based access"],
      keywords: ["hr", "scheduling", "workflow", "automation", "employee", "payroll", "management"],
      industryFit: ["hr tech", "workforce", "business software", "enterprise", "staffing", "recruitment"],
      scale: "Enterprise HR features"
    },
    {
      name: "Durl URL Shortener",
      description: "URL shortening with analytics, rate limiting, thousands of monthly redirections",
      techStack: ["Next.js", "Node.js", "MongoDB", "SHA-256", "JWT"],
      keywords: ["analytics", "url", "tracking", "metrics", "dashboard", "data"],
      industryFit: ["marketing", "analytics", "saas", "developer tools", "martech"],
      scale: "Thousands of monthly redirections"
    }
  ],
  
  skills: {
    frontend: ["React.js", "Next.js", "JavaScript", "HTML5", "CSS3", "Tailwind CSS"],
    backend: ["Node.js", "Express.js", "MongoDB", "REST APIs"],
    realtime: ["WebSocket", "Real-time data sync"],
    auth: ["JWT Authentication", "bcrypt", "Role-based access control"],
    payments: ["Payment gateway integration", "Stripe", "Paystack"],
    deployment: ["AWS", "Heroku", "Vercel"]
  }
};

class ProductionResearchAssistant {
  constructor() {
    this.initializeDirectories();
    this.apiCallCount = { news: 0, search: 0 };
  }

  initializeDirectories() {
    [CONFIG.RESEARCH_DIR, CONFIG.DRAFTS_DIR].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async batchResearch(csvFile) {
    console.log('PRODUCTION LEAD RESEARCH ASSISTANT\n');
    
    const prospects = await this.readCSV(csvFile);
    console.log(`Found ${prospects.length} prospects\n`);
    
    const newProspects = prospects.filter(p => {
      const filename = `${p['Company Name'].replace(/[^a-z0-9]/gi, '_')}_research.json`;
      return !fs.existsSync(path.join(CONFIG.RESEARCH_DIR, filename));
    });
    
    console.log(`Researching ${newProspects.length} new prospects\n`);
    
    let processed = 0;
    let highConfidence = 0;
    let skipped = 0;
    
    for (const prospect of newProspects) {
      console.log(`[${processed + 1}/${newProspects.length}] ${prospect['Company Name']}...`);
      
      try {
        const intel = await this.deepResearch(prospect);
        await this.saveIntelligence(prospect, intel);
        
        if (intel.confidence.score >= 70) highConfidence++;
        if (intel.recommendation === 'SKIP') skipped++;
        
        processed++;
        console.log(`  ✓ ${intel.confidence.level} (${intel.confidence.score}/100)`);
        
      } catch (error) {
        console.log(`  ✗ Error: ${error.message}`);
      }
      
      if (processed < newProspects.length) {
        await this.sleep(CONFIG.RESEARCH_DELAY);
      }
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`RESEARCH COMPLETE`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Processed: ${processed}`);
    console.log(`High confidence: ${highConfidence} (${Math.round(highConfidence/processed*100)}%)`);
    console.log(`Recommended skip: ${skipped}`);
    console.log(`API calls - News: ${this.apiCallCount.news}, Search: ${this.apiCallCount.search}`);
    console.log(`\nReports: ${CONFIG.RESEARCH_DIR}/`);
    console.log(`\nNext: node lead_automation.js review`);
  }

  async deepResearch(prospect) {
    const intel = {
      prospect: {
        name: `${prospect['First Name']} ${prospect['Last Name']}`,
        firstName: prospect['First Name'],
        title: prospect['Title'],
        email: prospect['Email'],
        company: prospect['Company Name'],
        industry: prospect['Industry'],
        employees: prospect['# Employees'],
        website: prospect['Website'],
        linkedIn: prospect['Person Linkedin Url']
      },
      
      findings: {
        news: [],
        blog: [],
        techStack: {},
        websiteWorks: false,
        linkedInData: null
      },
      
      analysis: {
        companyStage: null,
        industryMatch: null,
        growthSignals: []
      },
      
      matches: [],
      angles: [],
      draft: null,
      confidence: {},
      recommendation: null,
      manualChecks: []
    };

    // 1. Website verification
    console.log('  → Website check...');
    intel.findings.websiteWorks = await this.verifyWebsite(prospect['Website']);

    // 2. Tech stack (only if website works)
    if (intel.findings.websiteWorks) {
      console.log('  → Tech stack...');
      intel.findings.techStack = await this.analyzeTechStack(prospect['Website']);
    }

    // 3. News search (primary: NewsAPI, fallback: manual search hints)
    console.log('  → News search...');
    intel.findings.news = await this.searchNews(prospect['Company Name'], prospect['Industry'], prospect['Website']);

    // 4. Blog posts
    console.log('  → Blog check...');
    if (intel.findings.websiteWorks) {
      intel.findings.blog = await this.findBlog(prospect['Website']);
    }

    // 5. Company analysis
    console.log('  → Analysis...');
    intel.analysis = this.analyzeCompany(intel.findings, prospect);

    // 6. Experience matching
    console.log('  → Matching...');
    intel.matches = this.matchExperience(intel.analysis, prospect);

    // 7. Generate angles
    intel.angles = this.generateAngles(intel);

    // 8. Draft email
    intel.draft = this.generateDraft(intel);

    // 9. Confidence & recommendation
    const conf = this.calculateConfidence(intel);
    intel.confidence = conf;
    intel.recommendation = conf.recommendation;

    // 10. Manual checks
    intel.manualChecks = this.getManualChecks(intel);

    return intel;
  }

  async verifyWebsite(url) {
    try {
      const cleanUrl = this.cleanUrl(url);
      if (!cleanUrl) return false;

      const response = await axios.get(cleanUrl, {
        timeout: CONFIG.REQUEST_TIMEOUT,
        maxRedirects: 5,
        validateStatus: (status) => status < 500,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async analyzeTechStack(url) {
    const stack = { detected: [], confidence: 'low' };

    try {
      const cleanUrl = this.cleanUrl(url);
      const response = await axios.get(cleanUrl, {
        timeout: CONFIG.REQUEST_TIMEOUT,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      const html = response.data.toLowerCase();
      const detections = [
        { pattern: ['react', '_next/', '__next'], tech: 'React' },
        { pattern: ['vue.js', 'nuxt'], tech: 'Vue' },
        { pattern: ['ng-', 'angular'], tech: 'Angular' },
        { pattern: ['wp-content', 'wp-includes'], tech: 'WordPress' },
        { pattern: ['shopify', 'cdn.shopify'], tech: 'Shopify' }
      ];

      detections.forEach(({ pattern, tech }) => {
        if (pattern.some(p => html.includes(p))) {
          stack.detected.push(tech);
        }
      });

      stack.confidence = stack.detected.length > 0 ? 'medium' : 'low';
    } catch (error) {
      // Silent fail
    }

    return stack;
  }

  async searchNews(companyName, industry, website) {
    // Try NewsAPI first (most accurate)
    if (process.env.NEWSAPI_KEY) {
      const newsApiResults = await this.searchNewsAPI(companyName);
      if (newsApiResults.length > 0) {
        return newsApiResults;
      }
    }

    // Fallback: Try Google with very strict filtering
    if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_CX_ID) {
      const googleResults = await this.searchGoogleNews(companyName, industry, website);
      if (googleResults.length > 0) {
        return googleResults;
      }
    }

    // No news found
    return [];
  }

  async searchNewsAPI(companyName) {
    const news = [];
    
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

      if (response.data.articles && response.data.articles.length > 0) {
        response.data.articles.forEach(article => {
          // Only include if company name is actually in title or description
          const text = (article.title + ' ' + article.description).toLowerCase();
          if (text.includes(companyName.toLowerCase())) {
            news.push({
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
        
        console.log(`    NewsAPI: ${news.length} verified articles`);
      }

    } catch (error) {
      if (error.response?.status === 429) {
        console.log('    NewsAPI rate limit');
      } else if (error.response?.status === 426) {
        console.log('    NewsAPI: Upgrade required');
      }
    }

    return news;
  }

  async searchGoogleNews(companyName, industry, website) {
    const news = [];
    
    try {
      this.apiCallCount.search++;
      
      // Extract domain from website for filtering
      const domain = this.extractDomain(website);
      
      const searchQuery = `"${companyName}" ${industry} (funding OR launch OR partnership OR expansion)`;
      
      const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
        params: {
          key: process.env.GOOGLE_API_KEY,
          cx: process.env.GOOGLE_CX_ID,
          q: searchQuery,
          dateRestrict: `d${CONFIG.NEWS_AGE_DAYS}`,
          num: 10
        },
        timeout: CONFIG.REQUEST_TIMEOUT
      });

      if (response.data.items) {
        for (const item of response.data.items) {
          const relevance = this.scoreGoogleResult(item, companyName, domain);
          
          // Only include if relevance >= 70%
          if (relevance >= 0.7) {
            news.push({
              title: item.title,
              snippet: item.snippet,
              url: item.link,
              date: this.extractDate(item),
              type: this.categorizeNews(item.title, item.snippet),
              relevance: Math.round(relevance * 100),
              verified: true
            });
          }
        }
        
        console.log(`    Google: ${news.length}/${response.data.items.length} passed filter`);
      }

    } catch (error) {
      // Silent fail
    }

    return news;
  }

  scoreGoogleResult(item, companyName, companyDomain) {
    let score = 0;
    const text = (item.title + ' ' + item.snippet).toLowerCase();
    const url = item.link.toLowerCase();
    const companyLower = companyName.toLowerCase();

    // Exact company name in title (strong)
    if (item.title.toLowerCase().includes(companyLower)) {
      score += 0.5;
    }

    // Company domain in URL (very strong)
    if (companyDomain && url.includes(companyDomain)) {
      score += 0.4;
    }

    // Company name in URL path
    const urlPath = url.split('?')[0];
    if (urlPath.includes(companyLower.replace(/\s+/g, '-')) || 
        urlPath.includes(companyLower.replace(/\s+/g, ''))) {
      score += 0.3;
    }

    // Blocklist domains (directory/list sites)
    const blockList = [
      'wikipedia', 'crunchbase', 'linkedin.com/company', 'indeed.com',
      'goodfirms', 'clutch.co', 'instagram.com', 'facebook.com',
      'directory', 'yellowpages', 'list of', 'top 10', 'best cyber'
    ];
    
    if (blockList.some(blocked => url.includes(blocked) || text.includes(blocked))) {
      score -= 0.6;
    }

    // Bonus for news sites
    const newsSites = ['techcrunch', 'techpoint', 'venturebeat', 'reuters', 
                       'bloomberg', 'businessday', 'guardian', 'punch', 'vanguard'];
    if (newsSites.some(site => url.includes(site))) {
      score += 0.3;
    }

    return Math.max(0, Math.min(1, score));
  }

  async findBlog(url) {
    const blog = { found: false, posts: [], url: null };

    try {
      const cleanUrl = this.cleanUrl(url);
      const paths = ['/blog', '/news', '/insights', '/articles', '/resources'];
      
      for (const path of paths) {
        try {
          const blogUrl = `${cleanUrl}${path}`;
          const response = await axios.get(blogUrl, {
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
          });

          const $ = cheerio.load(response.data);
          
          const selectors = ['article h2', 'article h3', '.post-title', '.blog-title', 'h2.entry-title'];
          
          for (const selector of selectors) {
            $(selector).slice(0, 5).each((i, el) => {
              const title = $(el).text().trim();
              if (title.length > 15 && title.length < 200) {
                blog.posts.push({ title });
              }
            });
            
            if (blog.posts.length > 0) break;
          }

          if (blog.posts.length > 0) {
            blog.found = true;
            blog.url = blogUrl;
            console.log(`    Blog: ${blog.posts.length} posts`);
            break;
          }

        } catch (error) {
          continue;
        }
      }

    } catch (error) {
      // Silent fail
    }

    return blog;
  }

  analyzeCompany(findings, prospect) {
    const analysis = {
      companyStage: null,
      industryMatch: null,
      growthSignals: []
    };

    const employees = parseInt(prospect['# Employees']) || 0;

    // Determine stage
    if (employees < 20) analysis.companyStage = 'Early Stage';
    else if (employees < 100) analysis.companyStage = 'Growth Stage';
    else if (employees < 500) analysis.companyStage = 'Established';
    else analysis.companyStage = 'Enterprise';

    // Check if recently funded
    const fundingNews = findings.news.filter(n => n.type === 'funding');
    if (fundingNews.length > 0) {
      analysis.companyStage += ' (Recently Funded)';
      analysis.growthSignals.push('Recent funding');
    }

    // Growth signals
    if (findings.news.length >= 3) {
      analysis.growthSignals.push('Active in news');
    }
    if (findings.blog.found) {
      analysis.growthSignals.push('Content marketing');
    }

    // Industry matching
    const industry = (prospect['Industry'] || '').toLowerCase();
    const keywords = (prospect['Keywords'] || '').toLowerCase();
    
    analysis.industryMatch = this.matchIndustry(industry, keywords);

    return analysis;
  }

  matchIndustry(industry, keywords) {
    const matches = {
      'saas': ['saas', 'software', 'platform', 'cloud', 'application'],
      'fintech': ['fintech', 'payment', 'financial', 'banking', 'finance'],
      'ecommerce': ['e-commerce', 'ecommerce', 'retail', 'shopping', 'marketplace'],
      'hr': ['hr', 'human resources', 'recruitment', 'staffing', 'workforce'],
      'logistics': ['logistics', 'delivery', 'shipping', 'transportation', 'supply chain'],
      'marketing': ['marketing', 'advertising', 'martech', 'analytics', 'campaign']
    };

    for (const [key, terms] of Object.entries(matches)) {
      if (terms.some(term => industry.includes(term) || keywords.includes(term))) {
        return key;
      }
    }

    return null;
  }

  matchExperience(analysis, prospect) {
    const matches = [];
    const industry = (prospect['Industry'] || '').toLowerCase();
    const keywords = (prospect['Keywords'] || '').toLowerCase();
    const searchText = industry + ' ' + keywords;

    YOUR_EXPERIENCE.projects.forEach(project => {
      let score = 0;
      const reasons = [];

      // Industry fit (primary signal)
      project.industryFit.forEach(fit => {
        if (searchText.includes(fit)) {
          score += 30;
          reasons.push(`Industry: ${fit}`);
        }
      });

      // Keyword matches
      project.keywords.forEach(keyword => {
        if (searchText.includes(keyword)) {
          score += 5;
        }
      });

      // Only include strong matches
      if (score >= 30) {
        matches.push({
          project: project.name,
          description: project.description,
          score,
          reasons: reasons.slice(0, 2),
          techStack: project.techStack.slice(0, 4).join(', '),
          scale: project.scale
        });
      }
    });

    return matches.sort((a, b) => b.score - a.score);
  }

  generateAngles(intel) {
    const angles = [];

    // News angle (highest priority)
    if (intel.findings.news.length > 0) {
      const news = intel.findings.news[0];
      angles.push({
        type: 'news',
        priority: 'high',
        content: `Recent ${news.type}: "${news.title}"`,
        source: news.url
      });
    }

    // Blog angle
    if (intel.findings.blog.found && intel.findings.blog.posts.length > 0) {
      angles.push({
        type: 'blog',
        priority: 'medium',
        content: `Blog post: "${intel.findings.blog.posts[0].title}"`,
        source: intel.findings.blog.url
      });
    }

    // Experience match
    if (intel.matches.length > 0) {
      angles.push({
        type: 'experience',
        priority: intel.matches[0].score > 50 ? 'high' : 'medium',
        content: `${intel.matches[0].project} relevant to their ${intel.analysis.industryMatch || 'industry'}`
      });
    }

    return angles;
  }

  generateDraft(intel) {
    // Don't generate if insufficient info
    if (intel.angles.length === 0 || !intel.findings.websiteWorks) {
      return "⚠️ INSUFFICIENT DATA - Do manual research before reaching out.\n\nNo verified news, blog, or strong experience match found.";
    }

    const bestAngle = intel.angles[0];
    let draft = '';

    // Subject
    if (bestAngle.type === 'news') {
      draft += `SUBJECT: ${intel.prospect.firstName} - congrats on ${intel.findings.news[0].type}\n\n`;
    } else if (bestAngle.type === 'blog') {
      draft += `SUBJECT: ${intel.prospect.firstName} - your recent article\n\n`;
    } else {
      draft += `SUBJECT: ${intel.prospect.firstName} - ${intel.prospect.company} development\n\n`;
    }

    // Opening
    draft += `Hi ${intel.prospect.firstName},\n\n`;

    if (bestAngle.type === 'news') {
      const news = intel.findings.news[0];
      draft += `I saw the news about ${intel.prospect.company}'s ${news.type}`;
      if (news.title.length < 80) {
        draft += ` - "${news.title}"`;
      }
      draft += `. Congratulations!\n\n`;
    } else if (bestAngle.type === 'blog') {
      draft += `I read your post "${intel.findings.blog.posts[0].title}" - great insights.\n\n`;
    } else {
      draft += `I've been following companies in the ${intel.prospect.industry} space.\n\n`;
    }

    // Experience
    if (intel.matches.length > 0) {
      const match = intel.matches[0];
      draft += `I'm David Ariyo, a Full Stack Developer. I recently built ${match.project} - ${match.description}\n\n`;
      draft += `Tech: ${match.techStack} | Scale: ${match.scale}\n\n`;
    } else {
      draft += `I'm David Ariyo, a Full Stack Developer specializing in MERN stack. I build scalable applications for growing tech companies.\n\n`;
    }

    // CTA
    draft += `Would you be open to a brief chat if ${intel.prospect.company} ever needs freelance development support?\n\n`;

    // Signature
    draft += `Best regards,\nDavid Ariyo\nFull Stack Developer\n`;
    draft += `davidariyo109@gmail.com | (+234) 903-6184-863\n`;
    draft += `Portfolio: davidariyo.onrender.com`;

    return draft;
  }

  calculateConfidence(intel) {
    let score = 0;
    const factors = [];

    // Website working
    if (intel.findings.websiteWorks) {
      score += 20;
      factors.push('Website verified');
    } else {
      score -= 15;
      factors.push('Website inaccessible');
    }

    // News (high value)
    if (intel.findings.news.length >= 2) {
      score += 35;
      factors.push(`${intel.findings.news.length} verified news items`);
    } else if (intel.findings.news.length === 1) {
      score += 25;
      factors.push('1 verified news item');
    }

    // Blog
    if (intel.findings.blog.found) {
      score += 15;
      factors.push('Blog content found');
    }

    // Strong experience match
    if (intel.matches.length > 0 && intel.matches[0].score >= 50) {
      score += 25;
      factors.push('Strong experience match');
    } else if (intel.matches.length > 0) {
      score += 10;
      factors.push('Moderate experience match');
    }

    // Tech stack
    if (intel.findings.techStack.detected.length > 0) {
      score += 5;
      factors.push('Tech stack detected');
    }

    score = Math.max(0, Math.min(100, score));

    let level = 'Low';
    let rec = 'SKIP';

    if (score >= 70) {
      level = 'High';
      rec = 'SEND';
    } else if (score >= 50) {
      level = 'Medium';
      rec = 'REVIEW';
    } else if (score >= 30) {
      level = 'Low';
      rec = 'MANUAL RESEARCH';
    }

    return {
      score,
      level,
      factors,
      recommendation: rec
    };
  }

  getManualChecks(intel) {
    const checks = [];

    if (intel.recommendation === 'SEND') {
      checks.push('Verify news links are correct');
      checks.push(`Check LinkedIn: ${intel.prospect.linkedIn}`);
      checks.push('Personalize draft before sending');
    } else if (intel.recommendation === 'REVIEW') {
      checks.push('Spend 10 min on additional research');
      checks.push(`Visit: ${intel.prospect.website}`);
      checks.push(`LinkedIn: ${intel.prospect.linkedIn}`);
      checks.push('Strengthen personalization');
    } else {
      checks.push('20+ min manual research needed');
      checks.push('Or skip this prospect');
    }

    return checks;
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
    
    r += `${'='.repeat(70)}\n`;
    r += `RESEARCH REPORT: ${intel.prospect.company}\n`;
    r += `${'='.repeat(70)}\n\n`;
    
    r += `CONTACT:\n`;
    r += `  Name: ${intel.prospect.name}\n`;
    r += `  Title: ${intel.prospect.title}\n`;
    r += `  Email: ${intel.prospect.email}\n`;
    r += `  Company: ${intel.prospect.company}\n`;
    r += `  Industry: ${intel.prospect.industry}\n`;
    r += `  Size: ${intel.prospect.employees} employees\n`;
    r += `  Website: ${intel.prospect.website} ${intel.findings.websiteWorks ? '✓' : '✗'}\n`;
    r += `  LinkedIn: ${intel.prospect.linkedIn}\n\n`;
    
    r += `CONFIDENCE: ${intel.confidence.level} (${intel.confidence.score}/100)\n`;
    r += `RECOMMENDATION: ${intel.recommendation}\n`;
    r += `Factors: ${intel.confidence.factors.join(', ')}\n\n`;
    
    r += `FINDINGS:\n`;
    
    if (intel.findings.news.length > 0) {
      r += `\n  NEWS (${intel.findings.news.length} verified):\n`;
      intel.findings.news.forEach((n, i) => {
        r += `  ${i+1}. [${n.type}] ${n.title}\n`;
        r += `     ${n.date} | ${n.source || 'Source'}\n`;
        r += `     ${n.url}\n`;
      });
    } else {
      r += `\n  NEWS: None found\n`;
    }
    
    if (intel.findings.blog.found) {
      r += `\n  BLOG: Found at ${intel.findings.blog.url}\n`;
      intel.findings.blog.posts.slice(0, 3).forEach((p, i) => {
        r += `  ${i+1}. "${p.title}"\n`;
      });
    } else {
      r += `\n  BLOG: None found\n`;
    }
    
    if (intel.findings.techStack.detected.length > 0) {
      r += `\n  TECH STACK: ${intel.findings.techStack.detected.join(', ')}\n`;
    }
    
    r += `\nANALYSIS:\n`;
    r += `  Stage: ${intel.analysis.companyStage}\n`;
    if (intel.analysis.industryMatch) {
      r += `  Industry Match: ${intel.analysis.industryMatch}\n`;
    }
    if (intel.analysis.growthSignals.length > 0) {
      r += `  Growth: ${intel.analysis.growthSignals.join(', ')}\n`;
    }
    
    if (intel.matches.length > 0) {
      r += `\nEXPERIENCE MATCHES:\n`;
      intel.matches.forEach((m, i) => {
        r += `  ${i+1}. ${m.project} (Score: ${m.score})\n`;
        r += `     ${m.description}\n`;
        r += `     Tech: ${m.techStack}\n`;
        if (m.reasons.length > 0) {
          r += `     Why: ${m.reasons.join(', ')}\n`;
        }
      });
    } else {
      r += `\nEXPERIENCE MATCHES: None strong enough\n`;
    }
    
    if (intel.angles.length > 0) {
      r += `\nPERSONALIZATION ANGLES:\n`;
      intel.angles.forEach((a, i) => {
        r += `  ${i+1}. [${a.priority}] ${a.type}: ${a.content}\n`;
      });
    }
    
    r += `\nMANUAL CHECKLIST:\n`;
    intel.manualChecks.forEach(c => {
      r += `  [ ] ${c}\n`;
    });
    
    r += `\n${'='.repeat(70)}\n`;
    r += `DRAFT EMAIL\n`;
    r += `${'='.repeat(70)}\n\n`;
    r += intel.draft;
    r += `\n\n${'='.repeat(70)}\n`;
    
    return r;
  }

  async reviewMode() {
   console.log('\n' + '='.repeat(60));
    console.log('REVIEW MODE');
    console.log('='.repeat(60) + '\n');
    
    const reports = fs.readdirSync(CONFIG.RESEARCH_DIR)
      .filter(f => f.endsWith('_research.json'))
      .map(f => {
        const data = JSON.parse(fs.readFileSync(path.join(CONFIG.RESEARCH_DIR, f), 'utf8'));
        return { file: f, data };
      })
      .sort((a, b) => b.data.confidence.score - a.data.confidence.score);
    
    if (reports.length === 0) {
      console.log('No reports found. Run research first.\n');
      return;
    }

    const send = reports.filter(r => r.data.recommendation === 'SEND');
    const review = reports.filter(r => r.data.recommendation === 'REVIEW');
    const skip = reports.filter(r => r.data.recommendation === 'SKIP' || r.data.recommendation === 'MANUAL RESEARCH');

    console.log(`Total prospects: ${reports.length}\n`);
    
    console.log(`READY TO SEND (${send.length}):`);
    console.log('High confidence - verify and personalize\n');
    send.forEach((r, i) => {
      const intel = r.data;
      console.log(`  ${i+1}. ${intel.prospect.company} (${intel.confidence.score}/100)`);
      if (intel.findings.news.length > 0) {
        console.log(`     News: ${intel.findings.news[0].title.substring(0, 60)}...`);
      }
      console.log(`     Draft ready in: ${r.file.replace('.json', '.txt')}`);
    });
    
    console.log(`\n\nNEEDS REVIEW (${review.length}):`);
    console.log('Add 10 min research before sending\n');
    review.slice(0, 5).forEach((r, i) => {
      console.log(`  ${i+1}. ${r.data.prospect.company} (${r.data.confidence.score}/100)`);
    });
    
    console.log(`\n\nSKIP/LOW PRIORITY (${skip.length}):`);
    console.log('Insufficient data - skip unless you have extra time\n');
    
  console.log('='.repeat(60))
    console.log('\nNEXT STEPS:');
    console.log('1. Focus on "READY TO SEND" prospects first');
    console.log('2. Read TXT files in: ' + CONFIG.RESEARCH_DIR);
    console.log('3. Verify news links (click to confirm)');
    console.log('4. Check LinkedIn profiles');
    console.log('5. Add personal touch to drafts');
    console.log('6. Send 5-10 quality emails per day\n');
    console.log('Quality beats quantity. Every. Single. Time.\n');
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

  extractDomain(url) {
    try {
      const clean = this.cleanUrl(url);
      if (!clean) return null;
      const match = clean.match(/https?:\/\/(?:www\.)?([^\/]+)/);
      return match ? match[1] : null;
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
  const assistant = new ProductionResearchAssistant();
  const command = process.argv[2];

  if (command === 'research' || command === 'batch') {
    const csvFile = process.argv[3] || path.join(CONFIG.CSV_DIR, 'prospects.csv');
    
    if (!fs.existsSync(csvFile)) {
      console.log(`\nERROR: CSV file not found: ${csvFile}\n`);
      console.log('Usage: node lead_automation.js research <csv-file>\n');
      return;
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('PRODUCTION LEAD RESEARCH ASSISTANT');
    console.log('='.repeat(60) + '\n');
    
    console.log('APIs configured:');
    if (process.env.NEWSAPI_KEY) {
      console.log('  ✓ NewsAPI (primary - most accurate)');
    } else {
      console.log('  ✗ NewsAPI - Add NEWSAPI_KEY to .env');
      console.log('    Get free key: https://newsapi.org/register');
    }
    
    if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_CX_ID) {
      console.log('  ✓ Google Custom Search (fallback)');
    } else {
      console.log('  ✗ Google Custom Search - Add to .env');
    }
    
    if (!process.env.NEWSAPI_KEY && !process.env.GOOGLE_API_KEY) {
      console.log('\n⚠️  WARNING: No news APIs configured!');
      console.log('Tool will work but with limited news discovery.\n');
    } else {
      console.log('');
    }
    
    await assistant.batchResearch(csvFile);
    
  } else if (command === 'review') {
    await assistant.reviewMode();
    
  } else if (command === 'setup') {
    console.log('\n' + '='.repeat(60));
    console.log('SETUP GUIDE');
    console.log('='.repeat(60) + '\n');
    
    console.log('STEP 1: Get NewsAPI Key (RECOMMENDED)\n');
    console.log('1. Visit: https://newsapi.org/register');
    console.log('2. Sign up (free tier: 100 requests/day)');
    console.log('3. Copy your API key');
    console.log('4. Add to .env file:\n');
    console.log('   NEWSAPI_KEY=your_key_here\n');
    
    console.log('STEP 2: Get Google Custom Search (OPTIONAL)\n');
    console.log('1. Visit: https://console.cloud.google.com');
    console.log('2. Create project, enable Custom Search API');
    console.log('3. Create API key');
    console.log('4. Create search engine: https://programmablesearchengine.google.com');
    console.log('5. Add to .env file:\n');
    console.log('   GOOGLE_API_KEY=your_key_here');
    console.log('   GOOGLE_CX_ID=your_search_engine_id\n');
    
    console.log('STEP 3: Prepare CSV\n');
    console.log('Required columns:');
    console.log('  - First Name, Last Name, Title, Email');
    console.log('  - Company Name, Website, Industry');
    console.log('  - # Employees, Keywords');
    console.log('  - Person Linkedin Url\n');
    
    console.log('STEP 4: Run Research\n');
    console.log('  node lead_automation.js research ./csv/prospects.csv\n');
    
    console.log('STEP 5: Review Results\n');
    console.log('  node lead_automation.js review\n');
    
  } else {
    console.log('\n' + '='.repeat(60));
    console.log('PRODUCTION LEAD RESEARCH ASSISTANT');
    console.log('='.repeat(60) + '\n');
    
    console.log('COMMANDS:\n');
    console.log('  node lead_automation.js research <csv>  - Research prospects');
    console.log('  node lead_automation.js review          - Review results');
    console.log('  node lead_automation.js setup           - Setup guide\n');
    
    console.log('KEY FEATURES:\n');
    console.log('  ✓ NewsAPI integration (accurate company news)');
    console.log('  ✓ Google Custom Search fallback');
    console.log('  ✓ Strict relevance filtering (70%+ threshold)');
    console.log('  ✓ Website verification');
    console.log('  ✓ Blog post discovery');
    console.log('  ✓ Tech stack detection');
    console.log('  ✓ Smart experience matching');
    console.log('  ✓ Accurate confidence scoring');
    console.log('  ✓ Quality draft generation\n');
    
    console.log('WHAT TO EXPECT:\n');
    console.log('  - High confidence (70+): 20-30% of prospects');
    console.log('  - Medium (50-69): 30-40% of prospects');
    console.log('  - Low/Skip (<50): 30-50% of prospects\n');
    
    console.log('This is normal! Better to skip bad prospects than send bad emails.\n');
    
    console.log('QUICK START:\n');
    console.log('  1. node lead_automation.js setup');
    console.log('  2. Configure APIs in .env');
    console.log('  3. Prepare CSV file');
    console.log('  4. node lead_automation.js research ./csv/prospects.csv');
    console.log('  5. node lead_automation.js review\n');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = ProductionResearchAssistant;