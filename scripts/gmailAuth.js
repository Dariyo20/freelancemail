const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const readline = require('readline');

// Gmail OAuth2 Authentication Script
// Run this once to generate gmail_token.json

const SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];
const TOKEN_PATH = path.join(__dirname, '../gmail_token.json');
const CREDENTIALS_PATH = path.join(__dirname, '../gmail_credentials.json');

async function authorize() {
  try {
    // Load credentials
    if (!fs.existsSync(CREDENTIALS_PATH)) {
      console.error('✗ gmail_credentials.json not found!');
      console.log('\nPlease:');
      console.log('1. Go to: https://console.cloud.google.com/');
      console.log('2. Enable Gmail API');
      console.log('3. Create OAuth 2.0 credentials (Desktop app)');
      console.log('4. Download JSON and save as gmail_credentials.json in project root\n');
      process.exit(1);
    }

    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
    const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;
    
    const oauth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0]
    );

    // Check if we already have a token
    if (fs.existsSync(TOKEN_PATH)) {
      console.log('✓ Token already exists at', TOKEN_PATH);
      console.log('\nDelete gmail_token.json and re-run this script to get a new token.\n');
      process.exit(0);
    }

    // Get new token
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });

    console.log('\n🔐 Gmail OAuth2 Authentication\n');
    console.log('1. Open this URL in your browser:\n');
    console.log(authUrl);
    console.log('\n2. Sign in to Google');
    console.log('3. Grant permissions');
    console.log('4. Copy the authorization code\n');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question('Enter the authorization code: ', async (code) => {
      rl.close();

      try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Save token
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
        console.log('\n✅ Token saved to', TOKEN_PATH);
        console.log('\n✓ Gmail API authentication successful!');
        console.log('\nYou can now use reply detection features.\n');

      } catch (error) {
        console.error('\n✗ Error retrieving access token:', error.message);
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

authorize();
