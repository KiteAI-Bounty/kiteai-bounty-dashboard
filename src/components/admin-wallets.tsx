"use client";
import { useState } from "react";

export function AdminWallets() {
  const [wallet, setWallet] = useState("");
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  async function add() {
    setMessage("");
    const response = await fetch("/api/admin/wallets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wallet }) });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error?.message ?? "添加失败");
    setWallet(""); setOpen(false); setMessage("管理员钱包已添加");
  }
  return <section className="panel">
    <div className="panel-title"><div><h2>管理员钱包</h2><p>管理可登录后台的钱包地址。</p></div><button className="button small" onClick={() => { setMessage(""); setOpen(true); }}>添加管理员</button></div>
    {message && <p className="form-message">{message}</p>}
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
