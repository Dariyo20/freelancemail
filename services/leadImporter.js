const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const Lead = require('../models/Lead');

class LeadImporter {
  constructor() {
    this.csvDir = path.join(__dirname, '../csv');
    this.processedDir = path.join(__dirname, '../processed');
    
    // Ensure directories exist
    if (!fs.existsSync(this.processedDir)) {
      fs.mkdirSync(this.processedDir, { recursive: true });
    }
  }
  
  /**
   * Import leads from CSV file
   * @param {String} filename - CSV filename in csv/ directory
   * @param {String} source - Lead source (default: 'apollo_csv')
   * @returns {Object} Import statistics
   */
  async importCSV(filename, source = 'apollo_csv') {
    try {
      const filepath = path.join(this.csvDir, filename);
      
      if (!fs.existsSync(filepath)) {
        throw new Error(`CSV file not found: ${filename}`);
      }
      
      console.log(`\n📥 Importing leads from ${filename}...`);
      
      const stats = {
        total: 0,
        imported: 0,
        duplicates: 0,
        errors: 0,
        skipped: 0
      };
      
      const leads = [];
      
      // Read CSV
      await new Promise((resolve, reject) => {
        fs.createReadStream(filepath)
          .pipe(csv())
          .on('data', (row) => {
            stats.total++;
            
            try {
              const lead = this.parseCSVRow(row, source);
              if (lead) {
                leads.push(lead);
              } else {
                stats.skipped++;
              }
            } catch (error) {
              console.error(`Error parsing row ${stats.total}:`, error.message);
              stats.errors++;
            }
          })
          .on('end', resolve)
          .on('error', reject);
      });
      
      console.log(`✓ Parsed ${leads.length} valid leads from CSV`);
      
      // Import to database with deduplication
      for (const leadData of leads) {
        try {
          await this.importLead(leadData, stats);
        } catch (error) {
          console.error(`Error importing ${leadData.email}:`, error.message);
          stats.errors++;
        }
      }
      
      // Move CSV to processed folder
      const processedPath = path.join(
        this.processedDir,
        `${new Date().toISOString().split('T')[0]}_${filename}`
      );
      
      fs.renameSync(filepath, processedPath);
      console.log(`✓ Moved CSV to processed folder`);
      
      // Print stats
      console.log('\n📊 Import Statistics:');
      console.log(`   Total rows: ${stats.total}`);
      console.log(`   Imported: ${stats.imported}`);
      console.log(`   Duplicates: ${stats.duplicates}`);
      console.log(`   Skipped: ${stats.skipped}`);
      console.log(`   Errors: ${stats.errors}\n`);
      
      return stats;
      
    } catch (error) {
      console.error('CSV import error:', error.message);
      throw error;
    }
  }
  
  /**
   * Parse a CSV row into lead data
   * Supports Apollo.io CSV format
   */
  parseCSVRow(row, source) {
    // Extract email (required)
    const email = row['Email'] || row['email'] || row['Email Address'];
    
    if (!email || !this.isValidEmail(email)) {
      return null; // Skip invalid emails
    }
    
    // Extract other fields (Apollo format)
    const first_name = row['First Name'] || row['first_name'] || row['FirstName'] || '';
    const last_name = row['Last Name'] || row['last_name'] || row['LastName'] || '';
    const company = row['Company Name'] || row['company'] || row['Organization'] || 'Unknown';
    const industry = row['Industry'] || row['industry'] || '';
    const title = row['Title'] || row['title'] || row['Job Title'] || '';
    
    // Metadata
    const metadata = {
      phone: row['Phone'] || row['phone'] || '',
      linkedin_url: row['LinkedIn URL'] || row['linkedin'] || '',
      website: row['Website'] || row['website'] || row['Company Website'] || '',
      employee_count: row['# Employees'] || row['employees'] || '',
      location: row['Location'] || row['location'] || row['City'] || ''
    };
    
    return {
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      email: email.toLowerCase().trim(),
      company: company.trim(),
      industry: industry.trim(),
      title: title.trim(),
      source,
      metadata,
      status: 'new',
      followup_stage: 0,
      reply_detected: false
    };
  }
  
