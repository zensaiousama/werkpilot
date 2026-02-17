# Orchestrator API Examples

Quick reference for using the new production features in your agents.

---

## 1. Agent Communication Protocol

### Send Request from Agent

```javascript
// In your agent file (e.g., agent-sales.js)

// Option 1: Via message bus directly (if you have access)
const messageBus = require('./shared/message-bus'); // or get from orchestrator

async function queryAnalytics() {
  try {
    const response = await messageBus.requestResponse(
      'agent-sales',           // from (your agent name)
      'agent-analytics',       // to (target agent)
      {
        query: 'revenue_today',
        filters: { region: 'DACH' }
      },
      5000                     // timeout in ms
    );

    console.log('Revenue today:', response.revenue);
    return response;
  } catch (err) {
    console.error('Query failed:', err.message);
    // Handle timeout or error
  }
}
```

### Respond to Request in Agent

```javascript
// In your agent file (e.g., agent-analytics.js)

// Listen for requests
messageBus.subscribe('agent.request.agent-analytics', async (message) => {
  const { requestId, responseTopic, payload } = message.payload;

  try {
    // Process the request
    const result = await processQuery(payload.query, payload.filters);

    // Send success response
    messageBus.respondToRequest(
      'agent-analytics',  // from
      requestId,
      responseTopic,
      { revenue: 15000, currency: 'CHF' }, // data
      null                                   // error
    );
  } catch (err) {
    // Send error response
    messageBus.respondToRequest(
      'agent-analytics',
      requestId,
      responseTopic,
      null,                    // data
      err.message              // error
    );
  }
});
```

---

## 2. Configure Agent Priority

### In agent-registry.json

```json
{
  "agents": [
    {
      "name": "agent-revenue-tracker",
      "priority": 1,
      "department": "analytics",
      "enabled": true,
      "schedule": "*/5 * * * *",
      "file": "./analytics/revenue-tracker.js",
      "dependencies": ["agent-db"],
      "timeoutMs": 30000,
      "maxRestarts": 3
    },
    {
      "name": "agent-social-media",
      "priority": 3,
      "department": "marketing",
      "enabled": true,
      "schedule": "*/15 * * * *",
      "file": "./marketing/social-media.js",
      "dependencies": [],
      "timeoutMs": 60000,
      "maxRestarts": 2
    }
  ]
}
```

**Priority levels:**
- `1` = Critical (executes first, never disabled by memory pressure)
- `2` = Important (executes second)
- `3` = Normal (executes last, disabled first on memory pressure)

---

## 3. Monitor Agent Performance

### Check Your Agent's Metrics

```bash
# Get all metrics
curl http://localhost:3001/metrics | jq '.metrics["agent-sales"]'

# Output:
{
  "currentScore": 85,
  "totalRuns": 150,
  "successfulRuns": 145,
  "failedRuns": 5,
  "avgDurationMs": 1234,
  "lastRunAt": "2026-02-14T10:30:00.000Z",
  "lastError": null,
  "p50": 1100,    # median latency
  "p95": 2300,    # 95th percentile
  "p99": 3200     # 99th percentile
}
```

### Check System Memory

```bash
curl http://localhost:3001/metrics | jq '.system.memory'

# Output:
{
  "heapUsedMB": 145,
  "heapTotalMB": 256,
  "heapPercent": 57,
  "rssMB": 312
}
```

---

## 4. Check Dead Letter Queue

### View Failed Executions

```bash
# Get last 20 DLQ entries
curl http://localhost:3001/metrics | jq '.deadLetterQueue'

# Output:
[
  {
    "agentName": "agent-email-sender",
    "error": "SMTP timeout",
    "timestamp": "2026-02-14T10:15:00.000Z",
    "restartCount": 4,
    "executionData": {
      "department": "sales",
      "schedule": "*/10 * * * *",
      "lastHealthCheck": "2026-02-14T10:10:00.000Z"
    }
  }
]
```

### Monitor DLQ Size

```bash
# Watch DLQ size in real-time
watch 'curl -s http://localhost:3001/metrics | jq ".system.deadLetterQueueSize"'
```

---

