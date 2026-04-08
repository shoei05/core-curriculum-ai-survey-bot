import { NextRequest } from "next/server";

export const ADMIN_COOKIE_NAME = "admin_session";

const DEV_SESSION_SECRET = "development-admin-session-secret";

export function validateEnvConfig(): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  const isProduction = process.env.NODE_ENV === "production";

  if (!process.env.ADMIN_USER) {
    missing.push("ADMIN_USER");
  }
  if (!process.env.ADMIN_PASSWORD) {
    missing.push("ADMIN_PASSWORD");
  }
  if (isProduction && !process.env.ADMIN_SESSION_SECRET) {
    missing.push("ADMIN_SESSION_SECRET");
  }

  return { valid: missing.length === 0, missing };
}

function base64Encode(value: string) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value).toString("base64");
  }
  return btoa(unescape(encodeURIComponent(value)));
}

export function getAdminSessionSecret(): string | null {
  if (process.env.ADMIN_SESSION_SECRET) {
    return process.env.ADMIN_SESSION_SECRET;
  }
  if (process.env.NODE_ENV === "production") {
    return null;
  }
  return DEV_SESSION_SECRET;
}

export function getAdminCredentials(): { user: string; pass: string } | null {
  const user = process.env.ADMIN_USER?.trim();
  const pass = process.env.ADMIN_PASSWORD?.trim();

  if (!user || !pass) {
    return null;
  }

  return { user, pass };
}

export function createSessionValue(user: string, pass: string): string | null {
  const secret = getAdminSessionSecret();
  if (!secret) {
    return null;
  }
  return base64Encode(`${user}:${pass}:${secret}`);
}

export async function isAuthenticated(req: NextRequest) {
  const session = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!session) {
    return false;
  }

  const creds = getAdminCredentials();
  const sessionValue = creds ? createSessionValue(creds.user, creds.pass) : null;
  if (!creds || !sessionValue) {
    return false;
  }

  return session === sessionValue;
}
