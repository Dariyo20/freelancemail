const cron = require('node-cron');
const connectDB = require('../config/database');
const emailService = require('./emailService');
const replyDetectionService = require('./replyDetectionService');
const leadImporter = require('./leadImporter');
const templateService = require('./templateService');
require('dotenv').config();

// Country groups for time-zone aware sending from Nigeria (WAT = UTC+1).
// Slot times are picked so leads land in the recipient's 8-10am local window.
const US_CA = ['United States', 'Canada'];
const UK_EU = [
  'United Kingdom', 'France', 'Germany', 'Poland', 'Croatia',
  'Portugal', 'Austria', 'Sweden', 'Italy', 'Ireland', 'Spain'
];

class AutomationWorker {
  constructor() {
    this.isRunning = false;
    this.tasks = [];
  }

  /**
   * Initialize the automation worker
   */
  async initialize() {
    try {
      console.log('\n\ud83e\udd16 Initializing Automation Worker...\n');

      // Connect to database
      await connectDB();

      // Seed templates if needed
      await templateService.seedTemplates();

      // Initialize services
      await emailService.initialize();
      await replyDetectionService.initialize();

      console.log('\n\u2713 Automation Worker Ready\n');

    } catch (error) {
      console.error('Failed to initialize worker:', error.message);
      throw error;
    }
  }

  /**
   * Start all scheduled tasks
   *
   * Country-aware send schedule (WAT = UTC+1, Mon-Thu only):
   *   07:00 WAT  UK + W.Europe  (= 7am GMT / 8am CET)  - first-coffee window
   *   14:00 WAT  US + Canada    (= 8am EST)            - primary morning wave
   *   15:00 WAT  US + Canada    (= 9am EST)            - post-standup re-check
   *
   * Each slot filters leads by country so we never hit a US recipient at
   * 2am EST or a UK recipient at 3pm GMT.
   * 10 emails per slot = 30/day max across both segments.
   */
  async start() {
    try {
      this.isRunning = true;

      console.log('\ud83d\ude80 Starting Automation Worker...\n');

      // Slot 1: UK + Western Europe, 7am WAT Mon-Thu
      const ukEuTask = cron.schedule('0 7 * * 1-4', async () => {
        console.log('\n\u23f0 Running UK/EU email slot...');
        try {
          await emailService.processQueue(10, UK_EU);
        } catch (error) {
          console.error('UK/EU slot error:', error.message);
        }
      }, { timezone: 'Africa/Lagos' });
      this.tasks.push({ name: 'Email Queue UK/EU', task: ukEuTask });
      console.log('\u2713 UK/EU queue scheduled (7am WAT Mon-Thu = 7am GMT / 8am CET)');

      // Slot 2: US + Canada primary wave, 2pm WAT Mon-Thu
      const usPrimaryTask = cron.schedule('0 14 * * 1-4', async () => {
        console.log('\n\u23f0 Running US/CA primary email slot...');
        try {
          await emailService.processQueue(10, US_CA);
        } catch (error) {
          console.error('US/CA primary slot error:', error.message);
        }
      }, { timezone: 'Africa/Lagos' });
      this.tasks.push({ name: 'Email Queue US/CA primary', task: usPrimaryTask });
      console.log('\u2713 US/CA primary queue scheduled (2pm WAT Mon-Thu = 8am EST)');

      // Slot 3: US + Canada second wave, 3pm WAT Mon-Thu
      const usSecondaryTask = cron.schedule('0 15 * * 1-4', async () => {
        console.log('\n\u23f0 Running US/CA second-wave email slot...');
        try {
          await emailService.processQueue(10, US_CA);
        } catch (error) {
          console.error('US/CA second-wave slot error:', error.message);
        }
      }, { timezone: 'Africa/Lagos' });
      this.tasks.push({ name: 'Email Queue US/CA second wave', task: usSecondaryTask });
      console.log('\u2713 US/CA second-wave queue scheduled (3pm WAT Mon-Thu = 9am EST)');

      // Task 2: Check for replies (every hour during extended business hours)
      // Runs every hour from 9am to 10pm WAT (Mon-Fri) to catch US afternoon replies
      const replyTask = cron.schedule('0 9-22 * * 1-5', async () => {
        console.log('\n\u23f0 Running reply detection...');
        try {
          await replyDetectionService.checkForReplies();
        } catch (error) {
          console.error('Reply detection error:', error.message);
        }
      }, { timezone: 'Africa/Lagos' });

      this.tasks.push({ name: 'Reply Detection', task: replyTask });
      console.log('\u2713 Reply Detection scheduled (every hour 9am-10pm WAT Mon-Fri)');

      // Task 3: Import new CSVs (every day at 8am)
      const importTask = cron.schedule('0 8 * * 1-5', async () => {
        console.log('\n\u23f0 Running CSV import...');
        try {
          await leadImporter.importAllCSVs();
        } catch (error) {
          console.error('Import task error:', error.message);
        }
      }, { timezone: 'Africa/Lagos' });

      this.tasks.push({ name: 'CSV Import', task: importTask });
      console.log('\u2713 CSV Import scheduled (8am Mon-Fri)');

      // Task 4: Database cleanup (every Sunday at 2am)
      const cleanupTask = cron.schedule('0 2 * * 0', async () => {
        console.log('\n\u23f0 Running database cleanup...');
        try {
          await leadImporter.cleanDatabase();
        } catch (error) {
          console.error('Cleanup task error:', error.message);
        }
      }, { timezone: 'Africa/Lagos' });

      this.tasks.push({ name: 'Database Cleanup', task: cleanupTask });
      console.log('\u2713 Database Cleanup scheduled (2am Sundays)');

      console.log('\n\u2705 All automation tasks started!\n');
      console.log('Press Ctrl+C to stop the worker.\n');

    } catch (error) {
      console.error('Failed to start worker:', error.message);
      throw error;
    }
  }

  /**
   * Stop all scheduled tasks
   */
  stop() {
    console.log('\n\u23f9\ufe0f  Stopping Automation Worker...');

    this.tasks.forEach(({ name, task }) => {
      task.stop();
      console.log(`\u2713 Stopped: ${name}`);
    });

    this.isRunning = false;
    console.log('\n\u2713 Automation Worker stopped\n');
  }

  /**
   * Run a manual cycle (for testing)
   */
  async runManualCycle() {
    try {
      console.log('\n\ud83d\udd04 Running manual automation cycle...\n');

      // Import CSVs
      console.log('1\ufe0f\u20e3  Importing CSVs...');
      await leadImporter.importAllCSVs();

      // Process emails
      console.log('\n2\ufe0f\u20e3  Processing email queue...');
      await emailService.processQueue(20);

      // Check replies
      console.log('\n3\ufe0f\u20e3  Checking for replies...');
      await replyDetectionService.checkForReplies();

      console.log('\n\u2705 Manual cycle completed!\n');

    } catch (error) {
      console.error('Manual cycle error:', error.message);
      throw error;
    }
  }

  /**
   * Get worker status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeTasks: this.tasks.length,
      tasks: this.tasks.map(t => t.name)
    };
  }
}

// Create singleton instance
const worker = new AutomationWorker();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nReceived SIGINT signal');
  worker.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\nReceived SIGTERM signal');
  worker.stop();
  process.exit(0);
});

module.exports = worker;
