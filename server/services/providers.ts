export type ProviderEnvironment = "mock" | "sandbox" | "production";
export type ProviderResult = {
  accepted: boolean;
  providerReference: string;
  status: "PENDING" | "COMPLETED" | "FAILED";
  metadata: Record<string, unknown>;
};

export interface PaymentProvider {
  readonly name: string;
  readonly environment: ProviderEnvironment;
  createDeposit(input: {
    userId: string;
    amountMinor: number;
    currency: string;
    idempotencyKey: string;
  }): Promise<ProviderResult>;
  createWithdrawal(input: {
    userId: string;
    amountMinor: number;
    currency: string;
    idempotencyKey: string;
  }): Promise<ProviderResult>;
  verifyWebhook(signature: string | undefined, rawBody: string): boolean;
}

export interface EligibilityProvider {
  verifyIdentity(userId: string): Promise<{
    status: "PENDING" | "VERIFIED" | "REJECTED";
    reference: string;
  }>;
  verifyLocation(
    userId: string
  ): Promise<{ allowed: boolean; jurisdiction: string; reference: string }>;
}
export interface RiskProvider {
  score(
    userId: string,
    context: Record<string, unknown>
  ): Promise<{
    status: "CLEAR" | "REVIEW" | "BLOCKED";
    score: number;
    reasons: string[];
  }>;
}

export class MockPaymentProvider implements PaymentProvider {
  name: string = "mock";
  environment: ProviderEnvironment = "mock";
  async createDeposit(input: {
    userId: string;
    amountMinor: number;
    currency: string;
    idempotencyKey: string;
  }) {
    return {
      accepted: true,
      providerReference: `mock-deposit-${input.idempotencyKey}`,
      status: "COMPLETED" as const,
      metadata: { userId: input.userId, sandbox: true },
    };
  }
  async createWithdrawal(input: {
    userId: string;
    amountMinor: number;
    currency: string;
    idempotencyKey: string;
  }) {
    return {
      accepted: true,
      providerReference: `mock-withdrawal-${input.idempotencyKey}`,
      status: "PENDING" as const,
      metadata: { userId: input.userId, sandbox: true },
    };
  }
  verifyWebhook(signature: string | undefined, rawBody: string) {
    return Boolean(signature && rawBody);
  }
}

export class SandboxPaymentProvider extends MockPaymentProvider {
  constructor() {
    super();
    this.name = "sandbox";
    this.environment = "sandbox";
  }
}
export function getPaymentProvider(): PaymentProvider {
  if (process.env.REAL_MONEY_ENABLED === "true")
    throw new Error(
      "Production payment activation requires an approved provider adapter and launch gate"
    );
  return process.env.PAYMENT_PROVIDER_ENV === "sandbox"
    ? new SandboxPaymentProvider()
    : new MockPaymentProvider();
}

export class SandboxEligibilityProvider implements EligibilityProvider {
  async verifyIdentity(userId: string) {
    return {
      status: "VERIFIED" as const,
      reference: `sandbox-identity-${userId}`,
    };
  }
  async verifyLocation(userId: string) {
    return {
      allowed: true,
      jurisdiction: "SANDBOX",
      reference: `sandbox-location-${userId}`,
    };
  }
}
export class SandboxRiskProvider implements RiskProvider {
  async score(userId: string, _context: Record<string, unknown>) {
    return { status: "CLEAR" as const, score: 0, reasons: [], userId };
  }
}
export class ConfiguredEligibilityProvider implements EligibilityProvider {
  async verifyIdentity(userId: string) {
    return {
      status: (process.env.IDENTITY_DECISION === "VERIFIED"
        ? "VERIFIED"
        : "PENDING") as "PENDING" | "VERIFIED" | "REJECTED",
      reference: `configured-identity-${userId}`,
    };
  }
  async verifyLocation(userId: string) {
    const jurisdiction = process.env.GEOLOCATION_JURISDICTION || "UNKNOWN";
    const allowed = (process.env.ALLOWED_JURISDICTIONS || "")
      .split(",")
      .map(value => value.trim())
      .filter(Boolean)
      .includes(jurisdiction);
    return {
      allowed,
      jurisdiction,
      reference: `configured-location-${userId}`,
    };
  }
}
export function getEligibilityProvider(): EligibilityProvider {
  if (process.env.REAL_MONEY_ENABLED === "true") {
    if (
      process.env.IDENTITY_PROVIDER_MODE !== "policy" ||
      process.env.GEOLOCATION_PROVIDER_MODE !== "policy"
    )
      throw new Error(
        "Production identity and geolocation providers require explicit policy configuration"
      );
    return new ConfiguredEligibilityProvider();
  }
  return new SandboxEligibilityProvider();
}
export function getRiskProvider(): RiskProvider {
  if (process.env.REAL_MONEY_ENABLED === "true") {
    if (process.env.RISK_PROVIDER_MODE !== "policy")
      throw new Error(
        "Production risk provider requires explicit policy configuration"
      );
    return new SandboxRiskProvider();
  }
  return new SandboxRiskProvider();
}
