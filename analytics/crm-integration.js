const axios = require('axios');

class CRMIntegration {
    constructor(config = {}) {
        this.config = config;
        this.providers = {
            hubspot: this.hubspotIntegration.bind(this),
            salesforce: this.salesforceIntegration.bind(this),
            pipedrive: this.pipedriveIntegration.bind(this)
        };
    }

    async syncContact(provider, contactData) {
        if (!this.providers[provider]) {
            throw new Error(`Unsupported CRM provider: ${provider}`);
        }

        try {
            return await this.providers[provider](contactData);
        } catch (error) {
            console.error(`CRM sync error (${provider}):`, error.message);
            return null;
        }
    }

    async hubspotIntegration(contactData) {
        if (!this.config.hubspotApiKey) {
            console.log('⚠️ Hubspot API key not configured');
            return null;
        }

        try {
            const response = await axios.post(
                'https://api.hubapi.com/contacts/v1/contact/',
                {
                    properties: [
                        { property: 'email', value: contactData.email },
                        { property: 'firstname', value: contactData.firstName },
                        { property: 'lastname', value: contactData.lastName },
                        { property: 'company', value: contactData.company },
                        { property: 'title', value: contactData.title }
                    ]
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.config.hubspotApiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            return response.data;
        } catch (error) {
            throw new Error(`Hubspot sync failed: ${error.message}`);
        }
    }

    async salesforceIntegration(contactData) {
        if (!this.config.salesforceAuth) {
            console.log('⚠️ Salesforce auth not configured');
            return null;
        }

        try {
            const response = await axios.post(
                `${this.config.salesforceUrl}/services/data/v52.0/sobjects/Lead`,
                {
                    Email: contactData.email,
                    FirstName: contactData.firstName,
                    LastName: contactData.lastName,
                    Company: contactData.company,
                    Title: contactData.title
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.config.salesforceAuth}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            return response.data;
        } catch (error) {
            throw new Error(`Salesforce sync failed: ${error.message}`);
        }
    }

    async pipedriveIntegration(contactData) {
        if (!this.config.pipedriveApiKey) {
            console.log('⚠️ Pipedrive API key not configured');
            return null;
        }

        try {
            const response = await axios.post(
                'https://api.pipedrive.com/v1/persons',
                {
                    email: contactData.email,
                    name: `${contactData.firstName} ${contactData.lastName}`,
                    org_id: null, // Would need to create/find organization first
                    title: contactData.title
                },
                {
                    params: {
                        api_token: this.config.pipedriveApiKey
                    }
                }
            );
            return response.data;
        } catch (error) {
            throw new Error(`Pipedrive sync failed: ${error.message}`);
        }
    }

    // Utility method to format contact data
    formatContactData(company) {
        return {
            email: company['Email'],
            firstName: company['First Name'],
            lastName: company['Last Name'],
            company: company['Company Name'],
            title: company['Title'],
            industry: company['Industry'],
            employeeCount: company['# Employees']
        };
    }
}

module.exports = CRMIntegration;