## 5. Test Graceful Shutdown

```bash
# Start orchestrator
node --expose-gc orchestrator.js

# In another terminal, find PID
ps aux | grep orchestrator

# Send graceful shutdown signal
kill -SIGTERM <pid>

# Or use SIGINT (Ctrl+C)
# Or SIGHUP
kill -SIGHUP <pid>
```

**Expected log output:**
```
[orchestrator] ========================================
[orchestrator]   Graceful Shutdown Initiated
[orchestrator] ========================================
[orchestrator] [1/6] Stopping cron jobs...
[orchestrator]   Stopped 42 cron jobs
[orchestrator] [2/6] Stopping health monitoring...
[orchestrator]   Health monitoring stopped
[orchestrator] [3/6] Waiting for running agents to complete...
[orchestrator]   Waiting for 3 running agents: agent-sales, agent-analytics, agent-db
[orchestrator]   Agent "agent-sales" completed gracefully
[orchestrator]   Agent "agent-analytics" completed gracefully
[orchestrator]   Agent "agent-db" completed gracefully
[orchestrator]   Wait completed after 2543ms
[orchestrator] [4/6] Terminating remaining agent processes...
[orchestrator]   No processes to terminate
[orchestrator] [5/6] Stopping dashboard server...
[orchestrator]   Dashboard server stopped
[orchestrator] [6/6] Final cleanup...
[orchestrator] ========================================
[orchestrator]   Shutdown Complete
[orchestrator]   Uptime: 3600s
[orchestrator]   Shutdown duration: 2654ms
[orchestrator]   Exit code: 0
[orchestrator] ========================================
```

---

## 6. Monitor Dependency Health

### Check Your Agent's Dependencies

```javascript
// In your agent file
const agentData = orchestrator.getAgentData('agent-sales');

console.log('Dependencies:', agentData.dependencies);
// ['agent-db', 'agent-analytics']

// Dependencies are checked before each execution
// If any dependency is unhealthy, execution is skipped
```

### View Dependency Health Events

```bash
# Subscribe to dependency health events
# (This requires access to message bus)

messageBus.subscribe('agent.dependencies.unhealthy', (message) => {
  console.log('Unhealthy deps:', message.payload);
  // {
  //   agent: 'agent-sales',
  //   unhealthyDeps: [
  //     { dep: 'agent-analytics', reason: 'error', error: 'DB connection failed' }
  //   ]
  // }
});
```

---

## 7. Enable Garbage Collection

### Run with GC flag

```bash
# Enable manual GC triggering
node --expose-gc orchestrator.js

# Now memory monitor can trigger GC at 80% heap
```

### Check if GC is working

```bash
# Watch memory metrics
watch 'curl -s http://localhost:3001/metrics | jq ".system.memory.heapPercent"'

# If it drops suddenly from 85% → 60%, GC was triggered
```

---

## 8. View Execution Queue

### Check Queue Size

```bash
curl http://localhost:3001/metrics | jq '.system.executionQueueSize'
# Output: 3
```

### How Queuing Works

1. Agent is scheduled by cron
2. Added to priority queue based on:
   - Priority (1 > 2 > 3)
   - Dependency depth (shallower first)
3. Queue is processed FIFO within same priority
4. Execution only if dependencies are healthy

**Example queue order:**
```
Priority 1, depth 0: agent-db
Priority 1, depth 1: agent-analytics
Priority 2, depth 0: agent-strategy
Priority 2, depth 2: agent-sales
Priority 3, depth 0: agent-social-media
```

---

## 9. Dashboard Overview

### GET /metrics endpoint

```bash
curl http://localhost:3001/metrics | jq
```

