require('dotenv').config();
const EmailTracker = require('./analytics/email-tracker');
const Dashboard = require('./analytics/dashboard');
const MLPredictor = require('./analytics/ml-predictor');

// Initialize analytics features
const emailTracker = new EmailTracker(CONFIG.OUTPUT_DIR);
const dashboard = new Dashboard(CONFIG);
const mlPredictor = new MLPredictor(CONFIG.OUTPUT_DIR);

// Start dashboard and tracking
emailTracker.startTrackingServer();
dashboard.start(3001);

// Clean up on exit
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down analytics...');
    emailTracker.stop();
    dashboard.stop();
    process.exit();
});