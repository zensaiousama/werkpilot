# Orchestrator Upgrade Validation Checklist

Run through this checklist to verify all features are working correctly.

---

## Pre-Flight Checks

- [ ] File exists: `orchestrator.js` (1391 lines)
- [ ] Syntax valid: `node -c orchestrator.js` (no errors)
- [ ] Dependencies installed: `npm install` (node-cron, etc.)

---

## Feature Validation

### 1. Graceful Shutdown Handler

**Test steps:**
```bash
# Start orchestrator
node orchestrator.js

# In another terminal
kill -SIGTERM $(pgrep -f "node.*orchestrator")
```

**Expected results:**
- [ ] Logs show "Graceful Shutdown Initiated"
- [ ] 6-step shutdown sequence logged
- [ ] Waits up to 30s for running agents
- [ ] Dashboard server stops cleanly
- [ ] Exit code 0

---

### 2. Dead Letter Queue

**Test steps:**
```bash
# 1. Create a failing agent
cat > test-failing-agent.js << 'JS'
console.error('Intentional failure');
process.exit(1);
JS

# 2. Add to registry with maxRestarts: 1
# 3. Wait for it to fail
# 4. Check DLQ
curl http://localhost:3001/metrics | jq '.deadLetterQueue'
```

**Expected results:**
- [ ] Failed agent appears in DLQ
- [ ] Entry includes: agentName, error, timestamp, executionData
- [ ] DLQ size shown in dashboard
- [ ] Max 100 entries maintained

---

### 3. Agent Communication Protocol

**Test steps:**
```bash
# Create test agents
# Agent A: sends request
# Agent B: responds
# See API_EXAMPLES.md for code
```

**Expected results:**
- [ ] Request sent successfully
- [ ] Response received within timeout
- [ ] Timeout works if agent doesn't respond
- [ ] Error responses handled correctly

---

### 4. Memory Monitoring

**Test steps:**
```bash
# Start with GC enabled
node --expose-gc orchestrator.js

# Watch memory
watch 'curl -s http://localhost:3001/metrics | jq ".system.memory"'
```

**Expected results:**
- [ ] Memory checked every 60s
- [ ] heapPercent calculated correctly
- [ ] At 80%: GC triggered (if --expose-gc)
- [ ] At 90%: Low-priority agents disabled
- [ ] Memory events published to bus

**To test 90% threshold:**
```javascript
// Temporarily lower threshold in orchestrator.js
const MEMORY_CRITICAL_THRESHOLD = 50; // was 90
```

---

### 5. Agent Priority Queue

**Test steps:**
```bash
# Edit agent-registry.json
# Set different priorities (1, 2, 3)
# Schedule multiple agents at same time
# Check execution order in logs
```

**Expected results:**
- [ ] Priority 1 agents execute first
- [ ] Priority 2 agents execute second
- [ ] Priority 3 agents execute last
- [ ] Within same priority: dependency depth matters
- [ ] Queue size shown in dashboard

**Example agent configs:**
```json
{ "name": "critical", "priority": 1, "schedule": "*/1 * * * *" }
{ "name": "important", "priority": 2, "schedule": "*/1 * * * *" }
{ "name": "normal", "priority": 3, "schedule": "*/1 * * * *" }
```

---

### 6. Execution Metrics (p50, p95, p99)

**Test steps:**
```bash
# Let agents run for a while
# Check metrics
curl http://localhost:3001/metrics | jq '.metrics["agent-name"]'
```

**Expected results:**
- [ ] p50, p95, p99 values present
- [ ] Values are reasonable (p50 < p95 < p99)
- [ ] Only successful runs tracked
- [ ] Max 1000 samples kept
- [ ] Percentiles update after each run

---

### 7. Dependency Health Check

**Test steps:**
```bash
# 1. Create agent A with dependency on agent B
# 2. Disable agent B
# 3. Try to run agent A
# 4. Check logs
```

**Expected results:**
- [ ] Agent A execution skipped
- [ ] Log shows: "Skipping agent-a - dependencies unhealthy"
- [ ] Specific unhealthy deps listed
- [ ] Event published: `agent.dependencies.unhealthy`
- [ ] Performance recorded as failure with reason

---

## Integration Tests

### Dashboard Data

