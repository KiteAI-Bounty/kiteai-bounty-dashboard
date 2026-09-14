"use client";

import { useState } from "react";

type Participant = { id: string; displayName: string; contact: string; githubLogin: string | null; wallet: string; status: string };

export function ParticipantList({ participants }: { participants: Participant[] }) {
  const [page, setPage] = useState(1);
  const size = 20;
  const pages = Math.max(1, Math.ceil(participants.length / size));
  const visible = participants.slice((page - 1) * size, page * size);
  return <>
    <div className="table-scroll"><table><thead><tr><th>参与者</th><th>联系方式</th><th>GitHub</th><th>钱包</th><th>状态</th></tr></thead><tbody>{visible.map((item) => <tr key={item.id}><td>{item.displayName}</td><td>{item.contact}</td><td>{item.githubLogin ? `@${item.githubLogin}` : "—"}</td><td className="mono">{item.wallet.slice(0, 7)}…{item.wallet.slice(-4)}</td><td><span className={`badge ${item.status === "ACTIVE" ? "green" : item.status === "DISABLED" ? "red" : "muted"}`}><span className="badge-dot" />{item.status === "ACTIVE" ? "已激活" : item.status === "DISABLED" ? "已禁用" : "待激活"}</span></td></tr>)}</tbody></table></div>
    {participants.length > size && <div className="table-pagination"><span>第 {page} / {pages} 页，共 {participants.length} 人</span><div><button className="button small" disabled={page === 1} onClick={() => setPage((v) => v - 1)}>上一页</button><button className="button small" disabled={page === pages} onClick={() => setPage((v) => v + 1)}>下一页</button></div></div>}
  </>;
}
