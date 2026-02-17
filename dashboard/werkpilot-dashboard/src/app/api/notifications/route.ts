/**
 * Notifications API Route
 *
 * GET    - List notifications with pagination, filtering by type/read
 * POST   - Create a new notification
 * PATCH  - Mark notifications as read (single or bulk)
 * DELETE - Delete notifications by IDs or older than X days
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

// ---------------------------------------------------------------------------
// GET - List notifications
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl;
    const type = url.searchParams.get('type');
    const readParam = url.searchParams.get('read');
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);

    const where: Record<string, unknown> = {};

    if (type) {
      // Support comma-separated types
      const types = type.split(',').map((t) => t.trim());
      where.type = types.length === 1 ? types[0] : { in: types };
    }

    if (readParam !== null && readParam !== undefined && readParam !== '') {
      where.read = readParam === 'true';
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);

    return NextResponse.json({
      notifications,
      total,
      page,
      limit,
      hasMore: page * limit < total,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST - Create notification
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { title, message, type, link } = body;

    if (!title || !message) {
      return NextResponse.json(
        { error: 'title and message are required' },
        { status: 400 }
      );
    }

    const validTypes = ['agent_alert', 'task_complete', 'lead_update', 'system', 'ai_insight'];
    const notifType = validTypes.includes(type) ? type : 'system';

    const notification = await prisma.notification.create({
      data: {
        title,
        message,
        type: notifType,
        link: link || null,
        read: false,
      },
    });

    return NextResponse.json(notification, { status: 201 });
  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json(
      { error: 'Failed to create notification' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH - Mark as read (single or bulk)
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { ids, all } = body;

    if (all) {
      // Mark all unread as read
      const result = await prisma.notification.updateMany({
        where: { read: false },
        data: { read: true },
      });
      return NextResponse.json({ updated: result.count });
    }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'ids array or { all: true } is required' },
        { status: 400 }
      );
    }

    const result = await prisma.notification.updateMany({
      where: { id: { in: ids } },
      data: { read: true },
    });

    return NextResponse.json({ updated: result.count });
  } catch (error) {
    console.error('Error updating notifications:', error);
    return NextResponse.json(
      { error: 'Failed to update notifications' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE - Delete notifications
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { ids, olderThanDays } = body;

    if (olderThanDays && typeof olderThanDays === 'number') {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - olderThanDays);

      const result = await prisma.notification.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });

      return NextResponse.json({ deleted: result.count });
    }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'ids array or olderThanDays number is required' },
        { status: 400 }
      );
    }

    const result = await prisma.notification.deleteMany({
      where: { id: { in: ids } },
    });

    return NextResponse.json({ deleted: result.count });
  } catch (error) {
    console.error('Error deleting notifications:', error);
    return NextResponse.json(
      { error: 'Failed to delete notifications' },
      { status: 500 }
    );
  }
}