```bash
curl http://localhost:3001/metrics | jq
```

**Verify:**
- [ ] `system.executionQueueSize` present
- [ ] `system.deadLetterQueueSize` present
- [ ] `system.memory` object present
- [ ] Each agent has: `priority`, `dependencyDepth`, `p50`, `p95`, `p99`
- [ ] `deadLetterQueue` array present

---

### Message Bus

**Verify new topics:**
```bash
# In orchestrator logs, grep for:
grep "system.shutdown" logs/orchestrator/*.log
grep "system.memory" logs/orchestrator/*.log
grep "dlq.entry.added" logs/orchestrator/*.log
grep "agent.dependencies.unhealthy" logs/orchestrator/*.log
```

- [ ] system.shutdown events
- [ ] system.memory events
- [ ] dlq.entry.added events
- [ ] agent.dependencies.unhealthy events

---

### Backward Compatibility

**Verify existing features still work:**
- [ ] 4-layer boot sequence
- [ ] Cron scheduling
- [ ] Health checks every 5min
- [ ] Auto-restart with backoff
- [ ] Circuit breaker (50/hour)
- [ ] Nightly optimization (23:00)
- [ ] Performance scoring
- [ ] Dashboard port 3001

---

## Performance Tests

### Memory Impact

```bash
# Before upgrade: ~XMB
# After upgrade: ~(X+2)MB
ps aux | grep orchestrator | awk '{print $6/1024 "MB"}'
```

**Expected:**
- [ ] Memory increase < 5MB
- [ ] No memory leaks over 24h

---

### CPU Impact

```bash
top -p $(pgrep -f "node.*orchestrator")
```

**Expected:**
- [ ] CPU usage < 2% idle
- [ ] CPU spikes < 50% during execution

---

### Latency Impact

**Measure execution delay:**
- [ ] Priority queue insertion: < 5ms
- [ ] Dependency health check: < 2ms
- [ ] Total overhead per execution: < 10ms

---

## Error Handling

**Test failure scenarios:**

1. **Timeout in requestResponse**
   - [ ] Promise rejects after timeout
   - [ ] Pending request cleaned up

2. **Memory >90% with no priority 3 agents**
   - [ ] System continues (doesn't crash)
   - [ ] Logs warning but doesn't disable anything

3. **Circular request-response**
   - [ ] Timeout prevents deadlock
   - [ ] Error logged

4. **DLQ full (100 entries)**
   - [ ] Old entries removed
   - [ ] New entries added
   - [ ] No memory leak

---

## Regression Tests

**Verify no breaking changes:**

1. **Existing agent files work without modification**
   - [ ] Old agents boot successfully
   - [ ] Old agents execute successfully
   - [ ] No new required config fields

2. **Dashboard API unchanged**
   - [ ] GET /metrics still works
   - [ ] GET /agent/:name still works
   - [ ] Response includes old fields + new fields

3. **Message bus backward compatible**
   - [ ] Old topics still work
   - [ ] Old subscribe/publish still work
   - [ ] No breaking changes in API

---

## Production Readiness

- [ ] All tests pass
- [ ] No console.log (use logger)
- [ ] No TODO comments
- [ ] Documentation complete
- [ ] Examples tested
- [ ] Monitoring in place

---

## Final Sign-Off

**Validated by:** _______________

**Date:** _______________

**Version:** 2.0.0 (Production-Grade)

**Status:** ⬜ PASS  ⬜ FAIL

**Notes:**
```
(Add any issues, concerns, or observations here)
```

---

## Quick Debug Commands

```bash
# Check orchestrator is running
pgrep -f "node.*orchestrator" || echo "Not running"

# Check logs
tail -f logs/orchestrator/orchestrator-$(date +%Y-%m-%d).log

# Check metrics
curl -s http://localhost:3001/metrics | jq '.system'

# Check DLQ
curl -s http://localhost:3001/metrics | jq '.deadLetterQueue | length'

# Check memory
curl -s http://localhost:3001/metrics | jq '.system.memory.heapPercent'

# Check queue
curl -s http://localhost:3001/metrics | jq '.system.executionQueueSize'

# Force shutdown
kill -SIGTERM $(pgrep -f "node.*orchestrator")
```

---

**End of checklist.**
