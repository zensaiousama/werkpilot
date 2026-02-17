import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function POST(req: NextRequest) {
  const { leads } = await req.json();
  if (!Array.isArray(leads) || leads.length === 0) {
    return NextResponse.json({ error: 'Provide a leads array' }, { status: 400 });
  }

  const created = await prisma.lead.createMany({
    data: leads.map((l: Record<string, unknown>) => ({
      firma: l.firma as string,
      kontakt: (l.kontakt as string) || null,
      email: (l.email as string) || null,
      telefon: (l.telefon as string) || null,
      website: (l.website as string) || null,
      adresse: (l.adresse as string) || null,
      branche: l.branche as string,
      kanton: l.kanton as string,
      ort: l.ort as string,
      googleRating: (l.googleRating as number) || null,
      googleReviews: (l.googleReviews as number) || null,
      quelle: (l.quelle as string) || 'scraper',
    })),
  });

  return NextResponse.json({ imported: created.count }, { status: 201 });
}
