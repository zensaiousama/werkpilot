import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

/* ------------------------------------------------------------------ */
/*  POST  /api/mailing/send                                            */
/*  "Send" a campaign (simulate - update status, create email logs)    */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { campaignId } = body;

    /* ---- Direct email send (from CRM quick action) ---- */
    if (!campaignId && body.to && body.subject) {
      const emailLog = await prisma.emailLog.create({
        data: {
          leadId: body.leadId || null,
          to: body.to,
          subject: body.subject,
          status: 'sent',
        },
      });

      // Also log as activity if leadId provided
      if (body.leadId) {
        try {
          await prisma.activity.create({
            data: {
              leadId: body.leadId,
              type: 'email',
              details: `E-Mail gesendet: ${body.subject}`,
            },
          });
        } catch {
          // Activity logging is best-effort
        }
      }

      return NextResponse.json({
        emailLog,
        message: 'E-Mail erfolgreich gesendet',
      });
    }

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId or (to + subject) is required' }, { status: 400 });
    }

    // Fetch the campaign with its template
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        template: true,
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    if (campaign.status === 'sent' || campaign.status === 'sending') {
      return NextResponse.json(
        { error: `Campaign is already ${campaign.status}` },
        { status: 400 }
      );
    }

    // Parse recipient filter criteria
    let recipientFilter: Record<string, unknown> = {};
    try {
      const recipients = JSON.parse(campaign.recipients || '[]');
      if (Array.isArray(recipients) && recipients.length > 0) {
        // Recipients is an array of filter objects, e.g. [{status: "Contacted"}, {branche: "IT-Services"}]
        const statusFilters = recipients
          .filter((r: Record<string, string>) => r.status)
          .map((r: Record<string, string>) => r.status);
        const brancheFilters = recipients
          .filter((r: Record<string, string>) => r.branche)
          .map((r: Record<string, string>) => r.branche);
        const kantonFilters = recipients
          .filter((r: Record<string, string>) => r.kanton)
          .map((r: Record<string, string>) => r.kanton);

        const conditions: Record<string, unknown>[] = [];
        if (statusFilters.length > 0) conditions.push({ status: { in: statusFilters } });
        if (brancheFilters.length > 0) conditions.push({ branche: { in: brancheFilters } });
        if (kantonFilters.length > 0) conditions.push({ kanton: { in: kantonFilters } });

        if (conditions.length > 0) {
          recipientFilter = { AND: conditions };
        }
      }
    } catch {
      // If parsing fails, send to all leads with email
    }

    // Find matching leads with email addresses
    const leads = await prisma.lead.findMany({
      where: {
        ...recipientFilter,
        email: { not: null },
      },
      select: { id: true, email: true, firma: true },
      take: 500, // Safety limit
    });

    if (leads.length === 0) {
      return NextResponse.json(
        { error: 'No matching leads with email addresses found' },
        { status: 400 }
      );
    }

    // Update campaign status to "sending"
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'sending' },
    });

    // Create email log entries for each recipient (simulated send)
    const subject = campaign.template?.subject || `Campaign: ${campaign.name}`;
    const emailLogs = [];

    for (const lead of leads) {
      if (!lead.email) continue;

      // Simulate: 90% sent, 5% bounced, 5% failed
      const rand = Math.random();
      let status = 'sent';
      let bouncedAt = null;
      let error = null;

      if (rand > 0.95) {
        status = 'failed';
        error = 'Simulated delivery failure';
      } else if (rand > 0.90) {
        status = 'bounced';
        bouncedAt = new Date();
      }

      // Among sent emails, simulate some opens and clicks
      let openedAt = null;
      let clickedAt = null;
      if (status === 'sent') {
        if (Math.random() < 0.45) {
          openedAt = new Date(Date.now() + Math.random() * 86400000); // Opened within 24h
          if (Math.random() < 0.30) {
            clickedAt = new Date(openedAt.getTime() + Math.random() * 3600000); // Clicked within 1h of open
          }
        }
      }

      emailLogs.push({
        campaignId: campaign.id,
        leadId: lead.id,
        to: lead.email,
        subject,
        status: openedAt ? (clickedAt ? 'clicked' : 'opened') : status,
        openedAt,
        clickedAt,
        bouncedAt,
        error,
      });
    }

    // Batch create all email logs
    await prisma.emailLog.createMany({
      data: emailLogs,
    });

    // Calculate stats
    const sentCount = emailLogs.filter((e) => !['failed', 'bounced'].includes(e.status)).length;
    const openCount = emailLogs.filter((e) => ['opened', 'clicked'].includes(e.status)).length;
    const clickCount = emailLogs.filter((e) => e.status === 'clicked').length;
    const bounceCount = emailLogs.filter((e) => e.status === 'bounced').length;

    // Update campaign with final stats
    const updatedCampaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'sent',
        sentAt: new Date(),
        sentCount,
        openCount,
        clickCount,
        bounceCount,
      },
      include: {
        template: { select: { id: true, name: true, subject: true } },
      },
    });

    return NextResponse.json({
      campaign: updatedCampaign,
      emailsSent: emailLogs.length,
      stats: { sentCount, openCount, clickCount, bounceCount },
    });
  } catch (error) {
    console.error('[mailing/send/POST]', error);
    return NextResponse.json({ error: 'Failed to send campaign' }, { status: 500 });
  }
}
