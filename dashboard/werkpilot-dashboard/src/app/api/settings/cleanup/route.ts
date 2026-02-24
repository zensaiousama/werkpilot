import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  if (action === 'delete_old_logs') {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const deleted = await prisma.agentLog.deleteMany({
      where: {
        createdAt: { lt: thirtyDaysAgo },
      },
    });

    return NextResponse.json({
      action,
      deleted: deleted.count,
      message: `${deleted.count} alte Logs geloescht`,
    });
  }

  if (action === 'delete_read_notifications') {
    const deleted = await prisma.notification.deleteMany({
      where: {
        read: true,
      },
    });

    return NextResponse.json({
      action,
      deleted: deleted.count,
      message: `${deleted.count} gelesene Benachrichtigungen geloescht`,
    });
  }

  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
}
