export interface EcPullRequest {
  number: number;
  url: string;
  upstreamRepositoryId: string;
  state: "open" | "closed";
  mergedAt: string | null;
  headSha: string;
}
export interface EcProvider {
  validate(
    batchId: string,
    revision: number,
  ): Promise<{ valid: boolean; log: string; contentHash: string }>;
  createOrUpdate(batchId: string, revision: number): Promise<EcPullRequest>;
  sync(prNumber: number): Promise<EcPullRequest>;
}
// Intentionally no merge() capability: EC maintainers control upstream merges.
