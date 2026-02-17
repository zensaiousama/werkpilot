/**
 * Event Log API Route
 * GET: Retrieve recent events with filtering
 */

import { NextRequest, NextResponse } from 'next/server';
import { eventSystem, type EventType } from '@/lib/events';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as EventType | null;
    const limitParam = searchParams.get('limit');

    // Parse limit with default of 100
    let limit = 100;
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0 && parsedLimit <= 1000) {
        limit = parsedLimit;
      }
    }

    // Validate event type if provided
    if (type) {
      const validEvents: EventType[] = [
        'lead.created',
        'lead.updated',
        'lead.statusChanged',
        'agent.error',
        'agent.recovered',
        'nightshift.completed',
        'decision.made',
      ];

      if (!validEvents.includes(type)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid event type: ${type}`,
          },
          { status: 400 }
        );
      }
    }

    // Get event history
    const events = eventSystem.getHistory(type || undefined, limit);

    // Get statistics
    const stats = {
      totalEvents: events.length,
      eventType: type || 'all',
      limit,
    };

    return NextResponse.json({
      success: true,
      data: events,
      stats,
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch events',
      },
      { status: 500 }
    );
  }
}
