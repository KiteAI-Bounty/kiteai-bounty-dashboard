"use client";
import { useEffect, useState } from "react";
import { Copy, Check, Shield } from "lucide-react";
import { getAddress } from "viem";

type AdminWallet = {
  id: string;
  wallet: string;
  active: boolean;
  isRoot?: boolean;
  createdAt: string;
};

function formatAddress(address: string): string {
  try {
    const checksum = getAddress(address);
    return `${checksum.slice(0, 6)}…${checksum.slice(-4)}`;
  } catch {
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
  }
}

function toChecksum(address: string): string {
  try {
    return getAddress(address);
  } catch {
    return address;
  }
}

export function AdminWallets() {
  const [wallet, setWallet] = useState("");
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [wallets, setWallets] = useState<AdminWallet[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  async function loadWallets() {
    const response = await fetch("/api/admin/wallets", { cache: "no-store" });
    if (response.ok) {
      const data = await response.json();
      setWallets(data.data ?? []);
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void loadWallets();
    });
  }, []);

  async function add() {
    setMessage("");
    const response = await fetch("/api/admin/wallets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet }),
    });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error?.message ?? "添加失败");
    setWallet("");
    setOpen(false);
    setMessage("管理员钱包已添加");
    await loadWallets();
  }

  async function handleCopy(address: string) {
    try {
      const full = toChecksum(address);
      await navigator.clipboard.writeText(full);
      setCopied(address);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setMessage("复制失败，请手动选中文本复制。");
    }
  }

  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <h2>管理员钱包</h2>
          <p>管理可登录后台的钱包地址，支持查看与复制完整地址。</p>
        </div>
        <button
          className="button small"
          onClick={() => {
            setMessage("");
            setOpen(true);
          }}
        >
          添加管理员
        </button>
      </div>
      {message && <p className="form-message">{message}</p>}
      <div className="admin-wallet-list">
        {wallets.length ? (
          wallets.map((item) => (
            <div className="admin-wallet-row" key={item.id}>
              <div className="wallet-cell">
                <span className="avatar avatar-0">{item.wallet.slice(-2)}</span>
                <span className="mono" title={toChecksum(item.wallet)}>
                  {formatAddress(item.wallet)}
                </span>
                <button
                  className="icon-button"
                  aria-label={`复制管理员钱包 ${item.wallet}`}
                  title={`点击复制完整地址: ${toChecksum(item.wallet)}`}
                  onClick={() => handleCopy(item.wallet)}
                >
                  {copied === item.wallet ? (
                    <Check size={13} />
                  ) : (
                    <Copy size={13} />
                  )}
                </button>
              </div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                {item.isRoot && (
                  <span
                    className="badge blue"
                    title="通过系统环境变量配置的根管理员"
                  >
                    <Shield size={11} style={{ marginRight: 3, verticalAlign: "middle" }} />
                    根管理员
                  </span>
                )}
                <span className={`badge ${item.active ? "green" : "muted"}`}>
                  <span className="badge-dot" />
                  {item.active ? "可登录" : "已停用"}
                </span>
              </div>
            </div>
          ))
        ) : (
          <p className="muted-text">暂无管理员钱包</p>
        )}
      </div>
      {open && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-wallet-title"
          >
            <h3 id="admin-wallet-title">添加管理员钱包</h3>
            <p>输入 0x 开头的 42 位钱包地址，添加后即可使用该钱包登录管理后台。</p>
            <input
              aria-label="管理员钱包地址"
              autoFocus
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              placeholder="0x..."
            />
            <div className="modal-actions">
              <button className="button ghost" onClick={() => setOpen(false)}>
                取消
              </button>
              <button className="button" onClick={add} disabled={!wallet.trim()}>
                确认添加
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
