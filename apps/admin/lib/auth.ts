import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export interface AdminUser {
  id: string;
}

// Legacy server-side helper: no hardcoded fallback, and only admin-type tokens.
// The current API proxy delegates actual permission and tenant checks to Nest.
export function verifyAdminToken(token: string | undefined): AdminUser | null {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!token || !secret) return null;
  try {
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
    if (typeof decoded !== 'object' || decoded.tokenType !== 'admin' || typeof decoded.sub !== 'string') return null;
    return { id: decoded.sub };
  } catch {
    return null;
  }
}

export function requireAdmin(req: NextRequest): NextResponse | null {
  const token = req.cookies.get('admin_access_token')?.value;
  if (!verifyAdminToken(token)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return null;
}
