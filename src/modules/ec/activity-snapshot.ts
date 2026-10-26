export type EcActiveDeveloper = {
  githubLogin: string;
  repository: string;
  commits: number;
};

export const ecActivitySnapshot = {
  ecosystem: "KiteAI",
  ecosystemId: 16986,
  snapshotVersion: "20261025T125843",
  snapshotGeneratedAt: "2026-10-25T13:29:03.689Z",
  activityFrom: "2026-09-20",
  activityThrough: "2026-10-17",
  oneTimeDevelopers: 10,
  partTimeDevelopers: 3,
  fullTimeDevelopers: 0,
  sourceUrl: "https://data.developerreport.com/index.html",
  developers: [
    {
      githubLogin: "CarryWang",
      repository: "CarryWang/kite-x402-explorer",
      commits: 29,
    },
    {
      githubLogin: "BrKDDD",
      repository: "BrKDDD/kite-x402-hono",
      commits: 14,
    },
    {
      githubLogin: "tianzeshi-study",
      repository: "tianzeshi-study/kite-x402-axum",
      commits: 5,
    },
    {
      githubLogin: "specificpict",
      repository: "CarryWang/kite-x402-explorer",
      commits: 4,
    },
    {
      githubLogin: "Anyi-zheng",
      repository: "CarryWang/kite-x402-explorer",
      commits: 3,
    },
    {
      githubLogin: "ellipticalisl",
      repository: "CarryWang/kite-x402-explorer",
      commits: 3,
    },
    {
      githubLogin: "pwnmonk",
      repository: "BrKDDD/kite-x402-hono",
      commits: 3,
    },
    {
      githubLogin: "importantoff",
      repository: "BrKDDD/kite-x402-hono",
      commits: 2,
    },
    {
      githubLogin: "heartyenclav",
      repository: "BrKDDD/kite-x402-hono",
      commits: 2,
    },
    {
      githubLogin: "unfitpolyp",
      repository: "BrKDDD/kite-x402-hono",
      commits: 2,
    },
    {
      githubLogin: "tancyclamen",
      repository: "BrKDDD/kite-x402-hono",
      commits: 2,
    },
    {
      githubLogin: "orderlyozone",
      repository: "BrKDDD/kite-x402-hono",
      commits: 1,
    },
    {
      githubLogin: "clutteredvar",
      repository: "BrKDDD/kite-x402-hono",
      commits: 1,
    },
  ] satisfies EcActiveDeveloper[],
} as const;

export function ecSnapshotCommitCount() {
  return ecActivitySnapshot.developers.reduce(
    (total, developer) => total + developer.commits,
    0,
  );
}
