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
    prisma.lead.findMany({ include: { activities: true } }),
    prisma.invoice.findMany({ include: { payments: true } }),
    prisma.followUp.findMany(),
    prisma.campaign.findMany({ include: { emails: true } }),
    prisma.agent.findMany({ include: { logs: true, executions: true } }),
    prisma.agentLog.findMany(),
    prisma.notification.findMany(),
    prisma.activity.findMany(),
    prisma.expense.findMany(),
    prisma.emailLog.findMany(),
    prisma.nightShiftTask.findMany(),
  ]);

  const exportData = {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    data: {
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
    },
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="werkpilot-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
