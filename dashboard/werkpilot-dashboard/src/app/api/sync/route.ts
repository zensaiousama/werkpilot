/**
 * Dashboard Sync API Endpoint
 * Accepts bulk sync data from the agents orchestrator
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

interface AgentUpdate {
  name: string;
  dept: string;
  status: string;
  score?: number;
  tasksToday?: number;
  errorsToday?: number;
  lastRun?: string;
}

interface ExecutionUpdate {
  agentName: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  status: string;
  errorMessage?: string | null;
  tokensUsed?: number;
  model?: string | null;
}

interface TaskUpdate {
  taskId?: string;
  task: string;
  priority?: number;
  status?: string;
  agentName?: string;
  output?: string | null;
  durationMs?: number | null;
  tokensUsed?: number;
  completedAt?: string | null;
}

interface NotificationUpdate {
  title: string;
  message: string;
  type?: string;
  link?: string | null;
  read?: boolean;
}

interface SyncPayload {
  agents?: AgentUpdate[];
  executions?: ExecutionUpdate[];
  tasks?: TaskUpdate[];
  notifications?: NotificationUpdate[];
}

interface SyncResult {
  synced: {
    agents: number;
    executions: number;
    tasks: number;
    notifications: number;
  };
  errors: string[];
}

export async function POST(req: NextRequest) {
  try {
    const body: SyncPayload = await req.json();

    const result: SyncResult = {
      synced: {
        agents: 0,
        executions: 0,
        tasks: 0,
        notifications: 0
      },
      errors: []
    };

    // Process all sync operations in a transaction
    await prisma.$transaction(async (tx) => {
      // Sync agents
      if (body.agents && body.agents.length > 0) {
        for (const agent of body.agents) {
          try {
            await tx.agent.upsert({
              where: { name: agent.name },
              update: {
                status: agent.status,
                score: agent.score,
                tasksToday: agent.tasksToday,
                errorsToday: agent.errorsToday,
                lastRun: agent.lastRun ? new Date(agent.lastRun) : new Date()
              },
              create: {
                name: agent.name,
                dept: agent.dept,
                status: agent.status,
                score: agent.score || 0,
                tasksToday: agent.tasksToday || 0,
                errorsToday: agent.errorsToday || 0,
                lastRun: agent.lastRun ? new Date(agent.lastRun) : new Date()
              }
            });
            result.synced.agents++;
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            result.errors.push(`Agent sync error (${agent.name}): ${message}`);
          }
        }
      }

      // Log executions
      if (body.executions && body.executions.length > 0) {
        for (const execution of body.executions) {
          try {
            // Find the agent by name to get its ID
            const agent = await tx.agent.findUnique({
              where: { name: execution.agentName }
            });
            if (!agent) {
              result.errors.push(`Agent not found for execution: ${execution.agentName}`);
              continue;
            }
            await tx.agentExecution.create({
              data: {
                agentId: agent.id,
                startedAt: new Date(execution.startedAt),
                completedAt: execution.completedAt ? new Date(execution.completedAt) : undefined,
                durationMs: execution.durationMs,
                status: execution.status,
                errorMessage: execution.errorMessage,
                tokensUsed: execution.tokensUsed || 0,
                model: execution.model,
              }
            });
            result.synced.executions++;
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            result.errors.push(`Execution log error (${execution.agentName}): ${message}`);
          }
        }
      }

      // Sync tasks (NightShiftTask)
      if (body.tasks && body.tasks.length > 0) {
        for (const task of body.tasks) {
          try {
            if (task.taskId) {
              await tx.nightShiftTask.update({
                where: { id: task.taskId },
                data: {
                  status: task.status,
                  output: task.output,
                  durationMs: task.durationMs,
                  tokensUsed: task.tokensUsed || 0,
                  completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
                }
              });
            } else {
              await tx.nightShiftTask.create({
                data: {
                  task: task.task,
                  priority: task.priority || 1,
                  status: task.status || 'pending',
                  agentName: task.agentName,
                  tokensUsed: task.tokensUsed || 0,
                }
              });
            }
            result.synced.tasks++;
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            result.errors.push(`Task sync error (${task.taskId || 'new'}): ${message}`);
          }
        }
      }

      // Create notifications
      if (body.notifications && body.notifications.length > 0) {
        for (const notification of body.notifications) {
          try {
            await tx.notification.create({
              data: {
                title: notification.title,
                message: notification.message,
                type: notification.type || 'info',
                link: notification.link,
                read: notification.read || false,
              }
            });
            result.synced.notifications++;
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            result.errors.push(`Notification error (${notification.title}): ${message}`);
          }
        }
      }
    });

    console.log('[Sync API] Sync completed:', result.synced);

    if (result.errors.length > 0) {
      console.warn('[Sync API] Sync completed with errors:', result.errors);
    }

    return NextResponse.json(result, { status: 200 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Sync API] Sync failed:', error);
    return NextResponse.json(
      {
        error: 'Sync failed',
        message,
        synced: {
          agents: 0,
          executions: 0,
          tasks: 0,
          notifications: 0
        }
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { status: 'error', message },
      { status: 503 }
    );
  }
}
