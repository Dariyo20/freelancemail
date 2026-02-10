const cron = require('node-cron');
const connectDB = require('../config/database');
const emailService = require('./emailService');
const replyDetectionService = require('./replyDetectionService');
const leadImporter = require('./leadImporter');
const templateService = require('./templateService');
require('dotenv').config();

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
      console.log('\n🤖 Initializing Automation Worker...\n');
      
      // Connect to database
      await connectDB();
      
      // Seed templates if needed
      await templateService.seedTemplates();
      
      // Initialize services
      await emailService.initialize();
      await replyDetectionService.initialize();
      
      console.log('\n✓ Automation Worker Ready\n');
      
    } catch (error) {
      console.error('Failed to initialize worker:', error.message);
      throw error;
    }
  }
  
  /**
   * Start all scheduled tasks
   */
  async start() {
    try {
      this.isRunning = true;
      
      console.log('🚀 Starting Automation Worker...\n');
      
      // Task 1: Process email queue (optimized timing for better engagement)
      // Runs at: 9am, 10:30am, 12pm, 2pm, 4pm (Mon-Fri)
      // Avoids 5pm dead zone and post-lunch slump
      const emailTask = cron.schedule('0,30 9,10,12,14,16 * * 1-5', async () => {
        const hour = new Date().getHours();
        const min = new Date().getMinutes();
        // Only run at: 9:00, 10:30, 12:00, 14:00, 16:00
        if ((hour === 9 && min === 0) || (hour === 10 && min === 30) || 
            (hour === 12 && min === 0) || (hour === 14 && min === 0) || 
            (hour === 16 && min === 0)) {
          console.log('\n⏰ Running scheduled email task...');
          try {
            await emailService.processQueue(20);
          } catch (error) {
            console.error('Email task error:', error.message);
          }
        }
      });
      
      this.tasks.push({ name: 'Email Queue', task: emailTask });
      console.log('✓ Email Queue scheduled (9am, 10:30am, 12pm, 2pm, 4pm Mon-Fri)');
      
      // Task 2: Check for replies (every hour during business hours)
      // Runs every hour from 9am to 6pm (Mon-Fri)
      const replyTask = cron.schedule('0 9-18 * * 1-5', async () => {
        console.log('\n⏰ Running reply detection...');
        try {
          await replyDetectionService.checkForReplies();
        } catch (error) {
          console.error('Reply detection error:', error.message);
        }
      });
      
      this.tasks.push({ name: 'Reply Detection', task: replyTask });
      console.log('✓ Reply Detection scheduled (every hour 9am-6pm Mon-Fri)');
      
      // Task 3: Import new CSVs (every day at 8am)
      const importTask = cron.schedule('0 8 * * 1-5', async () => {
        console.log('\n⏰ Running CSV import...');
        try {
          await leadImporter.importAllCSVs();
        } catch (error) {
          console.error('Import task error:', error.message);
        }
      });
      
      this.tasks.push({ name: 'CSV Import', task: importTask });
      console.log('✓ CSV Import scheduled (8am Mon-Fri)');
      
      // Task 4: Database cleanup (every Sunday at 2am)
      const cleanupTask = cron.schedule('0 2 * * 0', async () => {
        console.log('\n⏰ Running database cleanup...');
        try {
          await leadImporter.cleanDatabase();
        } catch (error) {
          console.error('Cleanup task error:', error.message);
        }
      });
      
      this.tasks.push({ name: 'Database Cleanup', task: cleanupTask });
      console.log('✓ Database Cleanup scheduled (2am Sundays)');
      
      console.log('\n✅ All automation tasks started!\n');
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
    console.log('\n⏹️  Stopping Automation Worker...');
    
    this.tasks.forEach(({ name, task }) => {
      task.stop();
      console.log(`✓ Stopped: ${name}`);
    });
    
    this.isRunning = false;
    console.log('\n✓ Automation Worker stopped\n');
  }
  
  /**
   * Run a manual cycle (for testing)
   */
  async runManualCycle() {
    try {
      console.log('\n🔄 Running manual automation cycle...\n');
      
      // Import CSVs
      console.log('1️⃣  Importing CSVs...');
      await leadImporter.importAllCSVs();
      
      // Process emails
      console.log('\n2️⃣  Processing email queue...');
      await emailService.processQueue(20);
      
      // Check replies
      console.log('\n3️⃣  Checking for replies...');
      await replyDetectionService.checkForReplies();
      
      console.log('\n✅ Manual cycle completed!\n');
      
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
