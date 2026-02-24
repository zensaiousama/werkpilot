import prisma from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

/* ------------------------------------------------------------------ */
/*  GET /api/search?q=...                                              */
/*  Global search across leads, invoices, follow-ups, campaigns        */
/* ------------------------------------------------------------------ */
export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get('q')?.trim();
    if (!q || q.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const [leads, invoices, followUps, campaigns] = await Promise.all([
      prisma.lead.findMany({
        where: {
          OR: [
            { firma: { contains: q } },
            { kontakt: { contains: q } },
            { email: { contains: q } },
            { branche: { contains: q } },
            { kanton: { contains: q } },
          ],
        },
        select: { id: true, firma: true, kontakt: true, status: true, branche: true },
        take: 8,
      }),
      prisma.invoice.findMany({
        where: {
          OR: [
            { invoiceNumber: { contains: q } },
            { clientName: { contains: q } },
          ],
        },
        select: { id: true, invoiceNumber: true, clientName: true, status: true, total: true },
        take: 5,
      }),
      prisma.followUp.findMany({
        where: {
          OR: [
            { subject: { contains: q } },
            { message: { contains: q } },
          ],
        },
        select: { id: true, subject: true, type: true, status: true, dueDate: true },
        take: 5,
      }),
      prisma.campaign.findMany({
        where: {
          OR: [
            { name: { contains: q } },
          ],
        },
        select: { id: true, name: true, status: true, sentCount: true },
        take: 5,
      }),
    ]);

    const results = [
      ...leads.map((l) => ({
        type: 'lead' as const,
        id: l.id,
        title: l.firma,
        subtitle: `${l.kontakt} · ${l.branche}`,
        status: l.status,
        href: '/crm',
      })),
      ...invoices.map((i) => ({
        type: 'invoice' as const,
        id: i.id,
        title: `${i.invoiceNumber} — ${i.clientName}`,
        subtitle: `CHF ${i.total.toLocaleString('de-CH')}`,
        status: i.status,
        href: '/finanzen',
      })),
      ...followUps.map((f) => ({
        type: 'followup' as const,
        id: f.id,
        title: f.subject,
        subtitle: f.type,
        status: f.status,
        href: '/follow-up',
      })),
      ...campaigns.map((c) => ({
        type: 'campaign' as const,
        id: c.id,
        title: c.name,
        subtitle: c.sentCount > 0 ? `${c.sentCount} gesendet` : 'Entwurf',
        status: c.status,
        href: '/mailing',
      })),
    ];

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ results: [] });
  }
}
