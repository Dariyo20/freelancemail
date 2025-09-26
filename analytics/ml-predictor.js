const fs = require('fs');
const path = require('path');

class MLPredictor {
    constructor(outputDir) {
        this.outputDir = outputDir;
        this.modelPath = path.join(outputDir, 'ml_model.json');
        this.model = this.loadModel();
    }

    loadModel() {
        try {
            if (fs.existsSync(this.modelPath)) {
                return JSON.parse(fs.readFileSync(this.modelPath, 'utf8'));
            }
        } catch (error) {
            console.log('⚠️ Error loading ML model:', error.message);
        }
        return {
            responseRates: {},
            bestTimes: {},
            subjectLines: {},
            lastUpdated: null
        };
    }

    saveModel() {
        try {
            fs.writeFileSync(this.modelPath, JSON.stringify(this.model, null, 2));
        } catch (error) {
            console.log('⚠️ Error saving ML model:', error.message);
        }
    }

    predictResponseLikelihood(company, analysis) {
        let score = 0.5; // Base score

        // Industry-based scoring
        const industryStats = this.model.responseRates[company['Industry']] || {};
        if (industryStats.responses > 0) {
            score *= (industryStats.responseRate || 0.5);
        }

        // Company size impact
        const employeeCount = parseInt(company['# Employees']) || 0;
        if (employeeCount < 50) score *= 1.2; // Small companies tend to respond better
        else if (employeeCount > 1000) score *= 0.8; // Larger companies are harder to reach

        // Title-based adjustment
        const title = company['Title']?.toLowerCase() || '';
        if (title.includes('ceo') || title.includes('founder')) score *= 1.3;
        if (title.includes('manager')) score *= 1.1;

        // Website analysis impact
        if (analysis.problems.length > 5) score *= 1.2; // More problems = more likely to need help
        if (analysis.analysisSuccess === false) score *= 0.7;

        return Math.min(Math.max(score, 0), 1); // Ensure score is between 0 and 1
    }

    suggestBestSendTime(company) {
        const industry = company['Industry'];
        const industryTimes = this.model.bestTimes[industry];
        
        if (industryTimes && industryTimes.length > 0) {
            // Return the best performing time for this industry
            return industryTimes[0];
        }

        // Default recommendations based on general email statistics
        const hour = new Date().getHours();
        if (hour >= 9 && hour <= 11) return 'morning';
        if (hour >= 14 && hour <= 16) return 'afternoon';
        return 'next-morning'; // Default to next morning if outside business hours
    }

    optimizeSubjectLine(proposal) {
        const industry = proposal.industry;
        const subjectStats = this.model.subjectLines[industry] || {};
        
        // Get the best performing pattern for this industry
        let pattern = 'direct'; // default
        if (subjectStats.bestPattern) {
            pattern = subjectStats.bestPattern;
        }

        // Generate subject based on pattern
        switch (pattern) {
            case 'question':
                return `Want to improve ${proposal.companyName}'s website performance?`;
            case 'specific':
                const problem = proposal.problems[0] || 'website performance';
                return `Fix ${problem} at ${proposal.companyName}`;
            case 'benefit':
                return `Boost ${proposal.companyName}'s online presence`;
            default: // direct
                return `Website Analysis for ${proposal.companyName}`;
        }
    }

    updateModel(emailId, result) {
        // Update response rates
        const company = result.company;
        const industry = company['Industry'];
        
        if (!this.model.responseRates[industry]) {
            this.model.responseRates[industry] = {
                attempts: 0,
                responses: 0,
                responseRate: 0
            };
        }
        
        this.model.responseRates[industry].attempts++;
        if (result.responded) {
            this.model.responseRates[industry].responses++;
        }
        this.model.responseRates[industry].responseRate = 
            this.model.responseRates[industry].responses / 
            this.model.responseRates[industry].attempts;

        // Update best times
        const sendHour = new Date(result.sentAt).getHours();
        if (!this.model.bestTimes[industry]) {
            this.model.bestTimes[industry] = [];
        }
        this.model.bestTimes[industry].push({
            hour: sendHour,
            responded: result.responded,
            openRate: result.opened ? 1 : 0
        });

        // Update subject line performance
        if (!this.model.subjectLines[industry]) {
            this.model.subjectLines[industry] = {
                patterns: {}
            };
        }
        const subjectPattern = this.detectSubjectPattern(result.subject);
        if (!this.model.subjectLines[industry].patterns[subjectPattern]) {
            this.model.subjectLines[industry].patterns[subjectPattern] = {
                uses: 0,
                opens: 0,
                responses: 0
            };
        }
        const pattern = this.model.subjectLines[industry].patterns[subjectPattern];
        pattern.uses++;
        if (result.opened) pattern.opens++;
        if (result.responded) pattern.responses++;

        // Find best performing pattern
        const patterns = this.model.subjectLines[industry].patterns;
        let bestPattern = null;
        let bestRate = 0;
        for (const [pat, stats] of Object.entries(patterns)) {
            const rate = (stats.responses / stats.uses) || 0;
            if (rate > bestRate) {
                bestRate = rate;
                bestPattern = pat;
            }
        }
        this.model.subjectLines[industry].bestPattern = bestPattern;

        this.model.lastUpdated = new Date().toISOString();
        this.saveModel();
    }

    detectSubjectPattern(subject) {
        if (subject.includes('?')) return 'question';
        if (subject.toLowerCase().includes('improve') || 
            subject.toLowerCase().includes('boost')) return 'benefit';
        if (subject.toLowerCase().includes('fix') || 
            subject.toLowerCase().includes('solve')) return 'specific';
        return 'direct';
    }

    getInsights() {
        return {
            model: this.model,
            recommendations: {
                bestTimes: Object.entries(this.model.bestTimes)
                    .map(([industry, times]) => ({
                        industry,
                        bestHour: this.calculateBestHour(times)
                    })),
                bestPatterns: Object.entries(this.model.subjectLines)
                    .map(([industry, data]) => ({
                        industry,
                        bestPattern: data.bestPattern
                    }))
            }
        };
    }

    calculateBestHour(times) {
        if (!times || times.length === 0) return null;
        
        const hourStats = {};
        times.forEach(time => {
            if (!hourStats[time.hour]) {
                hourStats[time.hour] = { total: 0, responses: 0 };
            }
            hourStats[time.hour].total++;
            if (time.responded) hourStats[time.hour].responses++;
        });

        let bestHour = null;
        let bestRate = 0;
        for (const [hour, stats] of Object.entries(hourStats)) {
            const rate = stats.responses / stats.total;
            if (rate > bestRate) {
                bestRate = rate;
                bestHour = parseInt(hour);
            }
        }

        return bestHour;
    }
}

module.exports = MLPredictor;