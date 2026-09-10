import { randomUUID } from "node:crypto";
import type { PaymentProvider } from "@/integrations/passport/contract";

/** Development provider. The production Agent Passport adapter will implement the same contract. */
export const mockPaymentProvider: PaymentProvider = {
  async submit(intent) {
    return { requestId: `mock_${randomUUID()}`, transactionHash: `0x${intent.claimId.padEnd(64, "0").slice(0, 64)}` };
  },
  async reconcile(requestId) {
    return { status: requestId.startsWith("mock_") ? "confirmed" : "unknown", transactionHash: null };
  },
};

export function getPaymentProvider(): PaymentProvider {
  if ((process.env.PAYMENT_PROVIDER_MODE ?? "mock") === "mock") return mockPaymentProvider;
  throw new Error("Agent Passport payment provider is not configured");
}
