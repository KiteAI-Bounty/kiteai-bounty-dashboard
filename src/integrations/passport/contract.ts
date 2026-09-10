export interface PaymentIntent {
  claimId: string;
  chainId: number;
  recipient: string;
  tokenAddress: string;
  amountUnits: string;
  policyVersion: string;
}
export interface PaymentProvider {
  submit(
    intent: PaymentIntent,
  ): Promise<{ requestId: string; transactionHash: string | null }>;
  reconcile(requestId: string): Promise<{
    status: "pending" | "confirmed" | "failed" | "unknown";
    transactionHash: string | null;
  }>;
}
// Contract only. No implementation, signing credentials, or execution is enabled.
