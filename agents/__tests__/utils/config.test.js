const config = require('../../shared/utils/config');

describe('config', () => {
  test('has expected top-level structure', () => {
    expect(config).toHaveProperty('paths');
    expect(config).toHaveProperty('api');
    expect(config).toHaveProperty('email');
    expect(config).toHaveProperty('models');
  });

  test('paths contains required directory references', () => {
    expect(config.paths).toHaveProperty('root');
    expect(config.paths).toHaveProperty('agents');
    expect(config.paths).toHaveProperty('shared');
    expect(config.paths).toHaveProperty('logs');
    expect(config.paths).toHaveProperty('website');
  });

  test('api contains expected service keys', () => {
    expect(config.api).toHaveProperty('anthropic');
    expect(config.api).toHaveProperty('airtable');
    expect(config.api).toHaveProperty('airtableBase');
    expect(config.api).toHaveProperty('openai');
  });

  test('email contains expected fields', () => {
    expect(config.email).toHaveProperty('user');
    expect(config.email).toHaveProperty('password');
    expect(config.email).toHaveProperty('ceo');
  });

  test('models contains fast, standard, and powerful tiers', () => {
    expect(config.models).toHaveProperty('fast');
    expect(config.models).toHaveProperty('standard');
    expect(config.models).toHaveProperty('powerful');
  });

  test('model names are valid Claude model IDs', () => {
    const claudeModelPattern = /^claude-/;
    expect(config.models.fast).toMatch(claudeModelPattern);
    expect(config.models.standard).toMatch(claudeModelPattern);
    expect(config.models.powerful).toMatch(claudeModelPattern);
  });

  test('model IDs include version identifiers', () => {
    // Claude model IDs should contain a date-based version suffix
    const versionPattern = /\d{8}$/;
    expect(config.models.fast).toMatch(versionPattern);
    expect(config.models.standard).toMatch(versionPattern);
    expect(config.models.powerful).not.toMatch(versionPattern); // opus-4-6 has no date suffix
  });

  test('website URL defaults to werkpilot.ch', () => {
    expect(config.website).toHaveProperty('url');
    expect(config.website.url).toContain('werkpilot');
  });
});
