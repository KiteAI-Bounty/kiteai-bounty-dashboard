export const rewardPolicyDraft = {
  version: "draft-v1",
  confirmed: false,
  milestones: [
    { throughWeek: 3, cumulativeUsdc: 25 },
    { throughWeek: 4, cumulativeUsdc: 40 },
  ],
  payoutStartsAfterWeek: 4,
  claimsEnabled: false,
} as const;

// Keep unconfirmed rules descriptive. No financial entitlement is computed in this scaffold.
