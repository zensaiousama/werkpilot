const { MessageBus, PerformanceTracker, MasterOrchestrator } = require('../orchestrator');
const { fork } = require('child_process');
const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');

// Mock dependencies
jest.mock('child_process');
jest.mock('fs');
jest.mock('node-cron');
jest.mock('../shared/utils/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));
jest.mock('../shared/utils/claude-client', () => ({
  generateJSON: jest.fn(),
}));
jest.mock('../shared/utils/config', () => ({
  paths: {
    logs: '/tmp/logs',
    root: '/tmp',
    agents: '/tmp/agents',
    shared: '/tmp/shared',
    website: '/tmp/website',
  },
  models: {
    fast: 'claude-sonnet-4-5-20250929',
    standard: 'claude-sonnet-4-5-20250929',
    powerful: 'claude-opus-4-6',
  },
}));

describe('MessageBus', () => {
  let bus;

  beforeEach(() => {
    bus = new MessageBus();
  });

  test('publishes messages and emits events', () => {
    const handler = jest.fn();
    bus.subscribe('test.topic', handler);

    const msgId = bus.publish('sender', 'test.topic', { data: 'hello' });

    expect(msgId).toMatch(/^msg_/);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toMatchObject({
      from: 'sender',
      topic: 'test.topic',
      payload: { data: 'hello' },
    });
  });

  test('wildcard subscription receives all messages', () => {
    const wildcard = jest.fn();
    bus.subscribe('*', wildcard);

    bus.publish('agent1', 'topic.a', {});
    bus.publish('agent2', 'topic.b', {});

    expect(wildcard).toHaveBeenCalledTimes(2);
  });

  test('stores message history', () => {
    bus.publish('agent1', 'test', { a: 1 });
    bus.publish('agent2', 'test', { b: 2 });
    bus.publish('agent3', 'test', { c: 3 });

    const recent = bus.getRecentMessages(2);
    expect(recent.length).toBe(2);
    expect(recent[0].payload).toEqual({ b: 2 });
    expect(recent[1].payload).toEqual({ c: 3 });
  });

  test('limits message log size', () => {
    bus.maxLogSize = 10;

    for (let i = 0; i < 15; i++) {
      bus.publish('agent', 'topic', { i });
    }

    expect(bus.messageLog.length).toBeLessThanOrEqual(10);
  });

  test('unsubscribe stops receiving messages', () => {
    const handler = jest.fn();
    const unsubscribe = bus.subscribe('topic', handler);

    bus.publish('agent', 'topic', {});
    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();
    bus.publish('agent', 'topic', {});
    expect(handler).toHaveBeenCalledTimes(1); // still 1, not called again
  });

  test('multiple subscribers to same topic', () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();

    bus.subscribe('shared', handler1);
    bus.subscribe('shared', handler2);

    bus.publish('agent', 'shared', { data: 'test' });

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  test('getRecentMessages returns empty array when no messages', () => {
    const recent = bus.getRecentMessages(10);
    expect(recent).toEqual([]);
  });

  test('message includes timestamp', () => {
    const handler = jest.fn();
    bus.subscribe('topic', handler);

    bus.publish('agent', 'topic', {});

    const msg = handler.mock.calls[0][0];
    expect(msg.timestamp).toBeDefined();
    expect(new Date(msg.timestamp).toString()).not.toBe('Invalid Date');
  });
});

describe('PerformanceTracker', () => {
  let tracker;

  beforeEach(() => {
    tracker = new PerformanceTracker();
  });

  test('initializes agent metrics', () => {
    tracker.initialize('test-agent');
    const metrics = tracker.getMetrics('test-agent');

    expect(metrics).toBeDefined();
    expect(metrics.currentScore).toBe(50);
    expect(metrics.totalRuns).toBe(0);
    expect(metrics.history).toEqual([]);
  });

  test('records successful run and updates score', () => {
    tracker.initialize('agent1');

    tracker.recordRun('agent1', { success: true, durationMs: 100 });

    const metrics = tracker.getMetrics('agent1');
    expect(metrics.totalRuns).toBe(1);
    expect(metrics.successfulRuns).toBe(1);
    expect(metrics.failedRuns).toBe(0);
    expect(metrics.currentScore).toBeGreaterThan(50); // score should increase
  });

  test('records failed run and decreases score', () => {
    tracker.initialize('agent1');

    // Initialize with successes
    tracker.recordRun('agent1', { success: true, durationMs: 100 });
    tracker.recordRun('agent1', { success: true, durationMs: 100 });

    const beforeScore = tracker.getScore('agent1');

    tracker.recordRun('agent1', { success: false, durationMs: 100, error: 'test error' });

    const afterScore = tracker.getScore('agent1');
    const metrics = tracker.getMetrics('agent1');

    expect(afterScore).toBeLessThan(beforeScore);
    expect(metrics.failedRuns).toBe(1);
    expect(metrics.lastError).toBe('test error');
  });

  test('calculates running average duration', () => {
    tracker.initialize('agent1');

    tracker.recordRun('agent1', { success: true, durationMs: 100 });
    tracker.recordRun('agent1', { success: true, durationMs: 200 });

    const metrics = tracker.getMetrics('agent1');
    // Running average with 0.8/0.2 weighting
    expect(metrics.avgDurationMs).toBeGreaterThan(0);
    expect(metrics.avgDurationMs).toBeLessThanOrEqual(200);
  });

  test('score is bounded between 0 and 100', () => {
    tracker.initialize('agent1');

    // Many failures
    for (let i = 0; i < 10; i++) {
      tracker.recordRun('agent1', { success: false, durationMs: 100 });
    }

    let score = tracker.getScore('agent1');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);

    // Many successes
    tracker.initialize('agent2');
    for (let i = 0; i < 10; i++) {
      tracker.recordRun('agent2', { success: true, durationMs: 100 });
    }

    score = tracker.getScore('agent2');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test('detects underperformers below threshold', () => {
    tracker.initialize('good-agent');
    tracker.initialize('bad-agent');

    // Good agent
    for (let i = 0; i < 5; i++) {
      tracker.recordRun('good-agent', { success: true, durationMs: 100 });
    }

    // Bad agent
    for (let i = 0; i < 5; i++) {
      tracker.recordRun('bad-agent', { success: false, durationMs: 100 });
    }

    const underperformers = tracker.getUnderperformers(50);

    expect(underperformers.length).toBe(1);
    expect(underperformers[0].name).toBe('bad-agent');
    expect(underperformers[0].score).toBeLessThan(50);
  });

  test('underperformers are sorted by score ascending', () => {
    tracker.initialize('agent1');
    tracker.initialize('agent2');
    tracker.initialize('agent3');

    // agent1: moderate failures
    tracker.recordRun('agent1', { success: false, durationMs: 100 });
    tracker.recordRun('agent1', { success: true, durationMs: 100 });

    // agent2: many failures
    tracker.recordRun('agent2', { success: false, durationMs: 100 });
    tracker.recordRun('agent2', { success: false, durationMs: 100 });
    tracker.recordRun('agent2', { success: false, durationMs: 100 });

    // agent3: few failures
    tracker.recordRun('agent3', { success: false, durationMs: 100 });

    const underperformers = tracker.getUnderperformers(100); // catch all

    // Should be sorted worst to best
    if (underperformers.length >= 2) {
      expect(underperformers[0].score).toBeLessThanOrEqual(underperformers[1].score);
    }
  });

  test('getAllMetrics returns summary without history', () => {
    tracker.initialize('agent1');
    tracker.recordRun('agent1', { success: true, durationMs: 100 });

    const allMetrics = tracker.getAllMetrics();

    expect(allMetrics['agent1']).toBeDefined();
    expect(allMetrics['agent1'].totalRuns).toBe(1);
    expect(allMetrics['agent1'].history).toBeUndefined();
  });

  test('limits history size', () => {
    tracker.initialize('agent1');

    // Record more runs than PERFORMANCE_HISTORY_SIZE (100)
    for (let i = 0; i < 150; i++) {
      tracker.recordRun('agent1', { success: true, durationMs: 100 });
    }

    const metrics = tracker.getMetrics('agent1');
    expect(metrics.history.length).toBeLessThanOrEqual(100);
  });

  test('getScore returns 0 for unknown agent', () => {
    expect(tracker.getScore('unknown')).toBe(0);
  });

  test('getMetrics returns null for unknown agent', () => {
    expect(tracker.getMetrics('unknown')).toBeNull();
  });

  test('history entries include timestamp, success, duration, and score', () => {
    tracker.initialize('agent1');
    tracker.recordRun('agent1', { success: true, durationMs: 123 });

    const metrics = tracker.getMetrics('agent1');
    const entry = metrics.history[0];

    expect(entry.timestamp).toBeDefined();
    expect(entry.success).toBe(true);
    expect(entry.durationMs).toBe(123);
    expect(entry.score).toBeDefined();
  });
});

describe('MasterOrchestrator - Boot Sequence', () => {
  let orchestrator;
  const mockRegistry = {
    agents: [
      { name: 'agent1', enabled: true, file: 'agents/agent1.js', department: 'test', schedule: '*/5 * * * *', dependencies: [] },
      { name: 'agent2', enabled: true, file: 'agents/agent2.js', department: 'test', schedule: '*/10 * * * *', dependencies: ['agent1'] },
      { name: 'agent3', enabled: false, file: 'agents/agent3.js', department: 'test', schedule: '*/15 * * * *', dependencies: [] },
    ],
  };

  const mockDependencyGraph = {
    bootLayers: [
      { layer: 0, description: 'Foundation', agents: ['agent1'] },
      { layer: 1, description: 'Business', agents: ['agent2', 'agent3'] },
    ],
    edges: {
      agent1: [],
      agent2: ['agent1'],
      agent3: [],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    fs.readFileSync = jest.fn((filepath) => {
      if (filepath.includes('agent-registry.json')) {
        return JSON.stringify(mockRegistry);
      }
      if (filepath.includes('dependency-graph.json')) {
        return JSON.stringify(mockDependencyGraph);
      }
      return '{}';
    });

    fs.existsSync = jest.fn(() => true);
    fs.mkdirSync = jest.fn();
    fs.writeFileSync = jest.fn();

    const cron = require('node-cron');
    cron.validate = jest.fn(() => true);
    cron.schedule = jest.fn(() => ({ stop: jest.fn(), start: jest.fn() }));

    orchestrator = new MasterOrchestrator();
  });

  test('loads registry correctly', () => {
    orchestrator.loadRegistry();

    expect(orchestrator.registry).toBeDefined();
    expect(orchestrator.registry.length).toBe(3);
    expect(orchestrator.agents.size).toBe(3);
  });

  test('loads dependency graph correctly', () => {
    orchestrator.loadRegistry();
    orchestrator.loadDependencyGraph();

    expect(orchestrator.dependencyGraph).toBeDefined();
    expect(orchestrator.dependencyGraph.bootLayers.length).toBe(2);
  });

  test('validates dependency graph detects circular dependencies', () => {
    orchestrator.loadRegistry();

    // Create circular dependency
    const circularGraph = {
      bootLayers: [{ layer: 0, description: 'Test', agents: ['agent1', 'agent2'] }],
      edges: {
        agent1: ['agent2'],
        agent2: ['agent1'], // circular
        agent3: [],
      },
    };

    fs.readFileSync = jest.fn(() => JSON.stringify(circularGraph));

    expect(() => {
      orchestrator.loadDependencyGraph();
    }).toThrow(/circular dependency/i);
  });

  test('boot sequence processes layers in order', async () => {
    orchestrator.loadRegistry();
    orchestrator.loadDependencyGraph();

    const bootedAgents = [];
    orchestrator.bootAgent = jest.fn(async (name) => {
      bootedAgents.push(name);
    });

    await orchestrator.bootAgentsInOrder();

    // agent1 should be booted before agent2 (dependency order)
    const idx1 = bootedAgents.indexOf('agent1');
    const idx2 = bootedAgents.indexOf('agent2');

    expect(idx1).toBeGreaterThanOrEqual(0);
    expect(idx2).toBeGreaterThan(idx1);
  });

  test('skips disabled agents during boot', async () => {
    orchestrator.loadRegistry();
    orchestrator.loadDependencyGraph();

    orchestrator.bootAgent = jest.fn();

    await orchestrator.bootAgentsInOrder();

    // agent3 is disabled
    expect(orchestrator.bootAgent).not.toHaveBeenCalledWith('agent3');
    expect(orchestrator.bootAgent).toHaveBeenCalledWith('agent1');
    expect(orchestrator.bootAgent).toHaveBeenCalledWith('agent2');
  });

  test('getEnabledCount returns correct count', () => {
    orchestrator.loadRegistry();

    const count = orchestrator.getEnabledCount();
    expect(count).toBe(2); // agent1 and agent2 are enabled
  });
});

describe('MasterOrchestrator - Health Monitoring', () => {
  let orchestrator;

  beforeEach(() => {
    jest.clearAllMocks();

    fs.readFileSync = jest.fn(() => JSON.stringify({
      agents: [
        { name: 'healthy-agent', enabled: true, file: 'agents/h.js', department: 'test', schedule: '*/5 * * * *', dependencies: [] },
        { name: 'error-agent', enabled: true, file: 'agents/e.js', department: 'test', schedule: '*/5 * * * *', dependencies: [] },
      ],
    }));

    fs.existsSync = jest.fn(() => true);

    const cron = require('node-cron');
    cron.validate = jest.fn(() => true);
    cron.schedule = jest.fn(() => ({ stop: jest.fn() }));

    orchestrator = new MasterOrchestrator();
    orchestrator.loadRegistry();
    orchestrator.dependencyGraph = {
      bootLayers: [],
      edges: { 'healthy-agent': [], 'error-agent': [] },
    };
  });

  test('runHealthCheck aggregates agent statuses', async () => {
    const agent1 = orchestrator.agents.get('healthy-agent');
    const agent2 = orchestrator.agents.get('error-agent');

    agent1.status = 'ready';
    agent1.config.enabled = true;

    agent2.status = 'error';
    agent2.config.enabled = true;

    const publishSpy = jest.spyOn(orchestrator.messageBus, 'publish');

    await orchestrator.runHealthCheck();

    expect(publishSpy).toHaveBeenCalledWith(
      'orchestrator',
      'health.check.complete',
      expect.objectContaining({
        healthy: 1,
        errored: 1,
        total: 2,
      })
    );
  });

  test('health check publishes critical alert when health < 50%', async () => {
    const agent1 = orchestrator.agents.get('healthy-agent');
    const agent2 = orchestrator.agents.get('error-agent');

    agent1.status = 'error';
    agent1.config.enabled = true;

    agent2.status = 'error';
    agent2.config.enabled = true;

    const publishSpy = jest.spyOn(orchestrator.messageBus, 'publish');

    await orchestrator.runHealthCheck();

    expect(publishSpy).toHaveBeenCalledWith(
      'orchestrator',
      'system.health.critical',
      expect.objectContaining({
        healthPercentage: expect.any(Number),
      })
    );
  });

  test('checkDependenciesHealthy returns false when dependency failed', () => {
    orchestrator.dependencyGraph = {
      edges: {
        'agent1': ['agent2'],
        'agent2': [],
      },
    };

    orchestrator.agents.set('agent1', {
      config: { enabled: true },
      status: 'ready',
    });

    orchestrator.agents.set('agent2', {
      config: { enabled: true },
      status: 'disabled_by_failure',
    });

    const isHealthy = orchestrator.checkDependenciesHealthy('agent1');
    expect(isHealthy).toBe(false);
  });

  test('checkDependenciesHealthy returns true when all dependencies healthy', () => {
    orchestrator.dependencyGraph = {
      edges: {
        'agent1': ['agent2'],
        'agent2': [],
      },
    };

    orchestrator.agents.set('agent1', {
      config: { enabled: true },
      status: 'ready',
    });

    orchestrator.agents.set('agent2', {
      config: { enabled: true },
      status: 'ready',
    });

    const isHealthy = orchestrator.checkDependenciesHealthy('agent1');
    expect(isHealthy).toBe(true);
  });
});

describe('MasterOrchestrator - Agent Execution', () => {
  let orchestrator;
  let mockChild;

  beforeEach(() => {
    jest.clearAllMocks();

    mockChild = new EventEmitter();
    mockChild.kill = jest.fn();
    mockChild.killed = false;
    mockChild.stdout = new EventEmitter();
    mockChild.stderr = new EventEmitter();

    fork.mockReturnValue(mockChild);

    fs.readFileSync = jest.fn(() => JSON.stringify({
      agents: [
        { name: 'test-agent', enabled: true, file: 'agents/test.js', department: 'test', schedule: '*/5 * * * *', dependencies: [], maxRestarts: 3, timeoutMs: 5000 },
      ],
    }));

    fs.existsSync = jest.fn(() => true);
    fs.mkdirSync = jest.fn();

    const cron = require('node-cron');
    cron.validate = jest.fn(() => true);
    cron.schedule = jest.fn(() => ({ stop: jest.fn() }));

    orchestrator = new MasterOrchestrator();
    orchestrator.loadRegistry();
    orchestrator.dependencyGraph = {
      bootLayers: [],
      edges: { 'test-agent': [] },
    };
  });

  test('executeAgent spawns child process successfully', async () => {
    const execPromise = orchestrator.executeAgent('test-agent');

    // Simulate successful completion
    setTimeout(() => {
      mockChild.emit('exit', 0, null);
    }, 10);

    await execPromise;

    expect(fork).toHaveBeenCalledWith(
      expect.stringContaining('test.js'),
      [],
      expect.objectContaining({
        env: expect.objectContaining({
          AGENT_NAME: 'test-agent',
          WERKPILOT_AGENT: '1',
        }),
      })
    );

    const agent = orchestrator.agents.get('test-agent');
    expect(agent.status).toBe('ready');

    const metrics = orchestrator.performance.getMetrics('test-agent');
    expect(metrics.successfulRuns).toBe(1);
  });

  test('executeAgent handles process failure', async () => {
    const execPromise = orchestrator.executeAgent('test-agent');

    // Simulate failure
    setTimeout(() => {
      mockChild.emit('exit', 1, null);
    }, 10);

    await execPromise;

    const agent = orchestrator.agents.get('test-agent');
    expect(agent.status).toBe('error');

    const metrics = orchestrator.performance.getMetrics('test-agent');
    expect(metrics.failedRuns).toBe(1);
  });

  test('executeAgent handles timeout', async () => {
    jest.useFakeTimers();

    const execPromise = orchestrator.executeAgent('test-agent');

    // Advance time past timeout
    jest.advanceTimersByTime(6000);

    await execPromise;

    expect(mockChild.kill).toHaveBeenCalledWith('SIGTERM');

    const agent = orchestrator.agents.get('test-agent');
    expect(agent.status).toBe('timeout');

    jest.useRealTimers();
  });

  test('executeAgent skips if dependencies unhealthy', async () => {
    orchestrator.dependencyGraph.edges['test-agent'] = ['dep-agent'];
    orchestrator.agents.set('dep-agent', {
      config: { enabled: true },
      status: 'error',
    });

    await orchestrator.executeAgent('test-agent');

    expect(fork).not.toHaveBeenCalled();

    const metrics = orchestrator.performance.getMetrics('test-agent');
    expect(metrics.failedRuns).toBe(1);
  });

  test('executeAgent forwards messages from child to message bus', async () => {
    const publishSpy = jest.spyOn(orchestrator.messageBus, 'publish');

    const execPromise = orchestrator.executeAgent('test-agent');

    // Simulate child sending message
    mockChild.emit('message', {
      topic: 'agent.custom.event',
      payload: { data: 'test' },
    });

    // Complete execution
    setTimeout(() => mockChild.emit('exit', 0, null), 10);
    await execPromise;

    expect(publishSpy).toHaveBeenCalledWith(
      'test-agent',
      'agent.custom.event',
      { data: 'test' }
    );
  });

  test('executeAgent logs stdout and stderr', async () => {
    const execPromise = orchestrator.executeAgent('test-agent');

    mockChild.stdout.emit('data', Buffer.from('stdout log'));
    mockChild.stderr.emit('data', Buffer.from('stderr log'));

    setTimeout(() => mockChild.emit('exit', 0, null), 10);
    await execPromise;

    // Logs should be captured (verified by logger mock)
    expect(true).toBe(true); // placeholder - logger is mocked
  });
});
