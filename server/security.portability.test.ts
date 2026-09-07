import { describe, expect, it, vi } from "vitest";
import rateLimit from "express-rate-limit";

describe("security and portability enforcement", () => {
  it("fails production validation without strong secrets and database", async () => {
    const snapshot = {
      NODE_ENV: process.env.NODE_ENV,
      JWT_SECRET: process.env.JWT_SECRET,
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
      DATABASE_URL: process.env.DATABASE_URL,
    };
    process.env.NODE_ENV = "production";
    delete process.env.JWT_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const { validateEnvironment } = await import("./_core/env");
    expect(() => validateEnvironment()).toThrow("JWT_SECRET");
    for (const [key, value] of Object.entries(snapshot))
      if (value === undefined)
        delete process.env[key as keyof NodeJS.ProcessEnv];
      else process.env[key as keyof NodeJS.ProcessEnv] = value;
    vi.resetModules();
  });

  it("returns 429 after the configured request budget is exhausted", async () => {
    const limiter = rateLimit({
      windowMs: 60_000,
      limit: 1,
      validate: false,
      standardHeaders: false,
      legacyHeaders: false,
    });
    const response = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      setHeader(name: string, value: string) {
        this.headers[name] = value;
      },
      set(name: string, value: string) {
        this.headers[name] = value;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      send() {
        return this;
      },
      end() {
        return this;
      },
    } as any;
    const request = {
      ip: "127.0.0.1",
      method: "GET",
      path: "/security-test",
      headers: {},
      app: { get: () => undefined },
    } as any;
    await new Promise<void>((resolve, reject) =>
      limiter(request, response, error => (error ? reject(error) : resolve()))
    );
    await new Promise<void>(resolve => {
      response.send = () => {
        resolve();
        return response;
      };
      limiter(request, response, () => resolve());
    });
    expect(response.statusCode).toBe(429);
  });
});
