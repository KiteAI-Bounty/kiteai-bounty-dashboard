"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SubmissionForm({ disabled = false, initialStatus = null }: { disabled?: boolean; initialStatus?: string | null }) {
  const router = useRouter();
  const [links, setLinks] = useState("");
  const [summary, setSummary] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(initialStatus);

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
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error?.message ?? "提交失败，请稍后重试。");
      setMessage("提交成功，已进入管理员审核。");
      setStatus("SUBMITTED");
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
      <label>
        本周 Commit 链接
        <textarea
          rows={4}
          value={links}
          onChange={(event) => setLinks(event.target.value)}
          placeholder="https://github.com/owner/repository/commit/sha"
          required
          disabled={disabled || busy}
        />
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
          disabled={disabled || busy}
        />
      </label>
      {message && <p className="form-message">{message}</p>}
      {status && <p className="submission-status">当前状态：{status === "SUBMITTED" ? "待审核" : status === "CHANGES_REQUESTED" ? "要求修改" : status === "APPROVED" ? "已通过，等待 EC" : status === "REJECTED" ? "已拒绝" : status}</p>}
      <button className="button dark" type="submit" disabled={disabled || busy}>
        {busy ? "提交中…" : "提交本周贡献"}
      </button>
    </form>
  );
}
