import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { authenticateAccessToken, type PublicUser } from "../auth";
import { parse } from "cookie";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: PublicUser | null;
  cookies: Record<string, string>;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  const header = opts.req.headers.authorization;
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  const cookies = parse(opts.req.headers.cookie || "");
  const cookieToken = cookies.aviator_access;
  return {
    req: opts.req,
    res: opts.res,
    cookies,
    user: await authenticateAccessToken(bearer || cookieToken),
  };
}
