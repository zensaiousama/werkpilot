import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

/* ------------------------------------------------------------------ */
/*  GET  /api/mailing                                                  */
/*  Returns campaigns (with stats), templates, and recent email logs   */
/* ------------------------------------------------------------------ */

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const view = url.searchParams.get('view'); // 'campaigns' | 'templates' | 'emails' | null (all)

  try {
    // --- Campaigns -----------------------------------------------------------
    let campaigns = null;
    if (!view || view === 'campaigns') {
      campaigns = await prisma.campaign.findMany({
        include: {
          template: { select: { id: true, name: true, subject: true } },
          _count: { select: { emails: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    // --- Templates -----------------------------------------------------------
    let templates = null;
    if (!view || view === 'templates') {
      templates = await prisma.emailTemplate.findMany({
        include: {
          _count: { select: { campaigns: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    // --- Email Logs ----------------------------------------------------------
    let emails = null;
    if (!view || view === 'emails') {
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');

      emails = await prisma.emailLog.findMany({
        include: {
          campaign: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      });
    }

    // --- Stats ---------------------------------------------------------------
    let stats = null;
    if (!view || view === 'campaigns') {
      const [totalCampaigns, totalTemplates, totalEmails, sentEmails, openedEmails, clickedEmails, bouncedEmails] =
        await Promise.all([
          prisma.campaign.count(),
          prisma.emailTemplate.count(),
          prisma.emailLog.count(),
          prisma.emailLog.count({ where: { status: 'sent' } }),
          prisma.emailLog.count({ where: { status: 'opened' } }),
          prisma.emailLog.count({ where: { status: 'clicked' } }),
          prisma.emailLog.count({ where: { status: 'bounced' } }),
        ]);

      const delivered = sentEmails + openedEmails + clickedEmails;
      stats = {
        totalCampaigns,
        totalTemplates,
        totalEmails,
        sentEmails,
        openedEmails,
        clickedEmails,
        bouncedEmails,
        openRate: delivered > 0 ? ((openedEmails + clickedEmails) / delivered) * 100 : 0,
        clickRate: delivered > 0 ? (clickedEmails / delivered) * 100 : 0,
      };
    }

    return NextResponse.json({ campaigns, templates, emails, stats });
  } catch (error) {
    console.error('[mailing/GET]', error);
    return NextResponse.json({ error: 'Failed to fetch mailing data' }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ */
/*  POST  /api/mailing                                                 */
/*  Create a campaign or template (distinguished by `type` field)      */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type } = body;

    // --- Create Campaign -----------------------------------------------------
    if (type === 'campaign') {
      const { name, templateId, recipients, scheduledAt } = body;

      if (!name) {
        return NextResponse.json({ error: 'Campaign name is required' }, { status: 400 });
      }

      const campaign = await prisma.campaign.create({
        data: {
          name,
          templateId: templateId || null,
          recipients: recipients ? JSON.stringify(recipients) : '[]',
          status: scheduledAt ? 'scheduled' : 'draft',
          scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        },
        include: {
          template: { select: { id: true, name: true, subject: true } },
        },
      });

      return NextResponse.json(campaign, { status: 201 });
    }

    // --- Create Template -----------------------------------------------------
    if (type === 'template') {
      const { name, subject, body: templateBody, category, variables } = body;

      if (!name || !subject || !templateBody) {
        return NextResponse.json(
          { error: 'Template name, subject, and body are required' },
          { status: 400 }
        );
      }

      const template = await prisma.emailTemplate.create({
        data: {
          name,
          subject,
          body: templateBody,
          category: category || 'general',
          variables: variables ? JSON.stringify(variables) : '[]',
        },
      });

      return NextResponse.json(template, { status: 201 });
    }

    // --- Toggle Template Active -----------------------------------------------
    if (type === 'toggle-template') {
      const { templateId, active } = body;

      if (!templateId) {
        return NextResponse.json({ error: 'templateId is required' }, { status: 400 });
      }

      const template = await prisma.emailTemplate.update({
        where: { id: templateId },
        data: { active: !!active },
      });

      return NextResponse.json(template);
    }

    return NextResponse.json({ error: 'Invalid type. Use "campaign", "template", or "toggle-template".' }, { status: 400 });
  } catch (error) {
    console.error('[mailing/POST]', error);
    return NextResponse.json({ error: 'Failed to create resource' }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ */
/*  PUT  /api/mailing                                                   */
/*  Update an existing template                                         */
/* ------------------------------------------------------------------ */

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, subject, body: templateBody, category, variables, active } = body;

    if (!id) {
      return NextResponse.json({ error: 'Template id is required' }, { status: 400 });
    }

    if (!name || !subject || !templateBody) {
      return NextResponse.json(
        { error: 'Template name, subject, and body are required' },
        { status: 400 }
      );
    }

    const template = await prisma.emailTemplate.update({
      where: { id },
      data: {
        name,
        subject,
        body: templateBody,
        category: category || 'general',
        variables: variables ? JSON.stringify(variables) : '[]',
        ...(typeof active === 'boolean' ? { active } : {}),
      },
      include: {
        _count: { select: { campaigns: true } },
      },
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error('[mailing/PUT]', error);
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ */
/*  DELETE  /api/mailing                                                */
/*  Delete a template by id                                             */
/* ------------------------------------------------------------------ */

export async function DELETE(req: NextRequest) {
  try {
    const url = req.nextUrl;
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Template id is required' }, { status: 400 });
    }

    await prisma.emailTemplate.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[mailing/DELETE]', error);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}
