import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

/* ------------------------------------------------------------------ */
/*  GET  — List follow-ups with filters, sequences, and stats          */
/* ------------------------------------------------------------------ */

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const view = url.searchParams.get('view'); // 'sequences' | 'stats' | null (default: follow-ups)

  /* ---------- Sequences view ---------- */
  if (view === 'sequences') {
    const sequences = await prisma.followUpSequence.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({
      sequences: sequences.map((s) => ({
        ...s,
        steps: JSON.parse(s.steps),
      })),
    });
  }

  /* ---------- Stats view ---------- */
  if (view === 'stats') {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const weekEnd = new Date(todayStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const [dueToday, overdue, thisWeek, completed, total] = await Promise.all([
      prisma.followUp.count({
        where: {
          status: 'pending',
          dueDate: { gte: todayStart, lt: tomorrowStart },
        },
      }),
      prisma.followUp.count({
        where: {
          status: 'pending',
          dueDate: { lt: todayStart },
        },
      }),
      prisma.followUp.count({
        where: {
          status: 'pending',
          dueDate: { gte: todayStart, lt: weekEnd },
        },
      }),
      prisma.followUp.count({ where: { status: 'completed' } }),
      prisma.followUp.count(),
    ]);

    // Completion rate
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Average time to completion (in hours)
    const completedFollowUps = await prisma.followUp.findMany({
      where: { status: 'completed', completedAt: { not: null } },
      select: { createdAt: true, completedAt: true },
      take: 100,
      orderBy: { completedAt: 'desc' },
    });

    let avgResponseHours = 0;
    if (completedFollowUps.length > 0) {
      const totalHours = completedFollowUps.reduce((sum, f) => {
        if (!f.completedAt) return sum;
        const diffMs = new Date(f.completedAt).getTime() - new Date(f.createdAt).getTime();
        return sum + diffMs / (1000 * 60 * 60);
      }, 0);
      avgResponseHours = Math.round(totalHours / completedFollowUps.length);
    }

    // Most active leads (most follow-ups)
    const allFollowUps = await prisma.followUp.findMany({
      select: { leadId: true },
    });
    const leadCounts: Record<string, number> = {};
    for (const f of allFollowUps) {
      leadCounts[f.leadId] = (leadCounts[f.leadId] || 0) + 1;
    }
    const topLeadIds = Object.entries(leadCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({ id, count }));

    const topLeads = await prisma.lead.findMany({
      where: { id: { in: topLeadIds.map((l) => l.id) } },
      select: { id: true, firma: true, kontakt: true, status: true },
    });

    const mostActiveLeads = topLeadIds.map((tl) => {
      const lead = topLeads.find((l) => l.id === tl.id);
      return {
        id: tl.id,
        firma: lead?.firma || 'Unbekannt',
        kontakt: lead?.kontakt || null,
        status: lead?.status || 'Unknown',
        followUpCount: tl.count,
      };
    });

    // Type breakdown
    const allForTypes = await prisma.followUp.findMany({
      select: { type: true, status: true },
    });
    const typeBreakdown: Record<string, { total: number; completed: number }> = {};
    for (const f of allForTypes) {
      if (!typeBreakdown[f.type]) typeBreakdown[f.type] = { total: 0, completed: 0 };
      typeBreakdown[f.type].total++;
      if (f.status === 'completed') typeBreakdown[f.type].completed++;
    }

    return NextResponse.json({
      stats: {
        dueToday,
        overdue,
        thisWeek,
        completed,
        total,
        completionRate,
        avgResponseHours,
        mostActiveLeads,
        typeBreakdown,
      },
    });
  }

  /* ---------- Default: List follow-ups ---------- */
  const status = url.searchParams.get('status');
  const priority = url.searchParams.get('priority');
  const leadId = url.searchParams.get('leadId');
  const search = url.searchParams.get('search');
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '50');

  const where: Record<string, unknown> = {};
  if (status) {
    const statuses = status.split(',');
    where.status = statuses.length === 1 ? statuses[0] : { in: statuses };
  }
  if (priority) {
    where.priority = parseInt(priority);
  }
  if (leadId) {
    where.leadId = leadId;
  }
  if (search) {
    where.OR = [
      { subject: { contains: search } },
      { message: { contains: search } },
      { notes: { contains: search } },
    ];
  }

  const [followUps, total] = await Promise.all([
    prisma.followUp.findMany({
      where,
      orderBy: { dueDate: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.followUp.count({ where }),
  ]);

  // Enrich with lead info
  const leadIds = [...new Set(followUps.map((f) => f.leadId))];
  const leads = await prisma.lead.findMany({
    where: { id: { in: leadIds } },
    select: { id: true, firma: true, kontakt: true, email: true, telefon: true, status: true },
  });
  const leadMap = new Map(leads.map((l) => [l.id, l]));

  const enriched = followUps.map((f) => ({
    ...f,
    lead: leadMap.get(f.leadId) || null,
  }));

  return NextResponse.json({ followUps: enriched, total, page, limit });
}

/* ------------------------------------------------------------------ */
/*  POST — Create a follow-up or a sequence                            */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest) {
  const body = await req.json();

  /* ---------- Create Sequence ---------- */
  if (body.type === 'sequence') {
    const sequence = await prisma.followUpSequence.create({
      data: {
        name: body.name,
        description: body.description || null,
        steps: JSON.stringify(body.steps || []),
        trigger: body.trigger || 'manual',
        active: body.active !== undefined ? body.active : true,
      },
    });
    return NextResponse.json(
      { ...sequence, steps: JSON.parse(sequence.steps) },
      { status: 201 }
    );
  }

  /* ---------- Create Follow-Up ---------- */
  if (!body.leadId || !body.subject || !body.dueDate) {
    return NextResponse.json(
      { error: 'leadId, subject, and dueDate are required' },
      { status: 400 }
    );
  }

  // Verify lead exists
  const lead = await prisma.lead.findUnique({ where: { id: body.leadId } });
  if (!lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  const followUp = await prisma.followUp.create({
    data: {
      leadId: body.leadId,
      type: body.type || body.followUpType || 'email',
      subject: body.subject,
      message: body.message || null,
      status: 'pending',
      priority: body.priority || 2,
      dueDate: new Date(body.dueDate),
      assignedTo: body.assignedTo || null,
      sequence: body.sequence || null,
      stepNumber: body.stepNumber || 1,
      notes: body.notes || null,
    },
  });

  return NextResponse.json(followUp, { status: 201 });
}

/* ------------------------------------------------------------------ */
/*  PATCH — Update a follow-up (complete, reschedule, skip, toggle seq)*/
/* ------------------------------------------------------------------ */

export async function PATCH(req: NextRequest) {
  const body = await req.json();

  /* ---------- Toggle Sequence Active ---------- */
  if (body.entityType === 'sequence' && body.id) {
    const existing = await prisma.followUpSequence.findUnique({ where: { id: body.id } });
    if (!existing) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    }
    const updated = await prisma.followUpSequence.update({
      where: { id: body.id },
      data: {
        active: body.active !== undefined ? body.active : !existing.active,
        ...(body.name ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.steps ? { steps: JSON.stringify(body.steps) } : {}),
        ...(body.trigger ? { trigger: body.trigger } : {}),
      },
    });
    return NextResponse.json({ ...updated, steps: JSON.parse(updated.steps) });
  }

  /* ---------- Update Follow-Up ---------- */
  if (!body.id) {
    return NextResponse.json({ error: 'Follow-up ID is required' }, { status: 400 });
  }

  const existing = await prisma.followUp.findUnique({ where: { id: body.id } });
  if (!existing) {
    return NextResponse.json({ error: 'Follow-up not found' }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};

  // Action: complete
  if (body.action === 'complete') {
    updateData.status = 'completed';
    updateData.completedAt = new Date();
  }

  // Action: reschedule
  if (body.action === 'reschedule') {
    if (!body.newDueDate) {
      return NextResponse.json({ error: 'newDueDate is required for reschedule' }, { status: 400 });
    }
    updateData.dueDate = new Date(body.newDueDate);
    updateData.status = 'pending';
    if (body.notes) updateData.notes = body.notes;
  }

  // Action: skip
  if (body.action === 'skip') {
    updateData.status = 'skipped';
  }

  // Generic field updates
  if (body.status && !body.action) updateData.status = body.status;
  if (body.priority) updateData.priority = body.priority;
  if (body.subject) updateData.subject = body.subject;
  if (body.message !== undefined) updateData.message = body.message;
  if (body.notes !== undefined) updateData.notes = body.notes;

  const updated = await prisma.followUp.update({
    where: { id: body.id },
    data: updateData,
  });

  return NextResponse.json(updated);
}