**Full response structure:**
```json
{
  "system": {
    "bootTime": "2026-02-14T08:00:00.000Z",
    "uptimeMs": 7200000,
    "totalAgents": 42,
    "enabledAgents": 38,
    "isShuttingDown": false,
    "globalRestartCount": 3,
    "executionQueueSize": 2,
    "deadLetterQueueSize": 1,
    "memory": {
      "heapUsedMB": 145,
      "heapTotalMB": 256,
      "heapPercent": 57,
      "rssMB": 312
    }
  },
  "agents": [
    {
      "name": "agent-sales",
      "department": "sales",
      "priority": 1,
      "status": "ready",
      "enabled": true,
      "schedule": "*/5 * * * *",
      "score": 85,
      "restartCount": 0,
      "bootedAt": "2026-02-14T08:00:05.000Z",
      "lastHealthCheck": "2026-02-14T10:00:00.000Z",
      "error": null,
      "isRunning": false,
      "dependencyDepth": 2,
      "p50": 1100,
      "p95": 2300,
      "p99": 3200
    }
  ],
  "departments": {
    "sales": {
      "total": 10,
      "healthy": 9,
      "healthPercentage": 90,
      "agents": [...]
    }
  },
  "metrics": {
    "agent-sales": { ... }
  },
  "recentMessages": [...],
  "deadLetterQueue": [...]
}
```

---

## 10. Event Bus Topics

### New Topics

```javascript
// Graceful shutdown
'system.shutdown' // { exitCode: 0 }

// Memory events
'system.memory' // { heapUsedMB, heapTotalMB, heapPercent, rssMB }
'system.memory.warning' // { heapPercent: 85, action: 'gc_triggered' }
'system.memory.critical' // { heapPercent: 92, action: 'disabled_low_priority_agents' }

// DLQ events
'dlq.entry.added' // { agentName, error, timestamp, executionData }

// Dependency health
'agent.dependencies.unhealthy' // { agent, unhealthyDeps: [...] }

// Agent communication
'agent.request.{targetAgent}' // { requestId, responseTopic, payload }
'agent.response.{requestId}' // { requestId, data, error }
```

### Subscribe to Events

```javascript
// In your agent
const unsubscribe = messageBus.subscribe('system.memory.warning', (msg) => {
  console.warn('Memory warning:', msg.payload);
  // Maybe reduce cache size, stop non-critical tasks, etc.
});

// Later: unsubscribe()
```

---

## 11. Troubleshooting

### Agent keeps getting disabled

```bash
# Check DLQ for errors
curl http://localhost:3001/metrics | jq '.deadLetterQueue[] | select(.agentName == "agent-sales")'

# Check dependencies
curl http://localhost:3001/agent/agent-sales | jq '.dependencies'

# Check memory pressure
curl http://localhost:3001/metrics | jq '.system.memory.heapPercent'
# If >90%, your agent may be disabled (if priority=3)
```

### Agent not executing

```bash
# Check dependency health
curl http://localhost:3001/metrics | jq '.agents[] | select(.name == "agent-sales") | .status'

# Check if dependencies are healthy
curl http://localhost:3001/metrics | jq '.agents[] | select(.name == "agent-db") | .status'

# Check execution queue
curl http://localhost:3001/metrics | jq '.system.executionQueueSize'
```

### High memory usage

```bash
# 1. Check current usage
curl http://localhost:3001/metrics | jq '.system.memory'

# 2. Enable GC if not already
node --expose-gc orchestrator.js

# 3. Reduce low-priority agents
# Edit agent-registry.json, set priority=3 for non-critical agents

# 4. Check which agents are disabled
curl http://localhost:3001/metrics | jq '.agents[] | select(.status == "disabled_by_memory")'
```

---

## 12. Best Practices

### Agent Design

1. **Set appropriate priority**
   - Critical business logic: `priority: 1`
   - Important but not critical: `priority: 2`
   - Nice-to-have: `priority: 3`

2. **Declare all dependencies**
   - List in `dependencies` array
   - Orchestrator checks health before execution

3. **Handle timeouts gracefully**
   ```javascript
   try {
     const result = await messageBus.requestResponse('from', 'to', {}, 5000);
   } catch (err) {
     if (err.message.includes('timed out')) {
       // Handle timeout
     }
   }
   ```

4. **Use request-response for inter-agent communication**
   - Don't make HTTP calls between agents
   - Use message bus for type safety and timeout handling

5. **Monitor your agent's metrics**
   - Check p95/p99 latency regularly
   - Optimize if p99 > 5000ms

---

**Ready to use!** All features are backward compatible. No code changes required for existing agents.
