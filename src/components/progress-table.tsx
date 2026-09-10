"use client";

import { useState } from "react";
import { Search, Copy, Check, SlidersHorizontal } from "lucide-react";
import {
  type ProgressRow,
  type Week,
  weekLabel,
} from "@/modules/campaigns/domain";
import { StatusBadge } from "./ui";

export function ProgressTable({
  rows,
  weeks,
}: {
  rows: ProgressRow[];
  weeks: Week[];
}) {
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState("all");
  const [onlyCompleted, setOnlyCompleted] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [copyError, setCopyError] = useState("");
  const months = [
    ...new Set(
      weeks.flatMap((w) =>
        [w.startsAt, new Date(Date.parse(w.endsAt) - 1).toISOString()].map(
          (date) =>
            new Intl.DateTimeFormat("sv-SE", {
              timeZone: "Asia/Shanghai",
              year: "numeric",
              month: "2-digit",
            }).format(new Date(date)),
        ),
      ),
    ),
  ];
  const [year, monthNumber] = month.split("-").map(Number);
  const monthEnd = Date.UTC(year, monthNumber, 1) - 8 * 60 * 60 * 1000;
  const visibleWeeks = weeks.filter(
    (w) =>
      month === "all" ||
      (Date.parse(w.startsAt) < monthEnd &&
        Date.parse(w.endsAt) > Date.parse(`${month}-01T00:00:00+08:00`)),
  );
  const filtered = rows.filter(
    (row) =>
      row.wallet.toLowerCase().includes(query.toLowerCase()) &&
      (!onlyCompleted ||
        row.weeks.some(
          (w) =>
            visibleWeeks.some((week) => week.id === w.weekId) &&
            w.status === "completed",
        )),
  );
  async function copy(wallet: string) {
    try {
      await navigator.clipboard.writeText(wallet);
      setCopied(wallet);
      setCopyError("");
    } catch {
      setCopyError("复制失败，请选中钱包地址手动复制。");
    }
  }
  return (
    <section className="panel progress-panel">
      <div className="panel-title">
        <div>
          <h2>
            开发者参与进度 <span className="count">{rows.length}</span>
          </h2>
          <p>每人每周一份贡献 · 钱包与逐周状态公开可见</p>
        </div>
        <select
          aria-label="筛选统计月份"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        >
          <option value="all">首期全部周次</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {m.replace("-", " 年 ")} 月
            </option>
          ))}
        </select>
      </div>
      <div className="table-toolbar">
        <label className="search">
          <Search size={16} />
          <input
            aria-label="搜索钱包地址"
            placeholder="搜索钱包地址…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button
          className={`button small ${onlyCompleted ? "selected" : ""}`}
          aria-pressed={onlyCompleted}
          onClick={() => setOnlyCompleted(!onlyCompleted)}
        >
          <SlidersHorizontal size={14} />
          仅看已完成
        </button>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>开发者钱包</th>
              {visibleWeeks.map((w) => (
                <th key={w.id}>
                  <span>第 {w.number} 周</span>
                  <small>{weekLabel(w)}</small>
                </th>
              ))}
              <th>已完成</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr key={row.wallet}>
                <td>
                  <div className="wallet-cell">
                    <span className={`avatar avatar-${i % 4}`}>
                      {row.wallet.slice(-2)}
                    </span>
                    <span className="mono" title={row.wallet}>
                      {row.wallet.slice(0, 6)}…{row.wallet.slice(-4)}
                    </span>
                    <button
                      className="icon-button"
                      aria-label={`复制钱包 ${row.wallet}`}
                      onClick={() => copy(row.wallet)}
                    >
                      {copied === row.wallet ? (
                        <Check size={13} />
                      ) : (
                        <Copy size={13} />
                      )}
                    </button>
                  </div>
                </td>
                {visibleWeeks.map((w) => (
                  <td key={w.id}>
                    <StatusBadge
                      status={
                        row.weeks.find((s) => s.weekId === w.id)?.status ??
                        "not_started"
                      }
                    />
                  </td>
                ))}
                <td>
                  <span className="completed-count">
                    {
                      row.weeks.filter(
                        (w) =>
                          visibleWeeks.some((v) => v.id === w.weekId) &&
                          w.status === "completed",
                      ).length
                    }
                  </span>
                  <span className="muted-text"> / {visibleWeeks.length}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && (
        <div className="empty-table">没有符合条件的参与者</div>
      )}
      <div className="table-footer">
        <span>显示 {filtered.length} 位开发者 · 北京时间（UTC+8）</span>
        <span role="status">
          {copyError ||
            (copied ? "钱包地址已复制" : "EC 等待状态会在登记核实后更新")}
        </span>
      </div>
    </section>
  );
}
