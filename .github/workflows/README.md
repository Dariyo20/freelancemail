# GitHub Actions Automation Setup

## Overview
This project uses GitHub Actions to automate lead management tasks according to Nigeria time (WAT = UTC+1).

## Workflows

### 1. Check Replies (`lead-automation.yml`)
**Schedule**: Every 2 hours from 6 AM to 8 PM WAT (weekdays)
- Automatically checks for email replies
- Updates lead status when replies are detected
- Runs at: 6 AM, 8 AM, 10 AM, 12 PM, 2 PM, 4 PM, 6 PM, 8 PM WAT

### 2. Daily Email Campaign (`daily-emails.yml`)
**Schedule**: 9 AM WAT, Monday to Friday
- Sends scheduled outreach emails
- Processes leads marked for outreach

### 3. Manual Triggers
Both workflows can be triggered manually from GitHub:
1. Go to your repository
2. Click on "Actions" tab
3. Select the workflow
4. Click "Run workflow"
5. Choose task (for lead-automation.yml)

## Required GitHub Secrets

You need to set up these secrets in your GitHub repository:

1. Go to: Settings → Secrets and variables → Actions → New repository secret

Add the following secrets:

### `MONGODB_URI`
Your MongoDB connection string
```
mongodb+srv://username:password@cluster.mongodb.net/dbname
```

### `GMAIL_CREDENTIALS`
Content of your `gmail_credentials.json` file (paste the entire JSON)

### `GMAIL_TOKEN`
Content of your `gmail_token.json` file (paste the entire JSON)

### `PERPLEXITY_API_KEY`
Your Perplexity API key

### `FIRECRAWL_API_KEY`
Your Firecrawl API key

## Nigeria Time (WAT) Reference

Nigeria uses West Africa Time (WAT) = UTC+1

| Nigeria Time | UTC Time | Cron Expression |
|--------------|----------|-----------------|
| 6:00 AM      | 5:00 AM  | `0 5 * * *`    |
| 9:00 AM      | 8:00 AM  | `0 8 * * *`    |
| 12:00 PM     | 11:00 AM | `0 11 * * *`   |
| 6:00 PM      | 5:00 PM  | `0 17 * * *`   |

## Customizing Schedules

To change when tasks run, edit the `cron` expressions in the workflow files:

```yaml
schedule:
  - cron: '0 8 * * 1-5'  # Minute Hour Day Month DayOfWeek
```

### Cron Syntax
- `0` = Minute (0-59)
- `8` = Hour in UTC (0-23)
- `*` = Every day
- `*` = Every month
- `1-5` = Monday to Friday (0=Sunday, 6=Saturday)

### Examples:
```yaml
# Every day at 9 AM WAT (8 AM UTC)
- cron: '0 8 * * *'

# Weekdays at 2 PM WAT (1 PM UTC)
- cron: '0 13 * * 1-5'

# Every 3 hours
- cron: '0 */3 * * *'

# Multiple times per day
- cron: '0 8,14,20 * * *'  # 9 AM, 3 PM, 9 PM WAT
```

## Testing

Test the workflows manually before relying on the schedule:
1. Go to Actions tab
2. Select a workflow
3. Click "Run workflow"
4. Check the logs for any errors

## Monitoring

- View workflow runs in the "Actions" tab of your repository
- Get email notifications for failed workflows (configure in GitHub settings)
- Check logs for detailed execution information

## Important Notes

1. **Free tier limits**: GitHub Actions provides 2,000 minutes/month for free on public repos, 2,000 minutes/month for private repos
2. **Token updates**: The workflows automatically commit updated Gmail tokens back to the repository
3. **Rate limits**: Be mindful of Gmail API rate limits (don't schedule too frequently)
4. **Timezone**: All schedules are in UTC, but documented in WAT for convenience

## Troubleshooting

### Workflow not running?
- Check if GitHub Actions is enabled for your repository
- Verify the cron syntax is correct
- Ensure secrets are properly set

### Authentication errors?
- Verify all secrets are correctly set
- Check that Gmail credentials haven't expired
- Regenerate tokens if needed

### Missing dependencies?
- Ensure `package.json` is committed to the repository
- Check that all required files are in the repo

## Disabling Automation

To temporarily disable a workflow:
1. Go to Actions tab
2. Click on the workflow
3. Click "..." menu
4. Select "Disable workflow"
