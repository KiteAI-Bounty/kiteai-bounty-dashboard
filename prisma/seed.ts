import "dotenv/config";
import { readEnvironment } from "../src/config/env";
import { getDb } from "../src/lib/db";
import { initialCampaign } from "../src/modules/campaigns/domain";
import { rewardPolicyDraft } from "../src/modules/rewards/policy";

async function main() {
  const env = readEnvironment(process.env);
  if (env.APP_ENV !== "development")
    throw new Error(
      "This draft seed is development-only; production campaign policy needs confirmation.",
    );
  const db = getDb();
  // Idempotent and non-destructive: never overwrite configured dates or rules on rerun.
  await db.$transaction(async (tx) => {
    await tx.campaign.upsert({
      where: { id: initialCampaign.id },
      update: {
        startsAt: new Date(initialCampaign.startsAt),
      },
      create: {
        id: initialCampaign.id,
        name: initialCampaign.name,
        startsAt: new Date(initialCampaign.startsAt),
        timezone: initialCampaign.timezone,
        targetMad: initialCampaign.targetMad,
      },
    });
    await tx.rewardPeriod.upsert({
      where: { id: "kiteai-p1" },
      update: {
        startsAt: new Date(initialCampaign.startsAt),
        endsAt: new Date(initialCampaign.weeks[3].endsAt),
        payoutFrom: new Date(initialCampaign.weeks[3].endsAt),
      },
      create: {
        id: "kiteai-p1",
        campaignId: initialCampaign.id,
        name: "首期四周（草案）",
        startsAt: new Date(initialCampaign.startsAt),
        endsAt: new Date(initialCampaign.weeks[3].endsAt),
        payoutFrom: new Date(initialCampaign.weeks[3].endsAt),
        policy: rewardPolicyDraft,
      },
    });
    for (const week of initialCampaign.weeks) {
      await tx.campaignWeek.upsert({
        where: { id: week.id },
        update: {
          startsAt: new Date(week.startsAt),
          endsAt: new Date(week.endsAt),
        },
        create: {
          id: week.id,
          periodId: "kiteai-p1",
          number: week.number,
          startsAt: new Date(week.startsAt),
          endsAt: new Date(week.endsAt),
        },
      });
    }
  });
  console.log(
    "Initialized draft campaign and 4 weeks; no users, approvals, EC records, or rewards were fabricated.",
  );
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getDb().$disconnect();
  });
