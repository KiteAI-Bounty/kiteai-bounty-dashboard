export type EcActiveDeveloper = {
  githubLogin: string;
  repository: string;
  commits: number;
};

export const ecActivitySnapshot = {
  ecosystem: "KiteAI",
  ecosystemId: 16986,
  activityThrough: "2026-09-30",
  sourceUrl: "https://data.developerreport.com/index.html",
  developers: [
    {
      githubLogin: "CarryWang",
      repository: "CarryWang/kite-x402-explorer",
      commits: 16,
    },
    {
      githubLogin: "BrKDDD",
      repository: "BrKDDD/kite-x402-hono",
      commits: 6,
    },
    {
      githubLogin: "tianzeshi-study",
      repository: "tianzeshi-study/kite-x402-axum",
      commits: 4,
    },
  ] satisfies EcActiveDeveloper[],
} as const;

export function ecSnapshotCommitCount() {
  return ecActivitySnapshot.developers.reduce(
    (total, developer) => total + developer.commits,
    0,
  );
}
