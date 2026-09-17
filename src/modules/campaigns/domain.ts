export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export const CAMPAIGN_START = "2026-09-14T00:00:00+08:00";

export type Week = {
  id: string;
  number: number;
  startsAt: string;
  endsAt: string;
};
export type WeekStatus =
  | "not_started"
  | "not_submitted"
  | "reviewing"
  | "changes_requested"
  | "awaiting_ec"
  | "completed"
  | "rejected"
  | "missed";
export type ProgressRow = {
  wallet: string;
  weeks: { weekId: string; status: WeekStatus }[];
};
export type CampaignView = {
  id: string;
  name: string;
  startsAt: string;
  timezone: string;
  targetMad: number;
  weeks: Week[];
};

export const initialCampaign: CampaignView = {
  id: "kiteai-2026",
  name: "KiteAI 开源 Bounty",
  startsAt: CAMPAIGN_START,
  timezone: "Asia/Shanghai",
  targetMad: 50,
  weeks: Array.from({ length: 4 }, (_, i) => ({
    id: `kiteai-p1-w${i + 1}`,
    number: i + 1,
    startsAt: new Date(Date.parse(CAMPAIGN_START) + i * WEEK_MS).toISOString(),
    endsAt: new Date(
      Date.parse(CAMPAIGN_START) + (i + 1) * WEEK_MS,
    ).toISOString(),
  })),
};

export function currentWeek(weeks: Week[], now: Date) {
  return weeks.find(
    (week) =>
      now.getTime() >= Date.parse(week.startsAt) &&
      now.getTime() < Date.parse(week.endsAt),
  );
}

export function emptyWeekStatus(week: Week, now: Date): WeekStatus {
  if (now.getTime() < Date.parse(week.startsAt)) return "not_started";
  if (now.getTime() >= Date.parse(week.endsAt)) return "missed";
  return "not_submitted";
}

export function weekLabel(week: Week) {
  const format = (date: Date) =>
    new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  return `${format(new Date(week.startsAt))} – ${format(new Date(Date.parse(week.endsAt) - 1))}`;
}
