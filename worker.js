const automationWorker = require('./services/automationWorker');

// Main entry point for the automation worker
(async () => {
  try {
    await automationWorker.initialize();
    await automationWorker.start();
  } catch (error) {
    console.error('Worker failed:', error.message);
    process.exit(1);
  }
})();
