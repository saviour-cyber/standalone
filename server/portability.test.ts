import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateEnvironment } from "./_core/env";

describe("standalone portability contract", () => {
  it("ships independent container and compose artifacts", () => {
    expect(existsSync(resolve(process.cwd(), "Dockerfile"))).toBe(true);
    expect(existsSync(resolve(process.cwd(), "docker-compose.yml"))).toBe(true);
    expect(
      readFileSync(resolve(process.cwd(), "docker-compose.yml"), "utf8")
    ).toContain("postgres");
    expect(
      readFileSync(resolve(process.cwd(), "docker-compose.yml"), "utf8")
    ).toContain("redis");
  });

  it("validates the development environment and exposes the expected security wiring", () => {
    expect(["development", "test"]).toContain(validateEnvironment().nodeEnv);
    const entrypoint = readFileSync(
      resolve(process.cwd(), "server/_core/index.ts"),
      "utf8"
    );
    expect(entrypoint).toContain("rateLimit");
    expect(entrypoint).toContain("validateEnvironment");
  });
});
