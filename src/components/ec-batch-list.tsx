"use client";

import { useState } from "react";

type Batch = { id: string; status: string; prUrl: string | null; prNumber: number | null; createdAt: string; items: { repository: { owner: string; name: string } }[] };

export function EcBatchList({ batches }: { batches: Batch[] }) {
  const [page, setPage] = useState(1);
  const size = 20;
  const pages = Math.max(1, Math.ceil(batches.length / size));
  const visible = batches.slice((page - 1) * size, page * size);
  return <>
    <div className="table-scroll"><table><thead><tr><th>仓库</th><th>状态</th><th>PR</th><th>创建时间</th></tr></thead><tbody>{visible.map((batch) => <tr key={batch.id}><td>{batch.items.map((item) => <div key={`${batch.id}-${item.repository.owner}/${item.repository.name}`}>{item.repository.owner}/{item.repository.name}</div>)}</td><td><span className="badge muted"><span className="badge-dot" />{batch.status}</span></td><td>{batch.prUrl ? <a className="text-link" href={batch.prUrl} target="_blank" rel="noreferrer">#{batch.prNumber}</a> : "—"}</td><td>{new Date(batch.createdAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</td></tr>)}</tbody></table></div>
    {batches.length > size && <div className="table-pagination"><span>第 {page} / {pages} 页，共 {batches.length} 个批次</span><div><button className="button small" disabled={page === 1} onClick={() => setPage((v) => v - 1)}>上一页</button><button className="button small" disabled={page === pages} onClick={() => setPage((v) => v + 1)}>下一页</button></div></div>}
  </>;
}
