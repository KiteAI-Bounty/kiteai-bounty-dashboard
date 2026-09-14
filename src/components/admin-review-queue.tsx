"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { directionLabel } from "@/modules/directions/catalog";

type ReviewItem = {
  id: string;
  status: string;
  ecStatus: string | null;
  ecPrUrl: string | null;
  ecFailure: string | null;
  version: number;
  user: { wallet: string; github: { login: string } | null };
  week: { number: number; startsAt: string; endsAt: string };
  repository: { owner: string; name: string; url: string };
  direction: string;
  revision: {
    id: string;
    version: number;
    summary: string;
    evidence: { sha: string; url: string }[];
  };
};

export function AdminReviewQueue({ items }: { items: ReviewItem[] }) {
  const [queue, setQueue] = useState(items);
  const [filter, setFilter] = useState("pending");
  const [page, setPage] = useState(1);
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [reviewDialog, setReviewDialog] = useState<{
    item: ReviewItem;
    decision: "APPROVED" | "CHANGES_REQUESTED" | "REJECTED";
  } | null>(null);
  const [note, setNote] = useState("");
  async function review(
    item: ReviewItem,
    decision: "APPROVED" | "CHANGES_REQUESTED" | "REJECTED",
  ) {
    if (decision !== "APPROVED" && !note.trim()) return;
    setBusy(item.id);
    setMessage("");
    try {
      const response = await fetch("/api/admin/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: item.id,
          revisionId: item.revision.id,
          version: item.revision.version,
          decision,
          note: note.trim() || "审核通过",
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "审核失败");
      setQueue((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: decision } : entry));
      router.refresh();
      setMessage(
        decision === "APPROVED"
          ? "审核通过，已进入 EC 登记队列，等待后台处理。"
          : "审核结果已保存。",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "审核失败");
    } finally {
      setBusy(null);
    }
  }
  function openReview(item: ReviewItem, decision: "APPROVED" | "CHANGES_REQUESTED" | "REJECTED") {
    setNote("");
    setReviewDialog({ item, decision });
  }
  const statusLabel: Record<string, string> = {
    SUBMITTED: "待审核",
    CHANGES_REQUESTED: "要求修改",
    APPROVED: "已通过 · EC处理中",
    REJECTED: "已拒绝",
  };
  const statusTone: Record<string, string> = {
    SUBMITTED: "blue",
    CHANGES_REQUESTED: "yellow",
    APPROVED: "green",
    REJECTED: "red",
  };
  function ecLabel(item: ReviewItem) {
    if (!item.ecStatus) return null;
    if (item.ecStatus === "VALIDATION_FAILED") return "EC提交失败";
    if (item.ecStatus === "PR_OPEN") return "EC PR审核中";
    if (item.ecStatus === "MERGED") return "EC已合并";
    if (item.ecStatus === "CLOSED_UNMERGED") return "EC未合并";
    if (item.ecStatus === "GENERATING") return "EC处理中";
    if (item.ecStatus === "READY") return "待创建 EC PR";
    return `EC ${item.ecStatus}`;
  }
  const groups = [
    { id: "pending", label: "待审核", match: (item: ReviewItem) => item.status === "SUBMITTED" || item.status === "CHANGES_REQUESTED" },
    { id: "reviewed", label: "已审核", match: (item: ReviewItem) => item.status === "APPROVED" && !item.ecStatus },
    { id: "ec-review", label: "EC 审核中", match: (item: ReviewItem) => ["GENERATING", "READY", "PR_OPEN"].includes(item.ecStatus ?? "") },
    { id: "ec-merged", label: "EC 已合并", match: (item: ReviewItem) => item.ecStatus === "MERGED" },
    { id: "failed", label: "审核失败", match: (item: ReviewItem) => item.status === "REJECTED" || ["VALIDATION_FAILED", "CLOSED_UNMERGED", "CI_FAILED"].includes(item.ecStatus ?? "") },
  ];
  const activeGroup = groups.find((group) => group.id === filter) ?? groups[0];
  const filteredItems = queue.filter(activeGroup.match);
  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const visibleItems = filteredItems.slice((page - 1) * pageSize, page * pageSize);
  if (!queue.length)
    return (
      <section className="panel empty-state">
        <h2>贡献提交记录</h2>
        <p>{message || "当前还没有提交记录。"}</p>
      </section>
    );
  return (
    <section className="panel review-queue">
      <div className="panel-title">
        <div>
          <h2>贡献提交记录</h2>
          <p>展示所有提交状态；待审核和要求修改的记录可以继续处理。</p>
        </div>
      </div>
      {message && <p className="review-message">{message}</p>}
      <div className="review-tabs" role="tablist" aria-label="提交状态筛选">
        {groups.map((group) => {
          const count = queue.filter(group.match).length;
          return <button key={group.id} className={`review-tab ${filter === group.id ? "active" : ""}`} onClick={() => { setFilter(group.id); setPage(1); }} role="tab" aria-selected={filter === group.id}>{group.label}<span>{count}</span></button>;
        })}
      </div>
      {filteredItems.length > pageSize && <div className="review-pagination"><span>第 {page} / {pageCount} 页，共 {filteredItems.length} 条</span><div><button className="button small" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>上一页</button><button className="button small" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>下一页</button></div></div>}
      <div className="review-table-wrap">
        <div className="review-table review-table-head"><span>参与者</span><span>仓库 / Commit</span><span>周次</span><span>状态</span><span>操作</span></div>
        {visibleItems.length ? visibleItems.map((item) => (
          <article className="review-table review-table-row" key={item.id}>
            <div className="review-card-head">
              <div>
                <strong>
                  {item.user.github
                    ? `@${item.user.github.login}`
                    : "未绑定 GitHub"}
                </strong>
                <small className="mono">
                  {item.user.wallet.slice(0, 8)}…{item.user.wallet.slice(-4)}
                </small>
              </div>
            </div>
            <div className="review-repo-cell"><a
              href={item.repository.url}
              target="_blank"
              rel="noreferrer"
              className="review-repo"
            >
              {item.repository.owner}/{item.repository.name}
            </a><span className="review-commit">{item.revision.evidence.map((e) => e.sha.slice(0, 8)).join(", ")}</span></div>
            <div className="review-week"><span>第 {item.week.number} 周</span><small>{directionLabel(item.direction)}</small></div>
            <div className="review-status-cell"><span className={`badge ${statusTone[item.status] ?? "muted"}`}>{statusLabel[item.status] ?? item.status}</span>{ecLabel(item) && <span className={`badge ${item.ecStatus === "VALIDATION_FAILED" ? "red" : item.ecStatus === "MERGED" ? "green" : "yellow"}`}>{ecLabel(item)}</span>}{item.ecPrUrl && <a href={item.ecPrUrl} target="_blank" rel="noreferrer" className="text-link review-pr-link">查看 PR</a>}{item.ecFailure && <small title={item.ecFailure}>{item.ecFailure}</small>}</div>
            {(item.status === "SUBMITTED" || item.status === "CHANGES_REQUESTED") && <div className="review-actions">
              <button
                className="button small dark"
                disabled={busy === item.id}
                onClick={() => openReview(item, "APPROVED")}
              >
                通过并提交 EC
              </button>
              <button
                className="button small"
                disabled={busy === item.id}
                onClick={() => openReview(item, "CHANGES_REQUESTED")}
              >
                要求修改
              </button>
              <button
                className="button small danger"
                disabled={busy === item.id}
                onClick={() => openReview(item, "REJECTED")}
              >
                拒绝
              </button>
            </div>}
          </article>
        )) : <div className="review-empty">该分类暂无记录</div>}
      </div>
      {reviewDialog && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setReviewDialog(null); }}>
        <div className="modal-card review-dialog" role="dialog" aria-modal="true" aria-labelledby="review-dialog-title">
          <h3 id="review-dialog-title">{reviewDialog.decision === "APPROVED" ? "确认通过并提交 EC" : reviewDialog.decision === "CHANGES_REQUESTED" ? "要求参与者修改" : "拒绝本次提交"}</h3>
          <p>{reviewDialog.decision === "APPROVED" ? "确认代码符合原创贡献和 KiteAI 关联要求后，系统会进入 EC 登记队列。备注可选。" : "请填写具体原因，参与者将看到审核结果。"}</p>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder={reviewDialog.decision === "APPROVED" ? "例如：已确认 Commit 为原创代码，且与 KiteAI 集成相关。" : "请说明需要修改或拒绝的原因"} rows={4} autoFocus />
          <div className="modal-actions"><button className="button ghost" onClick={() => setReviewDialog(null)}>取消</button><button className={`button ${reviewDialog.decision === "REJECTED" ? "danger" : "dark"}`} disabled={busy === reviewDialog.item.id || (reviewDialog.decision !== "APPROVED" && !note.trim())} onClick={async () => { const dialog = reviewDialog; setReviewDialog(null); await review(dialog.item, dialog.decision); }}>确认</button></div>
        </div>
      </div>}
    </section>
  );
}
