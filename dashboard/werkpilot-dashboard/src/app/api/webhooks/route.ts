/**
 * Webhook CRUD API Routes
 * GET: List all webhooks
 * POST: Create new webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { randomBytes } from 'crypto';
import type { EventType } from '@/lib/events';

export async function GET() {
  try {
    const webhooks = await prisma.webhook.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      data: webhooks,
    });
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch webhooks',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, url, events, secret } = body;

    // Validation
    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Name is required and must be a string',
        },
        { status: 400 }
      );
    }

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'URL is required and must be a string',
        },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid URL format',
        },
        { status: 400 }
      );
    }

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Events must be a non-empty array',
        },
        { status: 400 }
      );
    }

    // Validate event types
    const validEvents: EventType[] = [
      'lead.created',
      'lead.updated',
      'lead.statusChanged',
      'agent.error',
      'agent.recovered',
      'nightshift.completed',
      'decision.made',
    ];

    const invalidEvents = events.filter((e) => !validEvents.includes(e));
    if (invalidEvents.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid event types: ${invalidEvents.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Generate secret if not provided
    const webhookSecret = secret || randomBytes(32).toString('hex');

    // Create webhook
    const webhook = await prisma.webhook.create({
      data: {
        name,
        url,
        events: Array.isArray(events) ? events.join(',') : events,
        secret: webhookSecret,
        active: true,
        failCount: 0,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: webhook,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating webhook:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create webhook',
      },
      { status: 500 }
    );
  }
}
