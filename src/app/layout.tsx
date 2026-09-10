import type { Metadata } from "next";
import { Navigation } from "@/components/navigation";
import { readEnvironment } from "@/config/env";
import { kiteChains } from "@/config/chains";
import { getCurrentUser } from "@/modules/auth/service";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "KiteAI · 开源 Bounty", template: "%s · KiteAI Bounty" },
  description: "为 KiteAI 构建开源项目，记录每一周的真实贡献。",
};
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const env = readEnvironment(process.env);
  const chain = kiteChains[env.KITE_NETWORK];
  const user = env.DATA_MODE === "database" ? await getCurrentUser() : null;
  return (
    <html lang="zh-CN">
      <body>
        <Navigation
          demo={env.DATA_MODE === "demo"}
          network={env.KITE_NETWORK === "testnet" ? "Kite 测试网" : "Kite 主网"}
          chain={chain}
          user={user}
        />
        <main className="main">{children}</main>
        <footer className="footer">
          <span>
            <strong>KITEAI</strong> · Built by builders, for builders.
          </span>
          <span>开源贡献 · 公开进度 · 北京时间 UTC+8</span>
        </footer>
      </body>
    </html>
  );
}
