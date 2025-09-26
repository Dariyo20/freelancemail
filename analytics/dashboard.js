const express = require('express');
const path = require('path');
const fs = require('fs');

class Dashboard {
    constructor(config) {
        this.config = config;
        this.app = express();
        this.setupRoutes();
    }

    setupRoutes() {
        this.app.get('/', (req, res) => {
            res.send(this.generateDashboardHtml());
        });

        this.app.get('/api/stats', (req, res) => {
            res.json(this.getStats());
        });

        this.app.get('/api/analytics', (req, res) => {
            const analyticsPath = path.join(this.config.OUTPUT_DIR, 'email_analytics.json');
            if (fs.existsSync(analyticsPath)) {
                res.json(JSON.parse(fs.readFileSync(analyticsPath, 'utf8')));
            } else {
                res.json({ opens: {}, clicks: {}, responses: {} });
            }
        });
    }

    getStats() {
        const stats = {
            processedCompanies: 0,
            emailsSent: 0,
            openRate: 0,
            clickRate: 0,
            responseRate: 0
        };

        try {
            // Read campaign summary
            const summaryPath = path.join(this.config.OUTPUT_DIR, 'campaign_summary.json');
            if (fs.existsSync(summaryPath)) {
                const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
                stats.processedCompanies = summary.totalProcessed || 0;
                stats.emailsSent = summary.emailsThisSession || 0;
            }

            // Read analytics
            const analyticsPath = path.join(this.config.OUTPUT_DIR, 'email_analytics.json');
            if (fs.existsSync(analyticsPath)) {
                const analytics = JSON.parse(fs.readFileSync(analyticsPath, 'utf8'));
                const totalEmails = Object.keys(analytics.opens).length;
                if (totalEmails > 0) {
                    const opened = Object.values(analytics.opens).filter(opens => opens.length > 0).length;
                    const clicked = Object.values(analytics.clicks).filter(clicks => clicks.length > 0).length;
                    const responded = Object.values(analytics.responses).filter(responses => responses.length > 0).length;
                    
                    stats.openRate = (opened / totalEmails * 100).toFixed(1);
                    stats.clickRate = (clicked / totalEmails * 100).toFixed(1);
                    stats.responseRate = (responded / totalEmails * 100).toFixed(1);
                }
            }
        } catch (error) {
            console.error('Error getting stats:', error);
        }

        return stats;
    }

    generateDashboardHtml() {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Lead Automation Dashboard</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
                .container { max-width: 1200px; margin: 0 auto; }
                .card { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
                .stat-card { text-align: center; padding: 20px; background: #fff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                .stat-value { font-size: 24px; font-weight: bold; color: #2196F3; }
                .stat-label { color: #666; margin-top: 5px; }
                h1 { color: #333; margin-bottom: 30px; }
                .chart { height: 300px; margin-top: 20px; }
            </style>
            <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        </head>
        <body>
            <div class="container">
                <h1>Lead Automation Dashboard</h1>
                <div class="stats" id="statsContainer">
                    <!-- Stats will be populated by JavaScript -->
                </div>
                <div class="card">
                    <h2>Email Performance</h2>
                    <canvas id="emailChart"></canvas>
                </div>
            </div>
            <script>
                function updateStats() {
                    fetch('/api/stats')
                        .then(res => res.json())
                        .then(stats => {
                            const container = document.getElementById('statsContainer');
                            container.innerHTML = Object.entries(stats)
                                .map(([key, value]) => \`
                                    <div class="stat-card">
                                        <div class="stat-value">\${value}</div>
                                        <div class="stat-label">\${key.replace(/([A-Z])/g, ' $1').toLowerCase()}</div>
                                    </div>
                                \`).join('');
                        });
                }

                function updateChart() {
                    fetch('/api/analytics')
                        .then(res => res.json())
                        .then(analytics => {
                            const ctx = document.getElementById('emailChart').getContext('2d');
                            new Chart(ctx, {
                                type: 'line',
                                data: {
                                    labels: Object.keys(analytics.opens),
                                    datasets: [{
                                        label: 'Opens',
                                        data: Object.values(analytics.opens).map(arr => arr.length),
                                        borderColor: '#2196F3',
                                        fill: false
                                    }, {
                                        label: 'Clicks',
                                        data: Object.values(analytics.clicks).map(arr => arr.length),
                                        borderColor: '#4CAF50',
                                        fill: false
                                    }, {
                                        label: 'Responses',
                                        data: Object.values(analytics.responses).map(arr => arr.length),
                                        borderColor: '#FFC107',
                                        fill: false
                                    }]
                                },
                                options: {
                                    responsive: true,
                                    maintainAspectRatio: false
                                }
                            });
                        });
                }

                updateStats();
                updateChart();
                setInterval(updateStats, 30000);
                setInterval(updateChart, 60000);
            </script>
        </body>
        </html>`;
    }

    start(port = 3001) {
        this.server = this.app.listen(port, () => {
            console.log(`📊 Dashboard running on http://localhost:${port}`);
        });
    }

    stop() {
        if (this.server) {
            this.server.close();
            this.server = null;
        }
    }
}

module.exports = Dashboard;