// ── POST /api/auth/login ─────────────────────────────────────────────
// Validates credentials and sets a session cookie.

import { NextRequest, NextResponse } from 'next/server';
import {
  validateCredentials,
  generateToken,
  SESSION_COOKIE_NAME,
} from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, rememberMe } = body as {
      email?: string;
      password?: string;
      rememberMe?: boolean;
    };

    // ─── Input validation ───────────────────────────────────
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'E-Mail und Passwort sind erforderlich.' },
        { status: 400 },
      );
    }

    if (typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Ungueltige Eingabe.' },
        { status: 400 },
      );
    }

    // ─── Credential check ───────────────────────────────────
    const user = validateCredentials(email.trim().toLowerCase(), password);

    if (!user) {
      // Artificial delay to slow down brute-force attempts
      await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 500));
      return NextResponse.json(
        { success: false, error: 'Ungueltige E-Mail oder Passwort.' },
        { status: 401 },
      );
    }

    // ─── Generate token & set cookie ────────────────────────
    const token = generateToken(user);

    const maxAge = rememberMe
      ? 30 * 24 * 60 * 60 // 30 days
      : 7 * 24 * 60 * 60; // 7 days

    const response = NextResponse.json(
      {
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
        },
      },
      { status: 200 },
    );

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge,
    });

    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Ungueltige Anfrage.' },
      { status: 400 },
    );
  }
}
