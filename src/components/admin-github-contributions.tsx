"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export type GithubPullRequestItem = {
  id: string;
  reportMonth: string;
  source: string;
  repoOwner: string;
  repoName: string;
  prNumber: number;
  url: string;
  title: string;
  authorLogin: string;
  authorType: string;
  state: string;
  isDraft: boolean;
  createdAt: string;
  mergedAt: string | null;
  syncedAt: string;
};

function dateTimeLabel(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function statusLabel(item: GithubPullRequestItem) {
  if (item.state === "MERGED") return "已合并";
  if (item.state === "OPEN") return item.isDraft ? "草稿" : "待合并";
  return "关闭未合并";
}

export function AdminGithubContributions({
  reportMonth,
  items,
}: {
  reportMonth: string;
  items: GithubPullRequestItem[];
}) {
  const router = useRouter();
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const lastSyncedAt = items.reduce(
    (latest, item) =>
      Date.parse(item.syncedAt) > Date.parse(latest) ? item.syncedAt : latest,
    items[0]?.syncedAt ?? "1970-01-01T00:00:00.000Z",
  );
  const humanItems = items.filter(
    (item) => item.authorType.toLowerCase() !== "bot",
  );
  const humanDevelopers = new Set(
    humanItems.map((item) => item.authorLogin.toLowerCase()),
  ).size;
  const sourceItems = items.filter(
    (item) => sourceFilter === "all" || item.source === sourceFilter,
  );
  const filteredItems = sourceItems.filter(
    (item) => statusFilter === "all" || item.state === statusFilter,
  );
  const pageSize = 25;
  const pageCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const visibleItems = filteredItems.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );
  const sources = [
    { id: "all", label: "全部来源" },
    { id: "ACTIVE_REPO", label: "5 个活跃仓库" },
    { id: "EC_TAXONOMY", label: "EC 登记 PR" },
  ];
  const statuses = [
    { id: "all", label: "全部状态" },
    { id: "MERGED", label: "已合并" },
    { id: "OPEN", label: "待合并" },
    { id: "CLOSED", label: "关闭未合并" },
  ];

  async function sync() {
    setSyncing(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/github-contributions/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportMonth }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error?.message ?? "GitHub PR 同步失败");
      setMessage(
        `同步完成：${result.data.pullRequests} 个 PR，${result.data.humanDevelopers} 名真人开发者。`,
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "GitHub PR 同步失败");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <section className="panel github-contributions">
      <div className="panel-title">
        <div>
          <h2>第二个月 · GitHub PR 统计</h2>
          <p>
            {reportMonth} · 统计 5 个活跃仓库及 Electric Capital 的 KiteAI 登记
            PR，与第一期平台提交分开保存。
            {items.length > 0 && ` 最后同步：${dateTimeLabel(lastSyncedAt)}。`}
          </p>
        </div>
        <button
          className="button small"
          type="button"
          disabled={syncing}
          onClick={() => void sync()}
        >
          <RefreshCw size={14} />
          {syncing ? "正在同步" : "同步 GitHub"}
        </button>
      </div>
      {message && <p className="review-message">{message}</p>}
      <div className="github-contribution-stats">
        <span>
          <strong>{items.length}</strong> 个 PR
        </span>
        <span>
          <strong>{humanDevelopers}</strong> 名真人开发者
        </span>
        <span>
          <strong>
            {items.filter((item) => item.source === "ACTIVE_REPO").length}
          </strong>{" "}
          个活跃仓库 PR
        </span>
        <span>
          <strong>
            {items.filter((item) => item.source === "EC_TAXONOMY").length}
          </strong>{" "}
          个 EC PR
        </span>
        <span>
          <strong>
            {items.filter((item) => item.state === "MERGED").length}
          </strong>{" "}
          个已合并
        </span>
      </div>
      <div className="review-tabs github-filter-tabs" role="tablist">
        {sources.map((source) => (
          <button
            key={source.id}
            className={`review-tab ${sourceFilter === source.id ? "active" : ""}`}
            onClick={() => {
              setSourceFilter(source.id);
              setPage(1);
            }}
            role="tab"
            aria-selected={sourceFilter === source.id}
          >
            {source.label}
            <span>
              {
                items.filter(
                  (item) => source.id === "all" || item.source === source.id,
                ).length
              }
            </span>
          </button>
        ))}
      </div>
      <div className="review-tabs" role="tablist">
        {statuses.map((status) => (
          <button
            key={status.id}
            className={`review-tab ${statusFilter === status.id ? "active" : ""}`}
            onClick={() => {
              setStatusFilter(status.id);
              setPage(1);
            }}
            role="tab"
            aria-selected={statusFilter === status.id}
          >
            {status.label}
            <span>
              {
                sourceItems.filter(
                  (item) => status.id === "all" || item.state === status.id,
                ).length
              }
            </span>
          </button>
        ))}
      </div>
      {filteredItems.length > pageSize && (
        <div className="review-pagination">
          <span>
            第 {page} / {pageCount} 页，共 {filteredItems.length} 条
          </span>
          <div>
            <button
              className="button small"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              上一页
            </button>
            <button
              className="button small"
              disabled={page >= pageCount}
              onClick={() => setPage((current) => current + 1)}
            >
              下一页
            </button>
          </div>
        </div>
      )}
      <div className="github-pr-table-wrap">
        <div className="github-pr-table github-pr-table-head">
          <span>开发者</span>
          <span>来源 / 仓库</span>
          <span>Pull Request</span>
          <span>状态</span>
          <span>创建时间</span>
        </div>
        {visibleItems.length ? (
          visibleItems.map((item) => (
            <article
              className="github-pr-table github-pr-table-row"
              key={item.id}
            >
              <div>
                <strong>@{item.authorLogin}</strong>
                {item.authorType.toLowerCase() === "bot" && <small>Bot</small>}
              </div>
              <div>
                <span>
                  {item.source === "EC_TAXONOMY" ? "EC 登记" : "活跃仓库"}
                </span>
                <small>
                  {item.repoOwner}/{item.repoName}
                </small>
              </div>
              <a href={item.url} target="_blank" rel="noreferrer">
                <strong>#{item.prNumber}</strong>
                <span>{item.title}</span>
              </a>
              <span
                className={`badge ${item.state === "MERGED" ? "green" : item.state === "OPEN" ? "yellow" : "muted"}`}
              >
                {statusLabel(item)}
              </span>
              <div>
                <span>{dateTimeLabel(item.createdAt)}</span>
                {item.mergedAt && (
                  <small>合并于 {dateTimeLabel(item.mergedAt)}</small>
                )}
              </div>
            </article>
          ))
        ) : (
          <div className="review-empty">
            尚未同步本月 GitHub PR，或当前筛选没有记录。
          </div>
        )}
      </div>
    </section>
  );
}
