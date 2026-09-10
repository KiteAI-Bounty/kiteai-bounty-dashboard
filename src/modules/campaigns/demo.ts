import { initialCampaign, type ProgressRow, type WeekStatus } from "./domain";

// Deliberately synthetic identities. The entire demo uses an explicit simulated clock.
export const DEMO_NOW = "2026-09-30T10:00:00+08:00";
const statuses: WeekStatus[][] = [
  ["completed", "completed", "not_submitted", "not_started"],
  ["completed", "awaiting_ec", "reviewing", "not_started"],
  ["completed", "completed", "completed", "not_started"],
  ["awaiting_ec", "awaiting_ec", "reviewing", "not_started"],
  ["completed", "changes_requested", "not_submitted", "not_started"],
  ["rejected", "completed", "reviewing", "not_started"],
];
export const demoProgress: ProgressRow[] = statuses.map((values, index) => ({
  wallet: `0x${(index + 1).toString(16).padStart(40, "0")}`,
  weeks: initialCampaign.weeks.map((week, i) => ({
    weekId: week.id,
    status: values[i],
  })),
}));
