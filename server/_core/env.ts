const required = (name: string, fallback = "") => process.env[name] ?? fallback;

export const ENV = {
  nodeEnv: required("NODE_ENV", "development"),
  port: Number(required("PORT", "3000")),
  databaseUrl: required("DATABASE_URL"),
  redisUrl: required("REDIS_URL"),
  jwtSecret: required("JWT_SECRET"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET"),
  realMoneyEnabled: process.env.REAL_MONEY_ENABLED === "true",
  paymentProvider: required("PAYMENT_PROVIDER", "mock"),
  paymentProviderEnv: required("PAYMENT_PROVIDER_ENV", "mock"),
  isProduction: process.env.NODE_ENV === "production",
};

export function validateEnvironment() {
  if (ENV.isProduction && ENV.jwtSecret.length < 32)
    throw new Error("JWT_SECRET must be at least 32 characters in production");
  if (ENV.isProduction && ENV.jwtRefreshSecret.length < 32)
    throw new Error(
      "JWT_REFRESH_SECRET must be at least 32 characters in production"
    );
  if (ENV.isProduction && !ENV.databaseUrl)
    throw new Error("DATABASE_URL is required in production");
  if (
    ENV.isProduction &&
    ENV.realMoneyEnabled &&
    (!ENV.databaseUrl || ENV.paymentProviderEnv !== "production")
  )
    throw new Error(
      "Production money activation requires a production provider environment"
    );
  return ENV;
}
