"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { AuthControl } from "./auth-control";
import type { SessionUser } from "./auth-control";

const links = [
  { href: "/", label: "活动总览" },
  { href: "/dashboard", label: "我的看板" },
  { href: "/submissions/current", label: "项目与贡献" },
  { href: "/directions", label: "贡献方向" },
  { href: "/rewards", label: "奖励进度" },
  { href: "/admin", label: "管理后台" },
];

export function Navigation({
  demo,
  network,
  chain,
  user,
}: {
  demo: boolean;
  network: string;
  user: SessionUser | null;
  chain: {
    id: number;
    name: string;
    rpc: string;
    explorer: string;
    symbol: string;
  };
}) {
  const pathname = usePathname();
  const visibleLinks = demo
    ? links
    : user?.role === "ADMIN"
      ? links.filter((link) => link.href === "/" || link.href === "/admin")
      : user?.role === "USER"
        ? links.filter((link) => link.href !== "/admin")
        : links.filter((link) => link.href === "/");
  return (
    <>
      {demo && (
        <div className="dev-banner">
          <span className="live-dot" /> 开发预览 · 虚构数据 · 演示时间
          2026/09/30 · 所有业务操作暂未开放
        </div>
      )}
      <header className="header">
        <div className="header-inner">
          <Link href="/" className="brand" aria-label="KiteAI Bounty 首页">
            <Image
              src="/brand/Kite_Logo_Dark.svg"
              alt="Kite AI"
              width={114}
              height={46}
              priority
            />
            <span>BUILDERS PROGRAM</span>
          </Link>
          <nav aria-label="主导航">
            {visibleLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={
                  link.href === "/"
                    ? pathname === "/"
                      ? "active"
                      : ""
                    : pathname.startsWith(link.href.split("/current")[0])
                      ? "active"
                      : ""
                }
                aria-current={pathname === link.href ? "page" : undefined}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <span className="network">
              <span className="live-dot" />
              {network}
            </span>
            <AuthControl demo={demo} chain={chain} initialUser={user} />
          </div>
        </div>
      </header>
      <div className="program-strip">
        <span>OPEN SOURCE. REAL CONTRIBUTIONS.</span>
        <a href="https://docs.gokite.ai/" target="_blank" rel="noreferrer">
          Kite 开发者文档 <ArrowUpRight size={13} />
        </a>
      </div>
    </>
  );
}
