"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { contributionDirections } from "@/modules/directions/catalog";

type AiAnalysis = {
  scope: string | null;
  status: string;
  verdict: string | null;
  summary: string | null;
  findings: unknown;
  model: string | null;
  activeDays: number;
  missingEvidence: string[];
};

export function SubmissionForm({
  disabled = false,
  previousProject = null,
  targetWeekId,
  initialDirection,
  correctionNote,
  initialStatus = null,
  initialAnalysis = null,
}: {
  disabled?: boolean;
  previousProject?: {
    name: string;
    url: string;
    direction: string;
  } | null;
  targetWeekId?: string;
  initialDirection?: string | null;
  correctionNote?: string | null;
  initialStatus?: string | null;
  initialAnalysis?: AiAnalysis | null;
}) {
  const router = useRouter();
  const [links, setLinks] = useState("");
  const [summary, setSummary] = useState("");
  const [direction, setDirection] = useState<string>(
    previousProject?.direction ??
      initialDirection ??
      contributionDirections[0].value,
  );
  const [reusePreviousProject, setReusePreviousProject] = useState(
    Boolean(previousProject),
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(initialStatus);
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(initialAnalysis);
  const submissionLocked = Boolean(status && status !== "CHANGES_REQUESTED");
  const controlsDisabled = disabled || busy || submissionLocked;

  useEffect(() => {
    if (
      !status ||
      !analysis ||
      !["PENDING", "RUNNING"].includes(analysis.status)
    )
      return;
    let stopped = false;
    let attempts = 0;
    const timer = window.setInterval(async () => {
      attempts += 1;
      try {
        const query = targetWeekId
          ? `?weekId=${encodeURIComponent(targetWeekId)}`
          : "";
        const response = await fetch(`/api/submissions${query}`, {
          credentials: "same-origin",
          cache: "no-store",
        });
        const result = await response.json();
        if (!response.ok || stopped) return;
        if (result.data?.status) setStatus(result.data.status);
        if (result.data?.ai) setAnalysis(result.data.ai);
        if (
          !result.data?.ai ||
          !["PENDING", "RUNNING"].includes(result.data.ai.status) ||
          attempts >= 12
        )
          window.clearInterval(timer);
      } catch {
        if (attempts >= 12) window.clearInterval(timer);
      }
    }, 5000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [analysis, status, targetWeekId]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evidenceUrls: links
            .split(/\r?\n/)
            .map((item) => item.trim())
            .filter(Boolean),
          summary,
          targetWeekId,
          direction,
          reusePreviousProject,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error?.message ?? "提交失败，请稍后重试。");
      setMessage("提交成功，正在进行 AI 预检查并等待管理员审核。");
      setStatus("SUBMITTED");
      setAnalysis({
        scope: result.data?.aiScope ?? "REPOSITORY",
        status: "PENDING",
        verdict: null,
        summary: "正在分析仓库和 Commit 证据。",
        findings: null,
        model: null,
        activeDays: 0,
        missingEvidence: [],
      });
      router.refresh();
      setLinks("");
      setSummary("");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "提交失败，请稍后重试。",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="submission-repository-notice" role="note">
        <strong>请使用自己的项目仓库</strong>
        <p>
          请优先提交由本人 GitHub
          账号拥有的独立公开仓库，不要提交他人的仓库或尚未合并的分支。若向
          gokite-ai 官方仓库贡献，必须先合并到主分支后再提交对应 Commit。
        </p>
      </div>
      {status === "CHANGES_REQUESTED" && (
        <div className="submission-ai warning" role="status">
          <strong>管理员要求修改本次提交</strong>
          <p>
            {correctionNote ??
              "请重新提交该统计周内的有效 Commit 链接和完整完成说明。"}
          </p>
        </div>
      )}
      {previousProject && reusePreviousProject ? (
        <div className="continuation-card">
          <div>
            <small>继续上周项目</small>
            <a href={previousProject.url} target="_blank" rel="noreferrer">
              {previousProject.name}
            </a>
            <p>
              {
                contributionDirections.find(
                  (item) => item.value === previousProject.direction,
                )?.label
              }
              · 本周只需提交新的 Commit 和完成说明
            </p>
          </div>
          <button
            className="text-link"
            type="button"
            disabled={controlsDisabled}
            onClick={() => setReusePreviousProject(false)}
          >
            更换项目或方向
          </button>
        </div>
      ) : (
        <>
          {previousProject && (
            <button
              className="text-link reuse-project-link"
              type="button"
              disabled={controlsDisabled}
              onClick={() => {
                setDirection(previousProject.direction);
                setReusePreviousProject(true);
              }}
            >
              继续使用上周项目 {previousProject.name}
            </button>
          )}
          <label>
            项目方向
            <select
              value={direction}
              onChange={(event) => setDirection(event.target.value)}
              required
              disabled={controlsDisabled}
            >
              {contributionDirections.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <small className="field-help">
              {
                contributionDirections.find((item) => item.value === direction)
                  ?.description
              }
            </small>
          </label>
        </>
      )}
      <label>
        本周 Commit 链接
        <textarea
          rows={4}
          value={links}
          onChange={(event) => setLinks(event.target.value)}
          placeholder="https://github.com/owner/repository/commit/sha"
          required
          disabled={controlsDisabled}
        />
        <small className="field-help">
          支持提交个人独立开源仓库的 Commit。若向官方组织（如
          gokite-ai）贡献，必须在 PR 合并至主分支后方可提交对应 Commit。
        </small>
      </label>
      <label>
        本周完成说明
        <textarea
          rows={4}
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          placeholder="说明代码变更及其与 KiteAI 的关联"
          minLength={20}
          maxLength={4000}
          required
          disabled={controlsDisabled}
        />
      </label>
      {message && <p className="form-message">{message}</p>}
      {analysis && (
        <div
          className={`submission-ai ${analysis.verdict === "HIGH_RISK" ? "danger" : analysis.verdict === "CHANGES_RECOMMENDED" ? "warning" : ""}`}
        >
          <strong>
            AI 预检查 ·{" "}
            {analysis.status === "SUCCEEDED"
              ? analysis.verdict === "PASS_RECOMMENDED"
                ? "建议通过"
                : analysis.verdict === "CHANGES_RECOMMENDED"
                  ? "建议补充"
                  : "高风险"
              : analysis.status === "FAILED"
                ? "分析失败"
                : analysis.status === "SKIPPED"
                  ? "尚未配置"
                  : "分析中"}
          </strong>
          <p>{analysis.summary ?? "正在等待分析结果。"}</p>
          {analysis.status === "SUCCEEDED" && (
            <p>本次证据覆盖 {analysis.activeDays} 个贡献日。</p>
          )}
          {analysis.missingEvidence.length > 0 && (
            <ul>
              {analysis.missingEvidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          <small>
            {analysis.scope === "COMMIT"
              ? "本次只检查新 Commit，不会重复创建 EC PR。"
              : "本次包含首次仓库登记检查。"}
            {analysis.model ? ` · ${analysis.model}` : ""}
          </small>
        </div>
      )}
      {status && (
        <p className="submission-status">
          当前状态：
          {status === "SUBMITTED"
            ? "待审核"
            : status === "CHANGES_REQUESTED"
              ? "要求修改，可重新提交"
              : status === "APPROVED"
                ? "已通过，等待 EC"
                : status === "REJECTED"
                  ? "已拒绝"
                  : status}
        </p>
      )}
      <button className="button dark" type="submit" disabled={controlsDisabled}>
        {busy
          ? "提交中…"
          : status === "CHANGES_REQUESTED"
            ? "提交修改版本"
            : status === "REJECTED"
              ? "本周提交已关闭"
              : submissionLocked
                ? "本周已提交"
                : "提交本周贡献"}
      </button>
    </form>
  );
}