  /**
   * Import a single lead with deduplication
   */
  async importLead(leadData, stats) {
    try {
      // Check for duplicate by email
      const existing = await Lead.findOne({ email: leadData.email });
      
      if (existing) {
        stats.duplicates++;
        
        // Don't log blacklisted/replied leads as duplicates
        if (existing.reply_detected || existing.status === 'replied') {
          console.log(`🚫 Blacklisted (already replied): ${leadData.email}`);
        } else {
          console.log(`⊘ Duplicate: ${leadData.email}`);
        }
        return null;
      }
      
      // Create new lead
      const lead = await Lead.create(leadData);
      stats.imported++;
      
      console.log(`✓ Imported: ${leadData.email} - ${leadData.company}`);
      
      return lead;
      
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Import all CSVs in csv/ directory
   */
  async importAllCSVs() {
    try {
      const files = fs.readdirSync(this.csvDir)
        .filter(f => f.endsWith('.csv'));
      
      if (files.length === 0) {
        console.log('No CSV files found in csv/ directory');
        return;
      }
      
      console.log(`\n📂 Found ${files.length} CSV file(s)`);
      
      const totalStats = {
        files: 0,
        total: 0,
        imported: 0,
        duplicates: 0,
        errors: 0,
        skipped: 0
      };
      
      for (const file of files) {
        try {
          const stats = await this.importCSV(file);
          totalStats.files++;
          totalStats.total += stats.total;
          totalStats.imported += stats.imported;
          totalStats.duplicates += stats.duplicates;
          totalStats.errors += stats.errors;
          totalStats.skipped += stats.skipped;
        } catch (error) {
          console.error(`Failed to import ${file}:`, error.message);
        }
      }
      
      console.log('\n📊 Total Import Summary:');
      console.log(`   Files processed: ${totalStats.files}`);
      console.log(`   Total rows: ${totalStats.total}`);
      console.log(`   Imported: ${totalStats.imported}`);
      console.log(`   Duplicates: ${totalStats.duplicates}`);
      console.log(`   Skipped: ${totalStats.skipped}`);
      console.log(`   Errors: ${totalStats.errors}\n`);
      
      return totalStats;
      
    } catch (error) {
      console.error('Error importing CSVs:', error.message);
      throw error;
    }
  }
  
  /**
   * Validate email format
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  /**
   * Clean and deduplicate existing leads in database
   */
  async cleanDatabase() {
    try {
      console.log('\n🧹 Cleaning database...');
      
      // Find duplicate emails
      const duplicates = await Lead.aggregate([
        {
          $group: {
            _id: '$email',
            count: { $sum: 1 },
            ids: { $push: '$_id' }
          }
        },
        {
          $match: { count: { $gt: 1 } }
        }
      ]);
      
      console.log(`Found ${duplicates.length} duplicate emails`);
      
      // Keep first, delete rest
      for (const dup of duplicates) {
        const [keep, ...remove] = dup.ids;
        await Lead.deleteMany({ _id: { $in: remove } });
        console.log(`✓ Removed ${remove.length} duplicate(s) for ${dup._id}`);
      }
      
      console.log('✓ Database cleaned\n');
      
    } catch (error) {
      console.error('Error cleaning database:', error.message);
      throw error;
    }
  }
  
  /**
   * Get import statistics
   */
  async getStats() {
    try {
      const total = await Lead.countDocuments();
      const byStatus = await Lead.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);
      const bySource = await Lead.aggregate([
        { $group: { _id: '$source', count: { $sum: 1 } } }
      ]);
      
      return {
        total,
        byStatus,
        bySource
      };
    } catch (error) {
      console.error('Error getting stats:', error.message);
      throw error;
    }
  }
}

module.exports = new LeadImporter();
