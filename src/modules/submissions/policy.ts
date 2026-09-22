export function commitFitsSubmissionWindow(input: {
  authoredAt: Date;
  committedAt: Date;
  weekStartsAt: Date;
  weekEndsAt: Date;
  correctionRequestedAt?: Date | null;
  now?: Date;
}) {
  const authored = input.authoredAt.getTime();
  const committed = input.committedAt.getTime();
  const starts = input.weekStartsAt.getTime();
  const ends = input.weekEndsAt.getTime();
  if (![authored, committed, starts, ends].every(Number.isFinite)) return false;

  if (authored >= starts && authored < ends) return true;

  const requested = input.correctionRequestedAt?.getTime();
  if (!Number.isFinite(requested)) return false;
  const latestCommitTime = Math.max(authored, committed);
  const now = (input.now ?? new Date()).getTime();
  const clockSkewAllowance = 5 * 60 * 1000;
  return (
    latestCommitTime >= requested! &&
    latestCommitTime <= now + clockSkewAllowance
  );
}
