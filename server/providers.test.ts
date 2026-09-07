import { afterEach, describe, expect, it } from "vitest";
import {
  ConfiguredEligibilityProvider,
  getEligibilityProvider,
  getRiskProvider,
} from "./services/providers";

describe("eligibility provider boundary", () => {
  const original = {
    real: process.env.REAL_MONEY_ENABLED,
    identity: process.env.IDENTITY_PROVIDER_MODE,
    geo: process.env.GEOLOCATION_PROVIDER_MODE,
    risk: process.env.RISK_PROVIDER_MODE,
    allowed: process.env.ALLOWED_JURISDICTIONS,
    jurisdiction: process.env.GEOLOCATION_JURISDICTION,
    decision: process.env.IDENTITY_DECISION,
  };
  afterEach(() => {
    for (const [key, value] of Object.entries({
      REAL_MONEY_ENABLED: original.real,
      IDENTITY_PROVIDER_MODE: original.identity,
      GEOLOCATION_PROVIDER_MODE: original.geo,
      RISK_PROVIDER_MODE: original.risk,
      ALLOWED_JURISDICTIONS: original.allowed,
      GEOLOCATION_JURISDICTION: original.jurisdiction,
      IDENTITY_DECISION: original.decision,
    }))
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
  });

  it("enforces an explicit jurisdiction allowlist", async () => {
    process.env.ALLOWED_JURISDICTIONS = "KE,UG";
    process.env.GEOLOCATION_JURISDICTION = "KE";
    const provider = new ConfiguredEligibilityProvider();
    await expect(provider.verifyLocation("user-1")).resolves.toMatchObject({
      allowed: true,
      jurisdiction: "KE",
    });
    process.env.GEOLOCATION_JURISDICTION = "XX";
    await expect(provider.verifyLocation("user-1")).resolves.toMatchObject({
      allowed: false,
      jurisdiction: "XX",
    });
  });

  it("fails closed when production provider modes are not configured", () => {
    process.env.REAL_MONEY_ENABLED = "true";
    delete process.env.IDENTITY_PROVIDER_MODE;
    expect(() => getEligibilityProvider()).toThrow(
      "explicit policy configuration"
    );
    expect(() => getRiskProvider()).toThrow("explicit policy configuration");
  });
});
