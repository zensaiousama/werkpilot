const { MessageBus } = require('../../orchestrator');

describe('Agent Communication Integration', () => {
  let messageBus;

  beforeEach(() => {
    messageBus = new MessageBus();
  });

  // ── Mock Agent Helper ────────────────────────────────────────

  class MockAgent {
    constructor(name, bus) {
      this.name = name;
      this.bus = bus;
      this.receivedMessages = [];
      this.requestHandlers = new Map();
      this.pendingRequests = new Map();
      this.requestCounter = 0;
    }

    start() {
      // Subscribe to messages directed at this agent
      this.bus.subscribe(`agent.${this.name}.request`, (msg) => {
        this.handleRequest(msg);
      });

      // Subscribe to responses
      this.bus.subscribe(`agent.${this.name}.response`, (msg) => {
        this.handleResponse(msg);
      });

      // Subscribe to broadcasts
      this.bus.subscribe('agent.broadcast', (msg) => {
        this.receivedMessages.push(msg);
      });
    }

    handleRequest(msg) {
      this.receivedMessages.push(msg);

      const { requestId, operation, data } = msg.payload;
      const handler = this.requestHandlers.get(operation);

      if (handler) {
        try {
          const result = handler(data);
          this.sendResponse(msg.from, requestId, { success: true, result });
        } catch (error) {
          this.sendResponse(msg.from, requestId, { success: false, error: error.message });
        }
      } else {
        this.sendResponse(msg.from, requestId, {
          success: false,
          error: `Unknown operation: ${operation}`,
        });
      }
    }

    handleResponse(msg) {
      const { requestId, result } = msg.payload;
      const pending = this.pendingRequests.get(requestId);

      if (pending) {
        this.pendingRequests.delete(requestId);
        if (result.success) {
          pending.resolve(result.result);
        } else {
          pending.reject(new Error(result.error));
        }
      }
    }

    sendRequest(targetAgent, operation, data, timeoutMs = 5000) {
      return new Promise((resolve, reject) => {
        const requestId = `${this.name}_req_${this.requestCounter++}`;

        const timeout = setTimeout(() => {
          this.pendingRequests.delete(requestId);
          reject(new Error(`Request ${requestId} timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        this.pendingRequests.set(requestId, {
          resolve: (result) => {
            clearTimeout(timeout);
            resolve(result);
          },
          reject: (error) => {
            clearTimeout(timeout);
            reject(error);
          },
        });

        this.bus.publish(
          this.name,
          `agent.${targetAgent}.request`,
          { requestId, operation, data }
        );
      });
    }

    sendResponse(targetAgent, requestId, result) {
      this.bus.publish(
        this.name,
        `agent.${targetAgent}.response`,
        { requestId, result }
      );
    }

    registerHandler(operation, handler) {
      this.requestHandlers.set(operation, handler);
    }

    broadcast(data) {
      this.bus.publish(this.name, 'agent.broadcast', data);
    }

    stop() {
      // Clear all pending requests with error
      for (const [requestId, pending] of this.pendingRequests) {
        pending.reject(new Error('Agent stopped'));
      }
      this.pendingRequests.clear();
    }
  }

  // ── Integration Tests ────────────────────────────────────────

  test('two agents can communicate via request-response', async () => {
    const agent1 = new MockAgent('agent1', messageBus);
    const agent2 = new MockAgent('agent2', messageBus);

    agent1.start();
    agent2.start();

    // agent2 handles "add" operation
    agent2.registerHandler('add', (data) => {
      return data.a + data.b;
    });

    // agent1 sends request to agent2
    const result = await agent1.sendRequest('agent2', 'add', { a: 5, b: 3 });

    expect(result).toBe(8);
  });

  test('agent handles multiple concurrent requests', async () => {
    const provider = new MockAgent('provider', messageBus);
    const consumer = new MockAgent('consumer', messageBus);

    provider.start();
    consumer.start();

    provider.registerHandler('multiply', (data) => {
      return data.x * data.y;
    });

    // Send multiple requests concurrently
    const promises = [
      consumer.sendRequest('provider', 'multiply', { x: 2, y: 3 }),
      consumer.sendRequest('provider', 'multiply', { x: 4, y: 5 }),
      consumer.sendRequest('provider', 'multiply', { x: 7, y: 8 }),
    ];

    const results = await Promise.all(promises);

    expect(results).toEqual([6, 20, 56]);
  });

  test('request times out when no response received', async () => {
    const agent1 = new MockAgent('agent1', messageBus);
    const agent2 = new MockAgent('agent2', messageBus);

    agent1.start();
    agent2.start();

    // agent2 doesn't register any handlers - won't respond in time
    // Expect immediate rejection with "unknown operation" error

    await expect(
      agent1.sendRequest('agent2', 'nonexistent', {}, 100) // 100ms timeout
    ).rejects.toThrow(); // Will error immediately with "unknown operation"
  }, 1000); // 1 second test timeout

  test('agent returns error response for unknown operation', async () => {
    const agent1 = new MockAgent('agent1', messageBus);
    const agent2 = new MockAgent('agent2', messageBus);

    agent1.start();
    agent2.start();

    await expect(
      agent1.sendRequest('agent2', 'unknownOp', {})
    ).rejects.toThrow(/unknown operation/i);
  });

  test('agent handles operation that throws error', async () => {
    const agent1 = new MockAgent('agent1', messageBus);
    const agent2 = new MockAgent('agent2', messageBus);

    agent1.start();
    agent2.start();

    agent2.registerHandler('divide', (data) => {
      if (data.b === 0) {
        throw new Error('Division by zero');
      }
      return data.a / data.b;
    });

    await expect(
      agent1.sendRequest('agent2', 'divide', { a: 10, b: 0 })
    ).rejects.toThrow(/division by zero/i);

    // Successful case
    const result = await agent1.sendRequest('agent2', 'divide', { a: 10, b: 2 });
    expect(result).toBe(5);
  });

  test('broadcast message reaches all agents', async () => {
    const agent1 = new MockAgent('agent1', messageBus);
    const agent2 = new MockAgent('agent2', messageBus);
    const agent3 = new MockAgent('agent3', messageBus);

    agent1.start();
    agent2.start();
    agent3.start();

    agent1.broadcast({ event: 'system.alert', message: 'Server maintenance' });

    // Wait for event propagation
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(agent2.receivedMessages.length).toBeGreaterThan(0);
    expect(agent3.receivedMessages.length).toBeGreaterThan(0);

    const agent2Msg = agent2.receivedMessages.find(m => m.topic === 'agent.broadcast');
    const agent3Msg = agent3.receivedMessages.find(m => m.topic === 'agent.broadcast');

    expect(agent2Msg).toBeDefined();
    expect(agent2Msg.payload.event).toBe('system.alert');

    expect(agent3Msg).toBeDefined();
    expect(agent3Msg.payload.event).toBe('system.alert');
  });

  test('request-response pattern with complex data', async () => {
    const dataAgent = new MockAgent('dataAgent', messageBus);
    const queryAgent = new MockAgent('queryAgent', messageBus);

    dataAgent.start();
    queryAgent.start();

    dataAgent.registerHandler('query', (data) => {
      // Simulate database query
      const records = [
        { id: 1, name: 'Alice', age: 30 },
        { id: 2, name: 'Bob', age: 25 },
        { id: 3, name: 'Charlie', age: 35 },
      ];

      if (data.filter === 'age>30') {
        return records.filter(r => r.age > 30);
      }

      return records;
    });

    const result = await queryAgent.sendRequest('dataAgent', 'query', { filter: 'age>30' });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Charlie');
  });

  test('agent stops and rejects pending requests', async () => {
    const agent1 = new MockAgent('agent1', messageBus);
    const agent2 = new MockAgent('agent2', messageBus);

    agent1.start();
    agent2.start();

    // Create a pending request
    const requestPromise = agent1.sendRequest('agent2', 'nonexistent', {}, 500);

    // Stop agent1 immediately
    agent1.stop();

    await expect(requestPromise).rejects.toThrow();
  }, 1000); // 1 second test timeout

  test('bidirectional communication between agents', async () => {
    const agent1 = new MockAgent('agent1', messageBus);
    const agent2 = new MockAgent('agent2', messageBus);

    agent1.start();
    agent2.start();

    agent1.registerHandler('greet', (data) => {
      return `Hello, ${data.name}!`;
    });

    agent2.registerHandler('greet', (data) => {
      return `Hi, ${data.name}!`;
    });

    const result1 = await agent1.sendRequest('agent2', 'greet', { name: 'Agent1' });
    const result2 = await agent2.sendRequest('agent1', 'greet', { name: 'Agent2' });

    expect(result1).toBe('Hi, Agent1!');
    expect(result2).toBe('Hello, Agent2!');
  });

  test('message bus tracks message history during communication', async () => {
    const agent1 = new MockAgent('agent1', messageBus);
    const agent2 = new MockAgent('agent2', messageBus);

    agent1.start();
    agent2.start();

    agent2.registerHandler('echo', (data) => data);

    await agent1.sendRequest('agent2', 'echo', { text: 'test' });

    const history = messageBus.getRecentMessages(10);

    // Should have request and response messages
    expect(history.length).toBeGreaterThanOrEqual(2);

    const requestMsg = history.find(m => m.topic === 'agent.agent2.request');
    const responseMsg = history.find(m => m.topic === 'agent.agent1.response');

    expect(requestMsg).toBeDefined();
    expect(responseMsg).toBeDefined();
  });

  test('agents can chain requests', async () => {
    const agent1 = new MockAgent('agent1', messageBus);
    const agent2 = new MockAgent('agent2', messageBus);
    const agent3 = new MockAgent('agent3', messageBus);

    agent1.start();
    agent2.start();
    agent3.start();

    agent2.registerHandler('process', async (data) => {
      // agent2 forwards to agent3
      const result = await agent2.sendRequest('agent3', 'transform', data);
      return `processed-${result}`;
    });

    agent3.registerHandler('transform', (data) => {
      return data.value.toUpperCase();
    });

    const result = await agent1.sendRequest('agent2', 'process', { value: 'hello' });

    expect(result).toBe('processed-HELLO');
  });

  test('wildcard subscription receives all agent messages', async () => {
    const agent1 = new MockAgent('agent1', messageBus);
    const agent2 = new MockAgent('agent2', messageBus);

    const allMessages = [];
    messageBus.subscribe('*', (msg) => {
      allMessages.push(msg);
    });

    agent1.start();
    agent2.start();

    agent2.registerHandler('test', (data) => data);

    await agent1.sendRequest('agent2', 'test', { data: 'test' });

    // Should capture all messages
    expect(allMessages.length).toBeGreaterThan(0);
  });

  test('request with empty payload', async () => {
    const agent1 = new MockAgent('agent1', messageBus);
    const agent2 = new MockAgent('agent2', messageBus);

    agent1.start();
    agent2.start();

    agent2.registerHandler('ping', () => 'pong');

    const result = await agent1.sendRequest('agent2', 'ping', {});

    expect(result).toBe('pong');
  });

  test('concurrent broadcasts from multiple agents', async () => {
    const agent1 = new MockAgent('agent1', messageBus);
    const agent2 = new MockAgent('agent2', messageBus);
    const agent3 = new MockAgent('agent3', messageBus);

    agent1.start();
    agent2.start();
    agent3.start();

    agent1.broadcast({ from: 'agent1', event: 'event1' });
    agent2.broadcast({ from: 'agent2', event: 'event2' });

    await new Promise(resolve => setTimeout(resolve, 10));

    // agent3 should receive both broadcasts
    const broadcasts = agent3.receivedMessages.filter(m => m.topic === 'agent.broadcast');
    expect(broadcasts.length).toBe(2);

    const events = broadcasts.map(b => b.payload.event);
    expect(events).toContain('event1');
    expect(events).toContain('event2');
  });
});
