const Dashboard = require('./analytics/dashboard');
const CONFIG = {
    OUTPUT_DIR: './output',
    REPORTS_DIR: './reports',
    PROCESSED_CSV_DIR: './processed'
};

console.log('🚀 Starting standalone dashboard...');

// Initialize and start dashboard
const dashboard = new Dashboard(CONFIG);
dashboard.start(3001);

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down dashboard...');
    dashboard.stop();
    process.exit();
});

console.log('📊 Dashboard is running at http://localhost:3001');
console.log('Press Ctrl+C to stop');