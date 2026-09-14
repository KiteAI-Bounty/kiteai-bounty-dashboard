"use client";
import { useEffect, useState } from "react";

type AdminWallet = { id: string; wallet: string; active: boolean; createdAt: string };

export function AdminWallets() {
  const [wallet, setWallet] = useState("");
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [wallets, setWallets] = useState<AdminWallet[]>([]);
  async function loadWallets() {
    const response = await fetch("/api/admin/wallets", { cache: "no-store" });
    if (response.ok) {
      const data = await response.json();
      setWallets(data.data ?? []);
    }
  }
  useEffect(() => { queueMicrotask(() => { void loadWallets(); }); }, []);
  async function add() {
    setMessage("");
    const response = await fetch("/api/admin/wallets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wallet }) });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error?.message ?? "添加失败");
    setWallet(""); setOpen(false); setMessage("管理员钱包已添加");
    await loadWallets();
  }
  return <section className="panel">
    <div className="panel-title"><div><h2>管理员钱包</h2><p>管理可登录后台的钱包地址。</p></div><button className="button small" onClick={() => { setMessage(""); setOpen(true); }}>添加管理员</button></div>
    {message && <p className="form-message">{message}</p>}
    <div className="admin-wallet-list">
      {wallets.length ? wallets.map((item) => <div className="admin-wallet-row" key={item.id}><span className="mono">{item.wallet.slice(0, 10)}…{item.wallet.slice(-6)}</span><span className={`badge ${item.active ? "green" : "muted"}`}>{item.active ? "可登录" : "已停用"}</span></div>) : <p className="muted-text">暂无其他管理员钱包</p>}
    </div>
    {open && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="admin-wallet-title">
        <h3 id="admin-wallet-title">添加管理员钱包</h3>
        <p>输入 0x 开头的钱包地址，添加后即可使用该钱包登录管理后台。</p>
        <input aria-label="管理员钱包地址" autoFocus value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="0x..." />
        <div className="modal-actions"><button className="button ghost" onClick={() => setOpen(false)}>取消</button><button className="button" onClick={add} disabled={!wallet.trim()}>确认添加</button></div>
      </div>
    </div>}
  </section>;
}
