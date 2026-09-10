export interface MetricSnapshot {
  source: "electric_capital" | "web3insight";
  ecosystem: string;
  metric: string;
  value: number | null;
  windowStart: string | null;
  windowEnd: string | null;
  observedAt: string;
  sourceUrl: string;
}
export interface MetricsProvider {
  getSnapshots(ecosystem: string): Promise<MetricSnapshot[]>;
}
