import "server-only";
import { readEnvironment } from "@/config/env";
import { getDb } from "@/lib/db";
import {
  initialCampaign,
  emptyWeekStatus,
  type CampaignView,
  type ProgressRow,
  type WeekStatus,
} from "./domain";
import { DEMO_NOW, demoProgress } from "./demo";

export async function getCampaignWorkspace(): Promise<{
  campaign: CampaignView;
  rows: ProgressRow[];
  demo: boolean;
  now: string;
}> {
  const env = readEnvironment(process.env);
  if (env.DATA_MODE === "demo")
    return {
      campaign: initialCampaign,
      rows: demoProgress,
      demo: true,
      now: DEMO_NOW,
    };
  const campaign = await getDb().campaign.findUnique({
    where: { id: initialCampaign.id },
    include: {
      periods: {
        orderBy: { startsAt: "asc" },
        include: { weeks: { orderBy: { number: "asc" } } },
      },
    },
  });
  if (!campaign)
    throw new Error(
      "Campaign is not initialized. Run npm run db:seed in your development database.",
    );
  const now = new Date();
  const period =
    campaign.periods.find(
      (item) => item.startsAt <= now && item.endsAt > now,
    ) ??
    campaign.periods.find((item) => item.startsAt > now) ??
    campaign.periods.at(-1);
  const weeks =
    period?.weeks.map((w) => ({
      id: w.id,
      number: w.number,
      startsAt: w.startsAt.toISOString(),
      endsAt: w.endsAt.toISOString(),
    })) ?? [];
  const enrolled = await getDb().enrollment.findMany({
    where: { campaignId: campaign.id },
    take: 100,
    orderBy: { createdAt: "asc" },
    include: {
      user: {
        include: {
          submissions: { where: { weekId: { in: weeks.map((w) => w.id) } } },
          completions: {
            where: { weekId: { in: weeks.map((w) => w.id) } },
            include: { registration: true },
          },
        },
      },
    },
  });
  const reviewMap: Record<string, WeekStatus> = {
    SUBMITTED: "reviewing",
    CHANGES_REQUESTED: "changes_requested",
    APPROVED: "awaiting_ec",
    REJECTED: "rejected",
  };
  const rows = enrolled.map(({ user }) => ({
    wallet: user.wallet,
    weeks: weeks.map((week) => {
      const submission = user.submissions.find((s) => s.weekId === week.id);
      const completion = user.completions.find(
        (c) => c.weekId === week.id && c.registration.status === "VERIFIED",
      );
      const status =
        submission?.status === "APPROVED" && completion
          ? "completed"
          : submission
            ? reviewMap[submission.status]
            : emptyWeekStatus(week, now);
      return { weekId: week.id, status };
    }),
  }));
  return {
    demo: false,
    now: now.toISOString(),
    rows,
    campaign: {
      id: campaign.id,
      name: campaign.name,
      startsAt: campaign.startsAt.toISOString(),
      timezone: campaign.timezone,
      targetMad: campaign.targetMad,
      weeks,
    },
  };
}

export async function getUserProgress(userId: string) {
  const { campaign, now } = await getCampaignWorkspace();
  const db = getDb();
  const [submissions, completions] = await Promise.all([
    db.submission.findMany({
      where: { userId, weekId: { in: campaign.weeks.map((week) => week.id) } },
      include: {
        repository: true,
        revisions: {
          orderBy: { version: "desc" },
          take: 1,
          include: {
            reviews: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
      },
    }),
    db.weeklyCompletion.findMany({
      where: { userId, weekId: { in: campaign.weeks.map((week) => week.id) } },
      include: { registration: true },
    }),
  ]);
  const reviewMap: Record<string, WeekStatus> = {
    SUBMITTED: "reviewing",
    CHANGES_REQUESTED: "changes_requested",
    APPROVED: "awaiting_ec",
    REJECTED: "rejected",
  };
  const weeks = campaign.weeks.map((week) => {
    const submission = submissions.find((item) => item.weekId === week.id);
    const completion = completions.find(
      (item) =>
        item.weekId === week.id && item.registration.status === "VERIFIED",
    );
    const status: WeekStatus =
      submission?.status === "APPROVED" && completion
        ? "completed"
        : submission
          ? reviewMap[submission.status]
          : emptyWeekStatus(week, new Date(now));
    return { weekId: week.id, status };
  });
  return { campaign, now, weeks, submissions };
}
