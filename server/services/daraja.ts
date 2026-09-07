import { randomUUID } from "node:crypto";
import { auditLog, demoDeposit } from "./platform";

export interface DarajaConfig {
  enabled: boolean;
  environment: "sandbox" | "production";
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
  shortcode: string;
  callbackUrl: string;
}

export interface StkPromptRecord {
  id: string;
  timestamp: string;
  phoneNumber: string;
  amountKes: number;
  accountReference: string;
  userId?: string;
  merchantRequestId: string;
  checkoutRequestId: string;
  status: "PENDING" | "COMPLETED" | "FAILED" | "SIMULATED";
  resultDesc: string;
  mpesaReceipt?: string;
}

// Default Safaricom Sandbox Daraja Credentials
const defaultDarajaConfig: DarajaConfig = {
  enabled: true,
  environment: (process.env.PAYMENT_PROVIDER_ENV === "production" ? "production" : "sandbox") as "sandbox" | "production",
  consumerKey: (process.env.DARAJA_CONSUMER_KEY || "TestConsumerKeyDaraja2026").trim(),
  consumerSecret: (process.env.DARAJA_CONSUMER_SECRET || "TestConsumerSecretDaraja2026").trim(),
  passkey: (
    process.env.DARAJA_PASSKEY ||
    "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919"
  ).trim(),
  shortcode: (process.env.DARAJA_SHORTCODE || "174379").trim(),
  callbackUrl: (
    process.env.DARAJA_CALLBACK_URL ||
    "http://localhost:3000/api/webhooks/daraja"
  ).trim(),
};

let currentConfig: DarajaConfig = { ...defaultDarajaConfig };
const promptHistory: StkPromptRecord[] = [];

export function getDarajaConfig(maskSecrets = true): DarajaConfig {
  if (!maskSecrets) return { ...currentConfig };
  return {
    ...currentConfig,
    consumerSecret: currentConfig.consumerSecret
      ? currentConfig.consumerSecret.slice(0, 4) + "••••••••" + currentConfig.consumerSecret.slice(-4)
      : "••••••••",
    passkey: currentConfig.passkey
      ? currentConfig.passkey.slice(0, 6) + "••••••••" + currentConfig.passkey.slice(-6)
      : "••••••••",
  };
}

export function updateDarajaConfig(updates: Partial<DarajaConfig>): DarajaConfig {
  const sanitized: Partial<DarajaConfig> = {};
  if (updates.enabled !== undefined) sanitized.enabled = updates.enabled;
  if (updates.environment) sanitized.environment = updates.environment;
  if (updates.consumerKey && updates.consumerKey.trim()) sanitized.consumerKey = updates.consumerKey.trim();
  if (updates.consumerSecret && !updates.consumerSecret.includes("••••") && updates.consumerSecret.trim()) {
    sanitized.consumerSecret = updates.consumerSecret.trim();
  }
  if (updates.passkey && !updates.passkey.includes("••••") && updates.passkey.trim()) {
    sanitized.passkey = updates.passkey.trim();
  }
  if (updates.shortcode && updates.shortcode.trim()) sanitized.shortcode = updates.shortcode.trim();
  if (updates.callbackUrl && updates.callbackUrl.trim()) sanitized.callbackUrl = updates.callbackUrl.trim();

  currentConfig = {
    ...currentConfig,
    ...sanitized,
  };
  return getDarajaConfig(true);
}

export function listDarajaPrompts(): StkPromptRecord[] {
  return [...promptHistory];
}

export function normalizePhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[^0-9]/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "254" + cleaned.slice(1);
  } else if (cleaned.startsWith("7") || cleaned.startsWith("1")) {
    cleaned = "254" + cleaned;
  }
  if (!/^254(7|1)\d{8}$/.test(cleaned)) {
    throw new Error(
      `Invalid Kenyan phone format (${phone}). Expected 2547XXXXXXXX or 2541XXXXXXXX`
    );
  }
  return cleaned;
}

