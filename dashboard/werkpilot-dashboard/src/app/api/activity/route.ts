/**
 * Unified Activity Feed API
 *
 * GET /api/activity
 *
 * Returns a chronologically sorted, unified activity feed that merges events
 * from across all modules: Lead Activities, Email Logs, Invoices, Follow-Ups,
 * and Notifications.
 *
 * Query params:
 *   - limit  (number, default 20, max 100)
 *   - type   (optional filter: 'lead_activity' | 'email' | 'invoice' | 'follow_up' | 'notification')
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EventType = 'lead_activity' | 'email' | 'invoice' | 'follow_up' | 'notification';

interface ActivityEvent {
  id: string;
  type: EventType;
  action: string;
  title: string;
  description: string;
  color: string;
  icon: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Helpers: map raw DB rows to unified ActivityEvent
// ---------------------------------------------------------------------------

function mapLeadActivities(
  activities: Array<{
    id: string;
    type: string;
    details: string | null;
    createdAt: Date;
    lead: { firma: string; status: string } | null;
  }>,
): ActivityEvent[] {
  return activities.map((a) => {
    const actionMap: Record<string, string> = {
      call: 'lead_called',
      email: 'lead_emailed',
      meeting: 'lead_meeting',
      note: 'lead_note_added',
      status_change: 'lead_status_changed',
    };
    const action = actionMap[a.type] || `lead_${a.type}`;

    const iconMap: Record<string, string> = {
      call: 'phone',
      email: 'mail',
      meeting: 'calendar',
      note: 'file-text',
      status_change: 'arrow-right-left',
    };
    const icon = iconMap[a.type] || 'activity';

    const colorMap: Record<string, string> = {
      call: 'var(--blue)',
      email: 'var(--violet)',
      meeting: 'var(--amber)',
      note: 'var(--slate)',
      status_change: 'var(--green)',
    };
    const color = colorMap[a.type] || 'var(--blue)';

    return {
      id: a.id,
      type: 'lead_activity' as const,
      action,
      title: `${a.lead?.firma ?? 'Unknown'} - ${a.type}`,
      description: a.details || `Activity "${a.type}" recorded`,
      color,
      icon,
      timestamp: a.createdAt.toISOString(),
      metadata: {
        leadFirma: a.lead?.firma ?? null,
        leadStatus: a.lead?.status ?? null,
        activityType: a.type,
      },
    };
  });
}

function mapEmailLogs(
  emails: Array<{
    id: string;
    to: string;
    subject: string;
    status: string;
    openedAt: Date | null;
    clickedAt: Date | null;
    createdAt: Date;
    campaign: { id: string; name: string } | null;
  }>,
): ActivityEvent[] {
  return emails.map((e) => {
    let action: string;
    let description: string;
    let color: string;
    let icon: string;
    let timestamp: Date;

    if (e.clickedAt) {
      action = 'email_clicked';
      description = `"${e.subject}" to ${e.to} was clicked`;
      color = 'var(--green)';
      icon = 'mouse-pointer-click';
      timestamp = e.clickedAt;
    } else if (e.openedAt) {
      action = 'email_opened';
      description = `"${e.subject}" to ${e.to} was opened`;
      color = 'var(--blue)';
      icon = 'mail-open';
      timestamp = e.openedAt;
    } else if (e.status === 'bounced') {
      action = 'email_bounced';
      description = `"${e.subject}" to ${e.to} bounced`;
      color = 'var(--red)';
      icon = 'mail-x';
      timestamp = e.createdAt;
    } else {
      action = 'email_sent';
      description = `"${e.subject}" sent to ${e.to}`;
      color = 'var(--violet)';
      icon = 'send';
      timestamp = e.createdAt;
    }

    return {
      id: e.id,
      type: 'email' as const,
      action,
      title: `Email: ${e.subject}`,
      description,
      color,
      icon,
      timestamp: timestamp.toISOString(),
      metadata: {
        to: e.to,
        subject: e.subject,
        status: e.status,
        campaignId: e.campaign?.id ?? null,
        campaignName: e.campaign?.name ?? null,
      },
    };
  });
}

function mapInvoices(
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    clientName: string;
    total: number;
    currency: string;
    status: string;
    paidAt: Date | null;
    createdAt: Date;
  }>,
): ActivityEvent[] {
  return invoices.map((inv) => {
    const isPaid = inv.status === 'paid' && inv.paidAt;

    const action = isPaid ? 'invoice_paid' : 'invoice_created';
    const title = isPaid
      ? `Invoice ${inv.invoiceNumber} paid`
      : `Invoice ${inv.invoiceNumber} created`;
    const description = isPaid
      ? `${inv.clientName} paid ${inv.currency} ${inv.total.toFixed(2)}`
      : `Invoice for ${inv.clientName} - ${inv.currency} ${inv.total.toFixed(2)}`;
    const color = isPaid ? 'var(--green)' : 'var(--amber)';
    const icon = isPaid ? 'circle-check' : 'file-text';
    const timestamp = isPaid ? inv.paidAt! : inv.createdAt;

    return {
      id: inv.id,
      type: 'invoice' as const,
      action,
      title,
      description,
      color,
      icon,
      timestamp: timestamp.toISOString(),
      metadata: {
        invoiceNumber: inv.invoiceNumber,
        clientName: inv.clientName,
        total: inv.total,
        currency: inv.currency,
        status: inv.status,
      },
    };
  });
}

function mapFollowUps(
  followUps: Array<{
    id: string;
    leadId: string;
    type: string;
    subject: string;
    status: string;
    priority: number;
    completedAt: Date | null;
    createdAt: Date;
  }>,
): ActivityEvent[] {
  return followUps.map((f) => {
    const isCompleted = f.status === 'completed' && f.completedAt;

    const action = isCompleted ? 'follow_up_completed' : 'follow_up_created';
    const title = isCompleted
      ? `Follow-up completed: ${f.subject}`
      : `Follow-up created: ${f.subject}`;
    const description = isCompleted
      ? `${f.type} follow-up "${f.subject}" was completed`
      : `New ${f.type} follow-up "${f.subject}" scheduled`;
    const color = isCompleted ? 'var(--green)' : 'var(--orange)';
    const icon = isCompleted ? 'check-circle' : 'clock';
    const timestamp = isCompleted ? f.completedAt! : f.createdAt;

    return {
      id: f.id,
      type: 'follow_up' as const,
      action,
      title,
      description,
      color,
      icon,
      timestamp: timestamp.toISOString(),
      metadata: {
        leadId: f.leadId,
        followUpType: f.type,
        status: f.status,
        priority: f.priority,
      },
    };
  });
}

function mapNotifications(
  notifications: Array<{
    id: string;
    title: string;
    message: string;
    type: string;
    read: boolean;
    link: string | null;
    createdAt: Date;
  }>,
): ActivityEvent[] {
  const colorMap: Record<string, string> = {
    agent_alert: 'var(--red)',
    task_complete: 'var(--green)',
    lead_update: 'var(--blue)',
    system: 'var(--slate)',
    ai_insight: 'var(--violet)',
    info: 'var(--blue)',
    warning: 'var(--amber)',
    error: 'var(--red)',
  };

  const iconMap: Record<string, string> = {
    agent_alert: 'alert-triangle',
    task_complete: 'check-circle',
    lead_update: 'user',
    system: 'settings',
    ai_insight: 'sparkles',
    info: 'info',
    warning: 'alert-triangle',
    error: 'x-circle',
  };

  return notifications.map((n) => ({
    id: n.id,
    type: 'notification' as const,
    action: `notification_${n.type}`,
    title: n.title,
    description: n.message,
    color: colorMap[n.type] || 'var(--slate)',
    icon: iconMap[n.type] || 'bell',
    timestamp: n.createdAt.toISOString(),
    metadata: {
      notificationType: n.type,
      read: n.read,
      link: n.link,
    },
  }));
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl;
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get('limit') || '20', 10) || 20, 1),
      100,
    );
    const typeFilter = url.searchParams.get('type') as EventType | null;

    // Validate type filter
    const validTypes: EventType[] = [
      'lead_activity',
      'email',
      'invoice',
      'follow_up',
      'notification',
    ];
    if (typeFilter && !validTypes.includes(typeFilter)) {
      return NextResponse.json(
        {
          error: `Invalid type filter. Must be one of: ${validTypes.join(', ')}`,
        },
        { status: 400 },
      );
    }

    // Fetch a generous amount from each source so we can merge and trim.
    // When a type filter is set, only query that source.
    const fetchLimit = limit + 10; // slight overfetch for merging headroom

    const queries: Array<Promise<ActivityEvent[]>> = [];

    // 1. Lead Activities
    if (!typeFilter || typeFilter === 'lead_activity') {
      queries.push(
        prisma.activity
          .findMany({
            orderBy: { createdAt: 'desc' },
            take: fetchLimit,
            select: {
              id: true,
              type: true,
              details: true,
              createdAt: true,
              lead: { select: { firma: true, status: true } },
            },
          })
          .then(mapLeadActivities),
      );
    }

    // 2. Email Logs
    if (!typeFilter || typeFilter === 'email') {
      queries.push(
        prisma.emailLog
          .findMany({
            orderBy: { createdAt: 'desc' },
            take: fetchLimit,
            include: {
              campaign: { select: { id: true, name: true } },
            },
          })
          .then(mapEmailLogs),
      );
    }

    // 3. Invoices (recent created + recently paid)
    if (!typeFilter || typeFilter === 'invoice') {
      queries.push(
        prisma.invoice
          .findMany({
            orderBy: { createdAt: 'desc' },
            take: fetchLimit,
            select: {
              id: true,
              invoiceNumber: true,
              clientName: true,
              total: true,
              currency: true,
              status: true,
              paidAt: true,
              createdAt: true,
            },
          })
          .then(mapInvoices),
      );
    }

    // 4. Follow-Ups (recently completed + recently created)
    if (!typeFilter || typeFilter === 'follow_up') {
      queries.push(
        prisma.followUp
          .findMany({
            orderBy: { createdAt: 'desc' },
            take: fetchLimit,
            select: {
              id: true,
              leadId: true,
              type: true,
              subject: true,
              status: true,
              priority: true,
              completedAt: true,
              createdAt: true,
            },
          })
          .then(mapFollowUps),
      );
    }

    // 5. Notifications
    if (!typeFilter || typeFilter === 'notification') {
      queries.push(
        prisma.notification
          .findMany({
            orderBy: { createdAt: 'desc' },
            take: fetchLimit,
          })
          .then(mapNotifications),
      );
    }

    // Execute all queries in parallel
    const results = await Promise.all(queries);

    // Merge all events into a single array, sort by timestamp descending, and trim
    const events: ActivityEvent[] = results
      .flat()
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    return NextResponse.json({ events });
  } catch (error) {
    console.error('Error fetching activity feed:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch activity feed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
