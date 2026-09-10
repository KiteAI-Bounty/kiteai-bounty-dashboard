-- Shift the development campaign start to 2026-09-09 00:00 Asia/Shanghai.
-- Stored timestamps are UTC.
UPDATE "Campaign"
SET "startsAt" = TIMESTAMPTZ '2026-09-08 16:00:00+00'
WHERE "id" = 'kiteai-2026';

UPDATE "RewardPeriod"
SET
  "startsAt" = TIMESTAMPTZ '2026-09-08 16:00:00+00',
  "endsAt" = TIMESTAMPTZ '2026-10-06 16:00:00+00',
  "payoutFrom" = TIMESTAMPTZ '2026-10-06 16:00:00+00'
WHERE "id" = 'kiteai-p1';

UPDATE "CampaignWeek"
SET "startsAt" = TIMESTAMPTZ '2026-09-08 16:00:00+00', "endsAt" = TIMESTAMPTZ '2026-09-15 16:00:00+00'
WHERE "id" = 'kiteai-p1-w1';

UPDATE "CampaignWeek"
SET "startsAt" = TIMESTAMPTZ '2026-09-15 16:00:00+00', "endsAt" = TIMESTAMPTZ '2026-09-22 16:00:00+00'
WHERE "id" = 'kiteai-p1-w2';

UPDATE "CampaignWeek"
SET "startsAt" = TIMESTAMPTZ '2026-09-22 16:00:00+00', "endsAt" = TIMESTAMPTZ '2026-09-29 16:00:00+00'
WHERE "id" = 'kiteai-p1-w3';

UPDATE "CampaignWeek"
SET "startsAt" = TIMESTAMPTZ '2026-09-29 16:00:00+00', "endsAt" = TIMESTAMPTZ '2026-10-06 16:00:00+00'
WHERE "id" = 'kiteai-p1-w4';
