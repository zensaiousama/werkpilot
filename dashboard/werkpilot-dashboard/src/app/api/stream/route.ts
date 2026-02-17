/**
 * Server-Sent Events (SSE) endpoint for real-time dashboard updates
 *
 * Events emitted:
 * - agent_status_change: When an agent's status changes
 * - new_lead: When a new lead is created
 * - task_completed: When a NightShift task completes
 * - notification: When a new notification is created
 *
 * Keep-alive: Every 30 seconds to prevent connection timeout
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/db';

// Track active connections for cleanup
const connections = new Set<ReadableStreamDefaultController>();

// Polling interval for database changes
const POLL_INTERVAL = 15000; // 15 seconds
const KEEP_ALIVE_INTERVAL = 30000; // 30 seconds

interface SSEEvent {
  event: 'agent_status_change' | 'new_lead' | 'task_completed' | 'notification' | 'ping';
  data: Record<string, unknown>;
  timestamp: string;
}

let lastAgentCheck = new Date();
let lastLeadCheck = new Date();
let lastTaskCheck = new Date();
let lastNotificationCheck = new Date();

function sendEvent(controller: ReadableStreamDefaultController, event: SSEEvent) {
  try {
    const message = `event: ${event.event}\ndata: ${JSON.stringify({ ...event.data, timestamp: event.timestamp })}\n\n`;
    controller.enqueue(new TextEncoder().encode(message));
  } catch (error) {
    console.error('Error sending SSE event:', error);
  }
}

async function checkForUpdates(controller: ReadableStreamDefaultController) {
  try {
    const now = new Date();

    // Check for agent status changes
    const agentLogs = await prisma.agentLog.findMany({
      where: {
        createdAt: { gt: lastAgentCheck },
        level: { in: ['info', 'error'] },
        message: { contains: 'status' }
      },
      include: { agent: true },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    for (const log of agentLogs) {
      sendEvent(controller, {
        event: 'agent_status_change',
        data: {
          agentId: log.agent.id,
          agentName: log.agent.name,
          status: log.agent.status,
          message: log.message
        },
        timestamp: log.createdAt.toISOString()
      });
    }
    if (agentLogs.length > 0) lastAgentCheck = now;

    // Check for new leads
    const newLeads = await prisma.lead.findMany({
      where: { createdAt: { gt: lastLeadCheck } },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    for (const lead of newLeads) {
      sendEvent(controller, {
        event: 'new_lead',
        data: {
          id: lead.id,
          firma: lead.firma,
          status: lead.status,
          leadScore: lead.leadScore,
          umsatzpotenzial: lead.umsatzpotenzial
        },
        timestamp: lead.createdAt.toISOString()
      });
    }
    if (newLeads.length > 0) lastLeadCheck = now;

    // Check for completed tasks
    const completedTasks = await prisma.nightShiftTask.findMany({
      where: {
        completedAt: { gt: lastTaskCheck },
        status: 'done'
      },
      orderBy: { completedAt: 'desc' },
      take: 10
    });

    for (const task of completedTasks) {
      sendEvent(controller, {
        event: 'task_completed',
        data: {
          id: task.id,
          task: task.task,
          agentName: task.agentName,
          durationMs: task.durationMs,
          tokensUsed: task.tokensUsed
        },
        timestamp: task.completedAt?.toISOString() || task.createdAt.toISOString()
      });
    }
    if (completedTasks.length > 0) lastTaskCheck = now;

    // Check for new notifications
    const newNotifications = await prisma.notification.findMany({
      where: { createdAt: { gt: lastNotificationCheck } },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    for (const notification of newNotifications) {
      sendEvent(controller, {
        event: 'notification',
        data: {
          id: notification.id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          link: notification.link
        },
        timestamp: notification.createdAt.toISOString()
      });
    }
    if (newNotifications.length > 0) lastNotificationCheck = now;

  } catch (error) {
    console.error('Error checking for updates:', error);
  }
}

export async function GET(req: NextRequest) {
  // Set up SSE headers
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Add to active connections
      connections.add(controller);

      // Send initial connection message
      sendEvent(controller, {
        event: 'ping',
        data: { message: 'Connected to real-time updates' },
        timestamp: new Date().toISOString()
      });

      // Poll for database changes
      const pollInterval = setInterval(async () => {
        if (controller.desiredSize === null) {
          clearInterval(pollInterval);
          return;
        }
        await checkForUpdates(controller);
      }, POLL_INTERVAL);

      // Keep-alive ping
      const keepAliveInterval = setInterval(() => {
        if (controller.desiredSize === null) {
          clearInterval(keepAliveInterval);
          return;
        }
        sendEvent(controller, {
          event: 'ping',
          data: { message: 'keep-alive' },
          timestamp: new Date().toISOString()
        });
      }, KEEP_ALIVE_INTERVAL);

      // Cleanup on connection close
      req.signal.addEventListener('abort', () => {
        clearInterval(pollInterval);
        clearInterval(keepAliveInterval);
        connections.delete(controller);
        try {
          controller.close();
        } catch (error) {
          // Controller may already be closed
        }
      });
    },

    cancel() {
      // Connection closed by client
      connections.delete(this as unknown as ReadableStreamDefaultController);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}

// Cleanup on module unload
if (typeof process !== 'undefined') {
  process.on('SIGTERM', () => {
    connections.forEach(controller => {
      try {
        controller.close();
      } catch (error) {
        // Ignore errors during shutdown
      }
    });
    connections.clear();
  });
}
