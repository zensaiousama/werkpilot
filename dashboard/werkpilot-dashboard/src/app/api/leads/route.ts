import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const status = url.searchParams.get('status');
  const branche = url.searchParams.get('branche');
  const kanton = url.searchParams.get('kanton');
  const search = url.searchParams.get('search');
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const sortBy = url.searchParams.get('sortBy') || 'createdAt';
  const sortOrder = url.searchParams.get('sortOrder') || 'desc';

  const where: Record<string, unknown> = {};
  if (status) {
    const statuses = status.split(',');
    where.status = { in: statuses };
  }
  if (branche) where.branche = branche;
  if (kanton) where.kanton = kanton;
  if (search) {
    where.OR = [
      { firma: { contains: search } },
      { kontakt: { contains: search } },
      { email: { contains: search } },
      { ort: { contains: search } },
    ];
  }

  // Validate sortBy field
  const validSortFields = ['createdAt', 'leadScore', 'firma', 'status', 'umsatzpotenzial', 'updatedAt'];
  const orderByField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
  const orderByDirection = sortOrder === 'asc' ? 'asc' : 'desc';

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: { activities: { orderBy: { createdAt: 'desc' }, take: 5 } },
      orderBy: { [orderByField]: orderByDirection },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.lead.count({ where }),
  ]);

  return NextResponse.json({ leads, total, page, limit });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const lead = await prisma.lead.create({
    data: {
      firma: body.firma,
      kontakt: body.kontakt,
      email: body.email,
      telefon: body.telefon,
      website: body.website,
      adresse: body.adresse,
      branche: body.branche,
      kanton: body.kanton,
      ort: body.ort,
      status: body.status || 'New Lead',
      leadScore: body.leadScore || 0,
      googleRating: body.googleRating,
      googleReviews: body.googleReviews,
      quelle: body.quelle || 'manual',
    },
  });
  return NextResponse.json(lead, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { ids } = body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'Array of IDs is required' }, { status: 400 });
  }

  const result = await prisma.lead.deleteMany({
    where: {
      id: { in: ids },
    },
  });

  return NextResponse.json({ deleted: result.count });
}
