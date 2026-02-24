import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  const [
    leads,
    invoices,
    followUps,
    campaigns,
    agents,
    agentLogs,
    notifications,
    activities,
    expenses,
    emailLogs,
    nightShiftTasks,
  ] = await Promise.all([
    prisma.lead.count(),
    prisma.invoice.count(),
    prisma.followUp.count(),
    prisma.campaign.count(),
    prisma.agent.count(),
    prisma.agentLog.count(),
    prisma.notification.count(),
    prisma.activity.count(),
    prisma.expense.count(),
    prisma.emailLog.count(),
    prisma.nightShiftTask.count(),
  ]);

  return NextResponse.json({
    leads,
    invoices,
    followUps,
    campaigns,
    agents,
    agentLogs,
    notifications,
    activities,
    expenses,
    emailLogs,
    nightShiftTasks,
  });
}
