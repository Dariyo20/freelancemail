const express = require('express');
const path = require('path');
const fs = require('fs');

class EmailTracker {
    constructor(outputDir) {
        this.outputDir = outputDir;
        this.trackerServer = null;
        this.analyticsPath = path.join(outputDir, 'email_analytics.json');
        this.analytics = this.loadAnalytics();
    }

    loadAnalytics() {
        try {
            if (fs.existsSync(this.analyticsPath)) {
                return JSON.parse(fs.readFileSync(this.analyticsPath, 'utf8'));
            }
        } catch (error) {
            console.log('⚠️ Error loading analytics:', error.message);
        }
        return {
            opens: {},
            clicks: {},
            responses: {}
        };
    }

    saveAnalytics() {
        try {
            fs.writeFileSync(this.analyticsPath, JSON.stringify(this.analytics, null, 2));
        } catch (error) {
            console.log('⚠️ Error saving analytics:', error.message);
        }
    }

    generateTrackingPixel(emailId) {
        return `<img src="http://localhost:3000/track/open/${emailId}" width="1" height="1" style="display:none">`;
    }

    generateTrackingLink(originalUrl, emailId) {
        return `http://localhost:3000/track/click/${emailId}?url=${encodeURIComponent(originalUrl)}`;
    }

    startTrackingServer() {
        if (this.trackerServer) return;

        const app = express();

        app.get('/track/open/:emailId', (req, res) => {
            const emailId = req.params.emailId;
            if (!this.analytics.opens[emailId]) {
                this.analytics.opens[emailId] = [];
            }
            this.analytics.opens[emailId].push(new Date().toISOString());
            this.saveAnalytics();
            
            // Return a 1x1 transparent pixel
            const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
            res.setHeader('Content-Type', 'image/gif');
            res.send(pixel);
        });

        app.get('/track/click/:emailId', (req, res) => {
            const emailId = req.params.emailId;
            const targetUrl = req.query.url;
            
            if (!this.analytics.clicks[emailId]) {
                this.analytics.clicks[emailId] = [];
            }
            this.analytics.clicks[emailId].push({
                timestamp: new Date().toISOString(),
                url: targetUrl
            });
            this.saveAnalytics();
            
            res.redirect(targetUrl);
        });

        this.trackerServer = app.listen(3000, () => {
            console.log('📊 Email tracking server running on port 3000');
        });
    }

    getAnalytics(emailId) {
        return {
            opens: this.analytics.opens[emailId] || [],
            clicks: this.analytics.clicks[emailId] || [],
            responses: this.analytics.responses[emailId] || []
        };
    }

    getAllAnalytics() {
        return this.analytics;
    }

    recordResponse(emailId, type = 'reply') {
        if (!this.analytics.responses[emailId]) {
            this.analytics.responses[emailId] = [];
        }
        this.analytics.responses[emailId].push({
            timestamp: new Date().toISOString(),
            type: type
        });
        this.saveAnalytics();
    }

    stop() {
        if (this.trackerServer) {
            this.trackerServer.close();
            this.trackerServer = null;
        }
    }
}

module.exports = EmailTracker;