export async function promptUserStkPush(input: {
  phoneNumber: string;
  amountKes: number;
  accountReference?: string;
  userId?: string;
}): Promise<{
  success: boolean;
  merchantRequestId: string;
  checkoutRequestId: string;
  responseDescription: string;
  customerMessage: string;
  recordId: string;
}> {
  if (!currentConfig.enabled) {
    throw new Error("M-Pesa Daraja Gateway is currently disabled by administrator.");
  }

  const normalizedPhone = normalizePhoneNumber(input.phoneNumber);
  const amount = Math.max(1, Math.round(input.amountKes));
  const accountReference = (input.accountReference || "AviatorBet").slice(0, 12);
  const recordId = randomUUID();
  const timestamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 14); // YYYYMMDDHHmmss

  let merchantRequestId = `MR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  let checkoutRequestId = `ws_CO_${timestamp}_${Math.floor(Math.random() * 90000 + 10000)}`;
  let responseDescription = "Success. Request accepted for processing";
  let customerMessage = `Success. STK Push sent to ${normalizedPhone}. Enter M-Pesa PIN on your phone.`;
  let status: StkPromptRecord["status"] = "SIMULATED";

  // Attempt live Safaricom API call if non-mock keys configured
  const isRealCreds =
    currentConfig.consumerKey !== "TestConsumerKeyDaraja2026" &&
    currentConfig.consumerSecret !== "TestConsumerSecretDaraja2026";

  if (isRealCreds) {
    try {
      const baseUrl =
        currentConfig.environment === "production"
          ? "https://api.safaricom.co.ke"
          : "https://sandbox.safaricom.co.ke";

      // 1. Generate OAuth Token
      const authHeader = Buffer.from(
        `${currentConfig.consumerKey}:${currentConfig.consumerSecret}`
      ).toString("base64");

      const tokenRes = await fetch(
        `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
        {
          headers: { Authorization: `Basic ${authHeader}` },
          signal: AbortSignal.timeout(6000),
        }
      );

      if (tokenRes.ok) {
        const tokenData = (await tokenRes.json()) as { access_token: string };
        const accessToken = tokenData.access_token;

        // 2. Compute Password: Base64(Shortcode + Passkey + Timestamp)
        const password = Buffer.from(
          `${currentConfig.shortcode}${currentConfig.passkey}${timestamp}`
        ).toString("base64");

        // 3. Dispatch STK Push
        const stkRes = await fetch(
          `${baseUrl}/mpesa/stkpush/v1/processrequest`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              BusinessShortCode: currentConfig.shortcode,
              Password: password,
              Timestamp: timestamp,
              TransactionType: "CustomerPayBillOnline",
              Amount: amount,
              PartyA: normalizedPhone,
              PartyB: currentConfig.shortcode,
              PhoneNumber: normalizedPhone,
              CallBackURL: currentConfig.callbackUrl,
              AccountReference: accountReference,
              TransactionDesc: "Aviator Wallet Deposit",
            }),
            signal: AbortSignal.timeout(8000),
          }
        );

        if (stkRes.ok) {
          const stkData = (await stkRes.json()) as any;
          merchantRequestId = stkData.MerchantRequestID || merchantRequestId;
          checkoutRequestId = stkData.CheckoutRequestID || checkoutRequestId;
          responseDescription = stkData.ResponseDescription || responseDescription;
          customerMessage = stkData.CustomerMessage || customerMessage;
          status = "PENDING";
        } else {
          const stkErr = await stkRes.text();
          responseDescription = `Safaricom STK Dispatch Rejected (${stkRes.status}): ${stkErr || "Bad Request"}`;
          customerMessage = responseDescription;
          status = "FAILED";
        }
      } else {
        const tokenErr = await tokenRes.text();
        responseDescription = `Safaricom OAuth Failed (${tokenRes.status}). Verify Consumer Key & Secret in Safaricom Developer Portal.`;
        customerMessage = responseDescription;
        status = "FAILED";
        console.warn("[Daraja Gateway] OAuth token rejected by Safaricom:", tokenRes.status, tokenErr);
      }
    } catch (err: any) {
      console.warn(
        "[Daraja Gateway] Live Safaricom API call failed:",
        err.message
      );
      responseDescription = `Safaricom Connection Error: ${err.message}`;
      customerMessage = responseDescription;
      status = "FAILED";
    }
  }

  // Record STK prompt in audit & history log
  const promptRecord: StkPromptRecord = {
    id: recordId,
    timestamp: new Date().toISOString(),
    phoneNumber: normalizedPhone,
    amountKes: amount,
    accountReference,
    userId: input.userId,
    merchantRequestId,
    checkoutRequestId,
    status,
    resultDesc: responseDescription,
  };

  promptHistory.unshift(promptRecord);
  if (promptHistory.length > 50) promptHistory.pop();

  if (input.userId) {
    auditLog(input.userId, "DARAJA_STK_PROMPT_SENT", "PAYMENT", recordId, {
      phoneNumber: normalizedPhone,
      amountKes: amount,
      checkoutRequestId,
      status,
    });
  }

  return {
    success: true,
    merchantRequestId,
    checkoutRequestId,
    responseDescription,
    customerMessage,
    recordId,
  };
}

export function handleDarajaCallback(callbackData: any): {
  success: boolean;
  message: string;
} {
  const stkCallback = callbackData?.Body?.stkCallback;
  if (!stkCallback) {
    return { success: false, message: "Invalid Daraja callback structure" };
  }

  const checkoutRequestId = stkCallback.CheckoutRequestID;
  const resultCode = stkCallback.ResultCode;
  const resultDesc = stkCallback.ResultDesc;

  const record = promptHistory.find(
    (p) => p.checkoutRequestId === checkoutRequestId
  );

  if (resultCode === 0) {
    // Payment successful!
    const items = stkCallback.CallbackMetadata?.Item || [];
    let receiptNumber = "MPESA" + Math.floor(Math.random() * 1000000);
    for (const item of items) {
      if (item.Name === "MpesaReceiptNumber") receiptNumber = String(item.Value);
    }

    if (record) {
      record.status = "COMPLETED";
      record.resultDesc = resultDesc;
      record.mpesaReceipt = receiptNumber;

      if (record.userId) {
        demoDeposit(
          record.userId,
          record.amountKes * 100,
          `daraja:${checkoutRequestId}`
        );
        auditLog(
          record.userId,
          "DARAJA_PAYMENT_SETTLED",
          "PAYMENT",
          record.id,
          {
            receiptNumber,
            amountKes: record.amountKes,
            checkoutRequestId,
          }
        );
      }
    }

    return { success: true, message: `Deposit confirmed: ${receiptNumber}` };
  } else {
    // Payment cancelled / rejected
    if (record) {
      record.status = "FAILED";
      record.resultDesc = resultDesc;
      if (record.userId) {
        auditLog(
          record.userId,
          "DARAJA_PAYMENT_FAILED",
          "PAYMENT",
          record.id,
          {
            resultCode,
            resultDesc,
            checkoutRequestId,
          }
        );
      }
    }
    return { success: false, message: `Payment failed: ${resultDesc}` };
  }
}
