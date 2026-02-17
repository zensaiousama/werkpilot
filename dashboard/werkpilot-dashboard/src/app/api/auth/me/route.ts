// ── GET /api/auth/me ─────────────────────────────────────────────────
// Returns the current authenticated user's profile, or 401 if not logged in.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Nicht authentifiziert.' },
      { status: 401 },
    );
  }

  return NextResponse.json(
    {
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatar: user.avatar ?? null,
        },
      },
    },
    { status: 200 },
  );
}
