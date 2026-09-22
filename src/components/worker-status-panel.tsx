"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Play } from "lucide-react";
import type { WorkerQueueStatus } from "@/workers/status";

function duration(seconds: number | null) {
  if (seconds === null) return "无到期任务";
  if (seconds < 60) return `${seconds} 秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟`;
  return `${Math.floor(seconds / 3600)} 小时`;
}

export function WorkerStatusPanel({ initial }: { initial: WorkerQueueStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");

  async function runOnce() {
    setRunning(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/worker", { method: "POST" });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error?.message ?? "Worker 执行失败");
      setStatus(payload.data.status);
      setMessage(
        payload.data.processed
          ? "已处理一个队列任务。"
          : "当前没有到期的待处理任务。",
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Worker 执行失败");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="panel worker-status-panel">
      <div className="panel-title">
        <div>
          <h2>Worker 队列</h2>
          <p>超过 5 分钟仍未领取会标记为异常；管理员可手动处理一个任务。</p>
        </div>
        <span className={`badge ${status.healthy ? "green" : "red"}`}>
          <Activity size={12} />
          {status.healthy ? "运行正常" : "需要处理"}
        </span>
      </div>
      <div className="worker-status-grid">
        <div>
          <strong>{status.due}</strong>
          <span>已到期</span>
        </div>
        <div>
          <strong>{status.running}</strong>
          <span>处理中</span>
        </div>
        <div>
          <strong>{status.failed}</strong>
          <span>失败</span>
        </div>
        <div>
          <strong>{duration(status.oldestDueAgeSeconds)}</strong>
          <span>最老等待</span>
        </div>
      </div>
      <div className="worker-status-actions">
        <button className="button small" onClick={runOnce} disabled={running}>
          <Play size={14} />
          {running ? "正在处理…" : "立即处理一个任务"}
        </button>
        {message && <p className="form-message">{message}</p>}
      </div>
    </section>
  );
}
