import bcrypt from "bcryptjs";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../drizzle/schema";
import { query } from "./db";

const accessSecret = new TextEncoder().encode(
  process.env.JWT_SECRET || randomBytes(32).toString("hex")
);
const refreshSecret = new TextEncoder().encode(
  process.env.JWT_REFRESH_SECRET ||
    process.env.JWT_SECRET ||
    randomBytes(32).toString("hex")
);

export type PublicUser = Omit<User, "passwordHash">;

type StoredUser = User;
const users = new Map<string, StoredUser>();
const refreshSessions = new Map<
  string,
  { userId: string; expiresAt: number }
>();

function publicUser(user: StoredUser): PublicUser {
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function registerUser(input: {
  email: string;
  username: string;
  password: string;
  displayName?: string;
}): Promise<PublicUser> {
  const email = input.email.trim().toLowerCase();
  const username = input.username.trim();

  // Validate username format
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
    throw new Error(
      "Username must be 3-30 characters long and contain only letters, numbers, and underscores"
    );
  }

  // Check email uniqueness
  let existingEmail = usersByEmail(email);
  if (!existingEmail && process.env.DATABASE_URL) {
    try {
      existingEmail = (
        await query<StoredUser>(
          'SELECT id, email, password_hash AS "passwordHash", username, display_name AS "displayName", role, status, kyc_status AS "kycStatus", jurisdiction, date_of_birth AS "dateOfBirth", risk_status AS "riskStatus", created_at AS "createdAt", updated_at AS "updatedAt" FROM users WHERE email = $1 LIMIT 1',
          [email]
        )
      ).rows[0];
    } catch (error) {
      if (process.env.NODE_ENV === "production") throw error;
    }
  }
  if (existingEmail) throw new Error("An account with this email already exists");

  // Check username uniqueness
  let existingUsername = usersByUsername(username);
  if (!existingUsername && process.env.DATABASE_URL) {
    try {
      existingUsername = (
        await query<StoredUser>(
          'SELECT id, email, password_hash AS "passwordHash", username, display_name AS "displayName", role, status, kyc_status AS "kycStatus", jurisdiction, date_of_birth AS "dateOfBirth", risk_status AS "riskStatus", created_at AS "createdAt", updated_at AS "updatedAt" FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1',
          [username]
        )
      ).rows[0];
    } catch (error) {
      if (process.env.NODE_ENV === "production") throw error;
    }
  }
  if (existingUsername) {
    throw new Error("This username is already taken. Please choose another one.");
  }

  if (input.password.length < 8)
    throw new Error("Password must be at least 8 characters");

  const now = new Date();
  const user: StoredUser = {
    id: randomUUID(),
    email,
    passwordHash: await bcrypt.hash(input.password, 12),
    username,
    displayName: input.displayName?.trim() || username,
    role: "PLAYER",
    status: "ACTIVE",
    kycStatus: "PENDING",
    jurisdiction: null,
    dateOfBirth: null,
    riskStatus: "CLEAR",
    createdAt: now,
    updatedAt: now,
  };
  users.set(user.id, user);

  if (process.env.DATABASE_URL) {
    try {
      await query(
        "INSERT INTO users (id, email, password_hash, username, display_name, role, status, kyc_status, jurisdiction, date_of_birth, risk_status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
        [
          user.id,
          user.email,
          user.passwordHash,
          user.username,
          user.displayName,
          user.role,
          user.status,
          user.kycStatus,
          user.jurisdiction,
          user.dateOfBirth,
          user.riskStatus,
        ]
      );
    } catch (error) {
      if (process.env.NODE_ENV === "production") throw error;
    }
  }
  return publicUser(user);
}

function usersByEmail(email: string) {
  return Array.from(users.values()).find(user => user.email === email);
}

function usersByUsername(username: string) {
  const clean = username.trim().toLowerCase();
  return Array.from(users.values()).find(
    user => user.username && user.username.toLowerCase() === clean
  );
}

