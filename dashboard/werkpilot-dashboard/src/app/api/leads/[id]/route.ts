import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { activities: { orderBy: { createdAt: 'desc' } } },
  });
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(lead);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const oldLead = await prisma.lead.findUnique({ where: { id } });
  if (!oldLead) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const lead = await prisma.lead.update({ where: { id }, data: body });

  if (body.status && body.status !== oldLead.status) {
    await prisma.activity.create({
      data: {
        leadId: id,
        type: 'status_change',
        details: `Status: ${oldLead.status} → ${body.status}`,
      },
    });
  }

  if (body.notizen && body.notizen !== oldLead.notizen) {
    await prisma.activity.create({
      data: { leadId: id, type: 'note', details: body.notizen },
    });
  }

  return NextResponse.json(lead);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.lead.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
