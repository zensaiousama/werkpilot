const { createLogger } = require('../../shared/utils/logger');

describe('createLogger', () => {
  let logger;

  beforeAll(() => {
    logger = createLogger('test-agent');
  });

  test('returns a Winston logger instance', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.log).toBe('function');
  });

  test('logger has info method', () => {
    expect(typeof logger.info).toBe('function');
  });

  test('logger has warn method', () => {
    expect(typeof logger.warn).toBe('function');
  });

  test('logger has error method', () => {
    expect(typeof logger.error).toBe('function');
  });

  test('logger has expected log levels', () => {
    expect(logger.levels).toBeDefined();
    expect(logger.levels).toHaveProperty('error');
    expect(logger.levels).toHaveProperty('warn');
    expect(logger.levels).toHaveProperty('info');
  });

  test('logger has transports configured', () => {
    expect(logger.transports).toBeDefined();
    expect(logger.transports.length).toBeGreaterThan(0);
  });

  test('logger default meta includes agent name', () => {
    expect(logger.defaultMeta).toEqual({ agent: 'test-agent' });
  });
});
