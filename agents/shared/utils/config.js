const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const config = {
  paths: {
    root: path.join(__dirname, '../..'),
    agents: path.join(__dirname, '../..'),
    shared: path.join(__dirname, '..'),
    logs: path.join(__dirname, '../../logs'),
    website: path.join(__dirname, '../../../werkpilot-website'),
  },
  api: {
    anthropic: process.env.ANTHROPIC_API_KEY,
    airtable: process.env.AIRTABLE_API_KEY,
    airtableBase: process.env.AIRTABLE_BASE_ID,
    deepl: process.env.DEEPL_API_KEY,
    mailerlite: process.env.MAILERLITE_API_KEY,
    openai: process.env.OPENAI_API_KEY,
  },
  email: {
    user: process.env.GMAIL_USER,
    password: process.env.GMAIL_APP_PASSWORD,
    ceo: process.env.CEO_EMAIL,
  },
  website: {
    url: process.env.WEBSITE_URL || 'https://werkpilot.ch',
  },
  models: {
    fast: 'claude-haiku-4-5-20251001',
    standard: 'claude-sonnet-4-5-20250929',
    powerful: 'claude-opus-4-6',
  },
};

module.exports = config;
