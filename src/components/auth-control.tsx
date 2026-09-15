"use client";

import Link from "next/link";
import { Github, LogOut, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Provider = {
  request(input: {
    method: string;
    params?: unknown[] | object;
  }): Promise<unknown>;
  on?(event: "accountsChanged", listener: (accounts: string[]) => void): void;
  removeListener?(
    event: "accountsChanged",
    listener: (accounts: string[]) => void,
  ): void;
  isMetaMask?: boolean;
  isPhantom?: boolean;
};
export type SessionUser = {
  wallet: string;
  role: "USER" | "ADMIN";
  github: { login: string } | null;
};
type ApiEnvelope<T> = { data?: T; error?: { code: string; message: string } };
type WalletKind = "okx" | "metamask" | "phantom" | "binance";
const WALLET_KIND_KEY = "kiteai.walletProvider";

declare global {
  interface Window {
    okxwallet?: Provider;
    binanceWallet?: Provider;
    ethereum?: Provider;
    phantom?: { ethereum?: Provider };
  }
}

function getInjectedProviders() {
  const ethereum = window.ethereum as (Provider & { providers?: Provider[] }) | undefined;
  return [
    ...(ethereum?.providers ?? []),
    window.okxwallet,
    window.binanceWallet,
    window.phantom?.ethereum,
    ethereum,
  ].filter((provider, index, all): provider is Provider => Boolean(provider) && all.indexOf(provider) === index);
}

function getProvider(kind: WalletKind) {
  const providers = getInjectedProviders();
  if (kind === "okx") return window.okxwallet;
  if (kind === "binance") return window.binanceWallet ?? providers.find((provider) => (provider as Provider & { isBinance?: boolean }).isBinance);
  if (kind === "phantom") return window.phantom?.ethereum ?? providers.find((provider) => provider.isPhantom);
  return providers.find((provider) => provider.isMetaMask && !provider.isPhantom);
}

export function AuthControl({
  demo,
  chain,
  initialUser,
}: {
  demo: boolean;
  initialUser: SessionUser | null;
  chain: {
    id: number;
    name: string;
    rpc: string;
    explorer: string;
    symbol: string;
  };
}) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(initialUser);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);

  useEffect(() => {
    if (demo) return;
    fetch("/api/me", { credentials: "same-origin" })
      .then(async (response) => {
        if (response.ok)
          setUser(
            ((await response.json()) as ApiEnvelope<SessionUser>).data ?? null,
          );
      })
      .catch(() => undefined);
  }, [demo]);

  useEffect(() => {
    if (demo || !user) return;
    const providers = getInjectedProviders();
    if (!providers.length) return;
    let active = true;
    const checkAccount = async (accounts: string[]) => {
      const current = accounts[0]?.toLowerCase();
      if (!active || current === user.wallet.toLowerCase()) return;
      setUser(null);
      setBusy(false);
      setMessage("");
      router.push("/");
      router.refresh();
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      }).catch(() => undefined);
    };
    const listeners: Array<{ provider: Provider; listener: (accounts: string[]) => void }> = [];
    for (const provider of providers) {
      provider
        .request({ method: "eth_accounts" })
        .then((accounts) => {
          const currentAccounts = accounts as string[];
          // Only monitor the extension that owns the logged-in address. Other
          // installed wallets may have a different active account.
          if (currentAccounts.some((account) => account.toLowerCase() === user.wallet.toLowerCase())) {
            const listener = (nextAccounts: string[]) => void checkAccount(nextAccounts);
            listeners.push({ provider, listener });
            provider.on?.("accountsChanged", listener);
          }
        })
        .catch(() => undefined);
    }
    return () => {
      active = false;
      for (const { provider, listener } of listeners) provider.removeListener?.("accountsChanged", listener);
    };
  }, [demo, router, user]);

  async function connect(kind: WalletKind) {
    const provider = getProvider(kind);
    if (!provider) {
      const walletName = kind === "okx" ? "OKX Wallet" : kind === "phantom" ? "Phantom" : kind === "binance" ? "Binance Wallet" : "MetaMask";
      setMessage(`未检测到 ${walletName}，请先安装或打开钱包扩展。`);
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      // MetaMask may silently return the account previously authorized for this
      // site. Requesting the account permission first opens its account picker,
      // so switching accounts in the extension is reflected in this login.
      if (kind === "metamask") {
        await provider.request({
          method: "wallet_requestPermissions",
          params: [{ eth_accounts: {} }],
        }).catch((error) => {
          const code = typeof error === "object" && error && "code" in error
            ? Number(error.code)
            : 0;
          // Older providers do not implement EIP-2253; regular account
          // request below remains the fallback for those wallets.
          if (code !== -32601 && code !== -32602) throw error;
        });
      }
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as string[];
      const address = accounts[0];
      if (!address) throw new Error("钱包没有返回可用地址。");
      const chainHex = `0x${chain.id.toString(16)}`;
      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: chainHex }],
        });
      } catch (error) {
        const code =
          typeof error === "object" && error && "code" in error
            ? Number(error.code)
            : 0;
        if (code !== 4902) throw error;
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: chainHex,
              chainName: chain.name,
              nativeCurrency: {
                name: chain.symbol,
                symbol: chain.symbol,
                decimals: 18,
              },
              rpcUrls: [chain.rpc],
              blockExplorerUrls: [chain.explorer],
            },
          ],
        });
      }
      const actualChain = Number.parseInt(
        (await provider.request({ method: "eth_chainId" })) as string,
        16,
      );
      const nonceResponse = await fetch("/api/auth/wallet/nonce", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, chainId: actualChain }),
      });
      const nonce = (await nonceResponse.json()) as ApiEnvelope<{
        challengeId: string;
        message: string;
      }>;
      if (!nonceResponse.ok || !nonce.data)
        throw new Error(nonce.error?.message ?? "无法创建签名请求。");
      const signature = (await provider.request({
        method: "personal_sign",
        params: [nonce.data.message, address],
      })) as string;
      const verifyResponse = await fetch("/api/auth/wallet/verify", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: nonce.data.challengeId,
          address,
          signature,
        }),
      });
      const verified =
        (await verifyResponse.json()) as ApiEnvelope<SessionUser>;
      if (!verifyResponse.ok || !verified.data)
        throw new Error(verified.error?.message ?? "钱包登录失败。");
      // Keep the selected provider across refreshes. This is only a UI hint;
      // the server remains the source of truth for the authenticated wallet.
      window.localStorage.setItem(WALLET_KIND_KEY, kind);
      setUser(verified.data);
      router.push(verified.data.role === "ADMIN" ? "/admin" : "/dashboard");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "钱包请求未完成。");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("退出失败，请重试。");
      // Some EIP-2255 wallets support revoking this site's account permission.
      // Unsupported wallets reject the request; in that case the server session
      // is still cleared and the site will not treat the extension as logged in.
      const kind = window.localStorage.getItem(WALLET_KIND_KEY) as WalletKind | null;
      if (kind) {
        const provider = getProvider(kind);
        await provider?.request({
          method: "wallet_revokePermissions",
          params: [{ eth_accounts: {} }],
        }).catch(() => undefined);
        window.localStorage.removeItem(WALLET_KIND_KEY);
      }
      setUser(null);
      router.push("/");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "退出失败。");
    } finally {
      setBusy(false);
    }
  }

  if (demo)
    return (
      <button
        className="button dark compact"
        disabled
        title="将 DATA_MODE 改为 database 后可测试真实钱包登录"
      >
        <Wallet size={15} />
        连接钱包 · 演示模式
      </button>
    );
  return (
    <div className="auth-control">
      {!user && (
        <div className="wallet-connect-picker">
          <button className="button dark compact" onClick={() => setWalletMenuOpen((open) => !open)} disabled={busy}>
            <Wallet size={15} />{busy ? "等待钱包…" : "连接钱包"}
          </button>
          {walletMenuOpen && <div className="wallet-connect-menu" role="menu">
            <button className="wallet-connect-choice" onClick={() => { setWalletMenuOpen(false); void connect("okx"); }} role="menuitem" disabled={busy}>
              <Wallet size={15} /><span><strong>OKX Wallet</strong><small>使用 OKX 钱包连接</small></span>
            </button>
            <button className="wallet-connect-choice" onClick={() => { setWalletMenuOpen(false); void connect("metamask"); }} role="menuitem" disabled={busy}>
              <Wallet size={15} /><span><strong>MetaMask</strong><small>使用 MetaMask 连接</small></span>
            </button>
            <button className="wallet-connect-choice" onClick={() => { setWalletMenuOpen(false); void connect("phantom"); }} role="menuitem" disabled={busy}>
              <Wallet size={15} /><span><strong>Phantom</strong><small>使用 Phantom 连接</small></span>
            </button>
            <button className="wallet-connect-choice" onClick={() => { setWalletMenuOpen(false); void connect("binance"); }} role="menuitem" disabled={busy}>
              <Wallet size={15} /><span><strong>Binance Wallet</strong><small>使用币安钱包连接</small></span>
            </button>
          </div>}
        </div>
      )}
      {user?.role === "ADMIN" && (
        <>
          <Link className="account-link" href="/admin">
            Admin · {user.wallet.slice(0, 6)}…{user.wallet.slice(-4)}
          </Link>
          <button
            className="icon-button logout"
            aria-label="退出登录"
            title="退出登录"
            onClick={logout}
            disabled={busy}
          >
            <LogOut size={15} />
          </button>
        </>
      )}
      {user?.role === "USER" && !user.github && (
        <>
          <a
            className="button dark compact"
            href="/api/auth/github?returnTo=/dashboard"
          >
            <Github size={15} />
            绑定 GitHub
          </a>
          <button
            className="icon-button logout"
            aria-label="退出登录"
            title="退出登录"
            onClick={logout}
            disabled={busy}
          >
            <LogOut size={15} />
          </button>
        </>
      )}
      {user?.role === "USER" && user.github && (
        <>
          <Link className="account-link" href="/dashboard">
            @{user.github.login}
          </Link>
          <button
            className="icon-button logout"
            aria-label="退出登录"
            title="退出登录"
            onClick={logout}
            disabled={busy}
          >
            <LogOut size={15} />
          </button>
        </>
      )}
      {message && (
        <span className="auth-message" role="alert">
          {message}
        </span>
      )}
    </div>
  );
}
