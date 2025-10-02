// test-gmail.js
const nodemailer = require('nodemailer');
require('dotenv').config();

async function testGmail() {
  console.log('Testing Gmail connection...');
  console.log('Email:', process.env.EMAIL_USER);
  console.log('Password length:', process.env.EMAIL_PASSWORD?.length);
  
  const configs = [
    { port: 587, secure: false, name: 'Port 587 (recommended)' },
    { port: 465, secure: true, name: 'Port 465' },
    { service: 'gmail', name: 'Service config' }
  ];
  
  for (const config of configs) {
    try {
      console.log(`\nTrying ${config.name}...`);
      
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        ...config,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      });
      
      await transporter.verify();
      console.log(`✅ ${config.name} works!`);
      return;
      
    } catch (error) {
      console.log(`❌ ${config.name} failed: ${error.message}`);
    }
  }
  
  console.log('\n🚫 All configurations failed');
  console.log('This could be:');
  console.log('- Network/firewall blocking SMTP ports');
  console.log('- Incorrect app password');
  console.log('- ISP restrictions');
}

testGmail();