// ── Werkpilot Dashboard — Auth Utilities ─────────────────────────────
// Simple token-based authentication for the demo dashboard.
// In production, replace with a proper JWT library + database sessions.

import { cookies } from 'next/headers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Session {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'viewer';
  avatar?: string;
  createdAt: number;
  expiresAt: number;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'viewer';
  avatar?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SESSION_COOKIE_NAME = 'wp-session';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const TOKEN_SECRET = 'werkpilot-demo-secret-2026'; // Demo only

// Demo user credentials
export const DEMO_USER = {
  id: 'usr_admin_001',
  email: 'admin@werkpilot.ch',
  password: 'werkpilot2026',
  name: 'Admin',
  role: 'admin' as const,
  avatar: undefined,
};

// ---------------------------------------------------------------------------
// Token Generation & Validation
// ---------------------------------------------------------------------------

/**
 * Generate a session token by encoding session data as base64.
 * In production, use a proper JWT with RS256 or similar.
 */
export function generateToken(user: Omit<UserProfile, 'avatar'>): string {
  const session: Session = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_DURATION_MS,
  };

  const payload = JSON.stringify(session);
  const encoded = Buffer.from(payload).toString('base64url');

  // Simple HMAC-like signature (demo purposes)
  const signature = Buffer.from(
    `${encoded}.${TOKEN_SECRET}`
  ).toString('base64url');

  return `${encoded}.${signature}`;
}

/**
 * Validate a session token and return the session data.
 * Returns null if the token is invalid or expired.
 */
export function validateToken(token: string): Session | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [encoded, signature] = parts;

    // Verify signature
    const expectedSignature = Buffer.from(
      `${encoded}.${TOKEN_SECRET}`
    ).toString('base64url');

    if (signature !== expectedSignature) return null;

    // Decode payload
    const payload = Buffer.from(encoded, 'base64url').toString('utf8');
    const session: Session = JSON.parse(payload);

    // Check expiration
    if (Date.now() > session.expiresAt) return null;

    return session;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Server-side Helpers (for API routes / Server Components)
// ---------------------------------------------------------------------------

/**
 * Get the current user from the session cookie.
 * Use in API routes and Server Components.
 */
export async function getCurrentUser(): Promise<UserProfile | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) return null;

  const session = validateToken(token);
  if (!session) return null;

  return {
    id: session.id,
    email: session.email,
    name: session.name,
    role: session.role,
    avatar: session.avatar,
  };
}

/**
 * Validate credentials against the demo user.
 * In production, check against a database with hashed passwords.
 */
export function validateCredentials(
  email: string,
  password: string,
): UserProfile | null {
  if (email === DEMO_USER.email && password === DEMO_USER.password) {
    return {
      id: DEMO_USER.id,
      email: DEMO_USER.email,
      name: DEMO_USER.name,
      role: DEMO_USER.role,
    };
  }
  return null;
}
