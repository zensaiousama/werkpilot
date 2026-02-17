/**
 * Single Webhook API Routes
 * GET: Get webhook details
 * PATCH: Update webhook
 * DELETE: Remove webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { EventType } from '@/lib/events';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const webhook = await prisma.webhook.findUnique({
      where: { id },
    });

    if (!webhook) {
      return NextResponse.json(
        {
          success: false,
          error: 'Webhook not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: webhook,
    });
  } catch (error) {
    console.error('Error fetching webhook:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch webhook',
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { name, url, events, active } = body;

    // Check if webhook exists
    const existingWebhook = await prisma.webhook.findUnique({
      where: { id },
    });

    if (!existingWebhook) {
      return NextResponse.json(
        {
          success: false,
          error: 'Webhook not found',
        },
        { status: 404 }
      );
    }

    // Validate URL if provided
    if (url) {
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
    }

    // Validate events if provided
    if (events) {
      if (!Array.isArray(events) || events.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'Events must be a non-empty array',
          },
          { status: 400 }
        );
      }

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
    }

    // Build update data
    const updateData: {
      name?: string;
      url?: string;
      events?: string;
      active?: boolean;
    } = {};

    if (name !== undefined) updateData.name = name;
    if (url !== undefined) updateData.url = url;
    if (events !== undefined) updateData.events = events.join(',');
    if (active !== undefined) updateData.active = active;

    // Update webhook
    const webhook = await prisma.webhook.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: webhook,
    });
  } catch (error) {
    console.error('Error updating webhook:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update webhook',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    // Check if webhook exists
    const existingWebhook = await prisma.webhook.findUnique({
      where: { id },
    });

    if (!existingWebhook) {
      return NextResponse.json(
        {
          success: false,
          error: 'Webhook not found',
        },
        { status: 404 }
      );
    }

    // Delete webhook
    await prisma.webhook.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Webhook deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting webhook:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete webhook',
      },
      { status: 500 }
    );
  }
}