export async function loginUser(identifierInput: string, password: string) {
  const identifier = identifierInput.trim().toLowerCase();
  let user: StoredUser | undefined;
  if (process.env.DATABASE_URL) {
    try {
      user = (
        await query<StoredUser>(
          'SELECT id, email, password_hash AS "passwordHash", username, display_name AS "displayName", role, status, kyc_status AS "kycStatus", jurisdiction, date_of_birth AS "dateOfBirth", risk_status AS "riskStatus", created_at AS "createdAt", updated_at AS "updatedAt" FROM users WHERE LOWER(email) = $1 OR LOWER(username) = $1 LIMIT 1',
          [identifier]
        )
      ).rows[0];
      if (user) users.set(user.id, user);
    } catch (error) {
      if (process.env.NODE_ENV === "production") throw error;
    }
  }
  if (!user) {
    user = usersByEmail(identifier) || usersByUsername(identifier);
  }
  if (!user || !(await bcrypt.compare(password, user.passwordHash)))
    throw new Error("Invalid email/username or password");
  if (["SUSPENDED", "SELF_EXCLUDED", "CLOSED"].includes(user.status))
    throw new Error("This account cannot sign in");
  return { user: publicUser(user), ...(await issueTokens(user.id)) };
}

export async function issueTokens(userId: string) {
  const sessionId = randomUUID();
  const refreshToken = await new SignJWT({
    sub: userId,
    sid: sessionId,
    kind: "refresh",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(refreshSecret);
  const tokenHash = hashToken(refreshToken);
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
  refreshSessions.set(tokenHash, { userId, expiresAt });
  if (process.env.DATABASE_URL) {
    try {
      await query(
        "INSERT INTO refresh_sessions (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, to_timestamp($4 / 1000.0)) ON CONFLICT (token_hash) DO UPDATE SET revoked_at = NULL, expires_at = EXCLUDED.expires_at",
        [sessionId, userId, tokenHash, expiresAt]
      );
    } catch (error) {
      if (process.env.NODE_ENV === "production") throw error;
      console.warn(
        "[Auth] Development database unavailable; using isolated session fallback"
      );
    }
  }
  const accessToken = await new SignJWT({ sub: userId, kind: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(accessSecret);
  return { accessToken, refreshToken };
}

export async function authenticateAccessToken(
  token?: string
): Promise<PublicUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, accessSecret);
    if (payload.kind !== "access" || typeof payload.sub !== "string")
      return null;
    let user = users.get(payload.sub);
    if (!user && process.env.DATABASE_URL) {
      try {
        user = (
          await query<StoredUser>(
            'SELECT id, email, password_hash AS "passwordHash", username, display_name AS "displayName", role, status, kyc_status AS "kycStatus", jurisdiction, date_of_birth AS "dateOfBirth", risk_status AS "riskStatus", created_at AS "createdAt", updated_at AS "updatedAt" FROM users WHERE id = $1 LIMIT 1',
            [payload.sub]
          )
        ).rows[0];
        if (user) users.set(user.id, user);
      } catch {
        // ignore
      }
    }
    return user ? publicUser(user) : null;
  } catch {
    return null;
  }
}

export async function refreshAccessToken(refreshToken: string) {
  const tokenHash = hashToken(refreshToken);
  const session = refreshSessions.get(tokenHash);
  let durable: {
    user_id: string;
    expires_at: string;
    revoked_at: string | null;
  } | null = null;
  if (process.env.DATABASE_URL) {
    try {
      durable =
        (
          await query<{
            user_id: string;
            expires_at: string;
            revoked_at: string | null;
          }>(
            "SELECT user_id, expires_at, revoked_at FROM refresh_sessions WHERE token_hash = $1 LIMIT 1",
            [tokenHash]
          )
        ).rows[0] || null;
    } catch (error) {
      if (process.env.NODE_ENV === "production") throw error;
    }
  }
  if (
    (!session && !durable) ||
    (session && session.expiresAt < Date.now()) ||
    (durable && durable.revoked_at) ||
    (durable && new Date(durable.expires_at).getTime() < Date.now())
  )
    throw new Error("Refresh session expired");
  const { payload } = await jwtVerify(refreshToken, refreshSecret);
  if (payload.kind !== "refresh" || typeof payload.sub !== "string")
    throw new Error("Invalid refresh session");
  refreshSessions.delete(tokenHash);
  if (process.env.DATABASE_URL) {
    try {
      await query(
        "UPDATE refresh_sessions SET revoked_at = NOW() WHERE token_hash = $1",
        [tokenHash]
      );
    } catch (error) {
      if (process.env.NODE_ENV === "production") throw error;
    }
  }
  return issueTokens(session?.userId || durable!.user_id);
}

export async function revokeRefreshToken(refreshToken?: string) {
  if (!refreshToken) return;
  const tokenHash = hashToken(refreshToken);
  refreshSessions.delete(tokenHash);
  if (process.env.DATABASE_URL) {
    try {
      await query(
        "UPDATE refresh_sessions SET revoked_at = NOW() WHERE token_hash = $1",
        [tokenHash]
      );
    } catch (error) {
      if (process.env.NODE_ENV === "production") throw error;
    }
  }
}

export function getUserById(userId: string) {
  const user = users.get(userId);
  return user ? publicUser(user) : null;
}

export function listUsers() {
  return Array.from(users.values()).map(publicUser);
}

export async function ensureAuthSchema() {
  if (!process.env.DATABASE_URL) return;
  try {
    await query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS username varchar(32);
      CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (LOWER(username));
      UPDATE users 
      SET username = LOWER(REGEXP_REPLACE(SUBSTRING(display_name, 1, 15), '[^a-zA-Z0-9_]', '', 'g')) || '_' || SUBSTRING(id::text, 1, 6)
      WHERE username IS NULL;
    `);
  } catch (e: any) {
    console.warn("[Auth] Schema update notice:", e.message);
  }
}

export async function seedOperator() {
  await ensureAuthSchema();
  const email = "operator@aviator.local";
  if (process.env.DATABASE_URL) {
    try {
      const existing = (
        await query<StoredUser>(
          'SELECT id, email, password_hash AS "passwordHash", username, display_name AS "displayName", role, status, kyc_status AS "kycStatus", jurisdiction, date_of_birth AS "dateOfBirth", risk_status AS "riskStatus", created_at AS "createdAt", updated_at AS "updatedAt" FROM users WHERE email = $1 LIMIT 1',
          [email]
        )
      ).rows[0];
      if (existing) {
        users.set(existing.id, existing);
        return;
      }
    } catch {
      // ignore
    }
  }
  if (usersByEmail(email)) return;

  const now = new Date();
  const operator: StoredUser = {
    id: randomUUID(),
    email,
    passwordHash: bcrypt.hashSync("ChangeMe123!", 12),
    username: "operator",
    displayName: "Operations Lead",
    role: "ADMIN" as const,
    status: "ACTIVE" as const,
    kycStatus: "VERIFIED" as const,
    jurisdiction: "KE",
    dateOfBirth: null,
    riskStatus: "CLEAR" as const,
    createdAt: now,
    updatedAt: now,
  };
  users.set(operator.id, operator);
  if (process.env.DATABASE_URL) {
    try {
      await query(
        "INSERT INTO users (id, email, password_hash, username, display_name, role, status, kyc_status, jurisdiction, date_of_birth, risk_status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (email) DO NOTHING",
        [
          operator.id,
          operator.email,
          operator.passwordHash,
          operator.username,
          operator.displayName,
          operator.role,
          operator.status,
          operator.kycStatus,
          operator.jurisdiction,
          operator.dateOfBirth,
          operator.riskStatus,
        ]
      );
    } catch {
      // ignore
    }
  }
}
// Always seed the default operator account on startup so admin login works in all environments.
// The seedOperator function uses ON CONFLICT DO NOTHING so it is safe to run repeatedly.
seedOperator().catch(() => {});
