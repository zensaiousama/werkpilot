// Mock the dependencies before requiring the module
jest.mock('@anthropic-ai/sdk');
jest.mock('fs');
jest.mock('crypto');

const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const crypto = require('crypto');

describe('Claude Client', () => {
  let mockCreate;
  let mockClient;
  let clientModule;

  beforeAll(() => {
    // Mock crypto
    crypto.createHash = jest.fn(() => ({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn(() => 'mock-hash-12345678'),
    }));

    // Mock fs
    fs.existsSync = jest.fn(() => false);
    fs.readFileSync = jest.fn(() => JSON.stringify({ dailyUsage: {}, totalCost: 0 }));
    fs.writeFileSync = jest.fn();
    fs.mkdirSync = jest.fn();
    fs.unlinkSync = jest.fn();

    // Mock Anthropic client
    mockCreate = jest.fn();
    mockClient = {
      messages: {
        create: mockCreate,
      },
    };

    Anthropic.mockImplementation(() => mockClient);

    // Set test API key
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
    process.env.DAILY_AI_BUDGET = '100';

    // Require module after mocking
    clientModule = require('../../shared/utils/claude-client');
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock implementations
    fs.existsSync.mockReturnValue(false);
    fs.readFileSync.mockReturnValue(JSON.stringify({ dailyUsage: {}, totalCost: 0 }));
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.DAILY_AI_BUDGET;
  });

  // ── getClient tests ──────────────────────────────────────────

  test('getClient creates client with API key from env', () => {
    const client = clientModule.getClient();

    expect(Anthropic).toHaveBeenCalledWith({
      apiKey: 'test-api-key',
    });
    expect(client).toBeDefined();
  });

  test('getClient returns same instance on multiple calls (singleton)', () => {
    const client1 = clientModule.getClient();
    const client2 = clientModule.getClient();

    expect(client1).toBe(client2);
    // Anthropic is only called once (already called in previous test or during module load)
    expect(client1).toBeDefined();
    expect(client2).toBeDefined();
  });

  // ── generateText tests ───────────────────────────────────────

  test('generateText returns text response from Claude', async () => {
    mockCreate.mockResolvedValue({
      content: [{ text: 'Hello, this is Claude.' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    const result = await clientModule.generateText('Test prompt', { useCache: false });

    expect(result).toBe('Hello, this is Claude.');
    expect(mockCreate).toHaveBeenCalledWith({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      messages: [{ role: 'user', content: 'Test prompt' }],
      temperature: 0.7,
    });
  });

  test('generateText accepts custom model', async () => {
    mockCreate.mockResolvedValue({
      content: [{ text: 'Response' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    await clientModule.generateText('Prompt', { model: 'claude-opus-4-6', useCache: false });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-opus-4-6',
      })
    );
  });

  test('generateText accepts custom maxTokens', async () => {
    mockCreate.mockResolvedValue({
      content: [{ text: 'Response' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    await clientModule.generateText('Prompt', { maxTokens: 8192, useCache: false });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        max_tokens: 8192,
      })
    );
  });

  test('generateText accepts custom temperature', async () => {
    mockCreate.mockResolvedValue({
      content: [{ text: 'Response' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    await clientModule.generateText('Prompt', { temperature: 0.5, useCache: false });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: 0.5,
      })
    );
  });

  test('generateText includes system prompt when provided', async () => {
    mockCreate.mockResolvedValue({
      content: [{ text: 'Response' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    await clientModule.generateText('Prompt', {
      system: 'You are a helpful assistant.',
      useCache: false,
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        system: 'You are a helpful assistant.',
      })
    );
  });

  test('generateText does not include system param when system is empty', async () => {
    mockCreate.mockResolvedValue({
      content: [{ text: 'Response' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    await clientModule.generateText('Prompt', { useCache: false });

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.system).toBeUndefined();
  });

  test('generateText throws error when API call fails', async () => {
    mockCreate.mockRejectedValue(new Error('API rate limit exceeded'));

    await expect(
      clientModule.generateText('Prompt', { useCache: false })
    ).rejects.toThrow('API rate limit exceeded');
  });

  test('generateText uses cache when available', async () => {
    const cachedResponse = {
      timestamp: Date.now(),
      response: {
        text: 'Cached response',
        promptTokens: 10,
        completionTokens: 5,
        totalCost: 0.0001,
        model: 'claude-sonnet-4-5-20250929',
        latencyMs: 100,
      },
    };

    fs.existsSync = jest.fn((filePath) => {
      return filePath.includes('.claude-cache') || filePath.includes('mock-hash');
    });

    fs.readFileSync = jest.fn((filePath) => {
      if (filePath.includes('mock-hash')) {
        return JSON.stringify(cachedResponse);
      }
      return JSON.stringify({ dailyUsage: {}, totalCost: 0 });
    });

    const result = await clientModule.generateText('Test prompt', { useCache: true });

    expect(result).toBe('Cached response');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('generateText saves usage tracking', async () => {
    mockCreate.mockResolvedValue({
      content: [{ text: 'Response' }],
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    await clientModule.generateText('Prompt', { useCache: false });

    expect(fs.writeFileSync).toHaveBeenCalled();
    const writeCall = fs.writeFileSync.mock.calls.find(call =>
      call[0].includes('.claude-usage.json')
    );
    expect(writeCall).toBeDefined();
  });

  test('generateText tracks model usage and costs', async () => {
    mockCreate.mockResolvedValue({
      content: [{ text: 'Response' }],
      usage: { input_tokens: 1000, output_tokens: 500 },
    });

    await clientModule.generateText('Prompt', { model: 'claude-sonnet-4-5-20250929', useCache: false });

    // Should save usage data
    expect(fs.writeFileSync).toHaveBeenCalled();
    const writeCall = fs.writeFileSync.mock.calls.find(call =>
      call[0].includes('.claude-usage.json')
    );
    expect(writeCall).toBeDefined();

    // Verify cost was calculated (sonnet: $3/1M in, $15/1M out)
    const usageData = JSON.parse(writeCall[1]);
    expect(usageData.totalCost).toBeGreaterThan(0);
  });

  // ── generateJSON tests ───────────────────────────────────────

  test('generateJSON parses valid JSON response', async () => {
    mockCreate.mockResolvedValue({
      content: [{ text: '{"result": "success", "value": 42}' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    const result = await clientModule.generateJSON('Generate JSON', { useCache: false });

    expect(result).toEqual({ result: 'success', value: 42 });
  });

  test('generateJSON adds JSON instruction to system prompt', async () => {
    mockCreate.mockResolvedValue({
      content: [{ text: '{"test": true}' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    await clientModule.generateJSON('Prompt', {
      system: 'Custom system prompt.',
      useCache: false,
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('Custom system prompt.'),
      })
    );

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.system).toContain('Respond ONLY with valid JSON');
  });

  test('generateJSON extracts JSON from markdown code block', async () => {
    mockCreate.mockResolvedValue({
      content: [{ text: '```json\n{"extracted": true}\n```' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    const result = await clientModule.generateJSON('Prompt', { useCache: false });

    expect(result).toEqual({ extracted: true });
  });

  test('generateJSON extracts JSON from text with surrounding content', async () => {
    mockCreate.mockResolvedValue({
      content: [{ text: 'Here is the result: {"data": "value"} and more text.' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    const result = await clientModule.generateJSON('Prompt', { useCache: false });

    expect(result).toEqual({ data: 'value' });
  });

  test('generateJSON handles JSON array response', async () => {
    mockCreate.mockResolvedValue({
      content: [{ text: '[1, 2, 3, 4, 5]' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    const result = await clientModule.generateJSON('Prompt', { useCache: false });

    expect(result).toEqual([1, 2, 3, 4, 5]);
  });

  test('generateJSON throws error when no JSON found', async () => {
    mockCreate.mockResolvedValue({
      content: [{ text: 'This is plain text without any JSON.' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    await expect(
      clientModule.generateJSON('Prompt', { useCache: false })
    ).rejects.toThrow('Failed to parse Claude response as JSON');
  });

  test('generateJSON handles nested JSON objects', async () => {
    const complexJSON = {
      user: {
        name: 'Alice',
        settings: {
          theme: 'dark',
          notifications: true,
        },
      },
      items: [
        { id: 1, value: 'first' },
        { id: 2, value: 'second' },
      ],
    };

    mockCreate.mockResolvedValue({
      content: [{ text: JSON.stringify(complexJSON) }],
      usage: { input_tokens: 10, output_tokens: 20 },
    });

    const result = await clientModule.generateJSON('Prompt', { useCache: false });

    expect(result).toEqual(complexJSON);
  });

  // ── Usage tracking tests ─────────────────────────────────────

  test('getUsageStats returns usage data', () => {
    const today = new Date().toISOString().split('T')[0];

    const stats = clientModule.getUsageStats(today);

    expect(stats).toBeDefined();
    expect(stats.date).toBe(today);
    expect(stats.totalCost).toBeGreaterThanOrEqual(0);
    expect(stats.requestCount).toBeGreaterThanOrEqual(0);
  });

  test('resetUsage clears usage data', () => {
    clientModule.resetUsage();

    expect(fs.writeFileSync).toHaveBeenCalled();
    const writeCall = fs.writeFileSync.mock.calls.find(call =>
      call[0].includes('.claude-usage.json')
    );
    expect(writeCall).toBeDefined();

    const writtenData = JSON.parse(writeCall[1]);
    expect(writtenData.dailyUsage).toEqual({});
    expect(writtenData.totalCost).toBe(0);
  });

  test('generateText caches responses when enabled', async () => {
    mockCreate.mockResolvedValue({
      content: [{ text: 'Cached text' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    await clientModule.generateText('Test', { useCache: true });

    const cacheWriteCall = fs.writeFileSync.mock.calls.find(call =>
      call[0].includes('.claude-cache')
    );
    expect(cacheWriteCall).toBeDefined();
  });

  test('generateText skips cache when disabled', async () => {
    mockCreate.mockResolvedValue({
      content: [{ text: 'Fresh text' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    await clientModule.generateText('Test', { useCache: false });

    const cacheWriteCall = fs.writeFileSync.mock.calls.find(call =>
      call[0].includes('.claude-cache')
    );
    expect(cacheWriteCall).toBeUndefined();
  });
});
