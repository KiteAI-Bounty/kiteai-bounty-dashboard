import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpRight,
  Code2,
  GitPullRequest,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { ProgressTable } from "@/components/progress-table";
import { ProcessGuide, Stat } from "@/components/ui";
import { getCampaignWorkspace } from "@/modules/campaigns/service";
import { getCurrentUser } from "@/modules/auth/service";

export default async function Home() {
  const { campaign, rows, demo } = await getCampaignWorkspace();
  const user = demo ? null : await getCurrentUser();
  const completed = rows.filter((r) =>
    r.weeks.some((w) => w.status === "completed"),
  ).length;
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="pill">
            <span className="live-dot" /> KITEAI OPEN SOURCE BOUNTY · 2026
          </div>
          <h1>
            让每一周的构建，
            <br />
            成为生态的<span>下一步。</span>
          </h1>
          <p>
            围绕 KiteAI 创造开源项目，提交真实代码贡献。
            <br />
            从第一次提交，到持续构建，在这里记录你的进步。
          </p>
          <div className="hero-actions">
            <Link
              href={user?.role === "ADMIN" ? "/admin" : "/dashboard"}
              className="button dark"
            >
              {user?.role === "ADMIN" ? "管理参与白名单" : "查看我的看板"}{" "}
              <ArrowUpRight size={17} />
            </Link>
            <a className="text-link" href="#how-it-works">
              了解参与方式 <ArrowRight size={15} />
            </a>
          </div>
          <div className="hero-meta">
            <span>01 / 首期构建计划</span>
            <span>09.09 — 10.06</span>
            <span>每 7 天一个统计周</span>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="grid-plane" />
          <div className="visual-card card-top">
            <Code2 size={19} />
            <div>
              Build something real<small>原创代码 · 持续贡献</small>
            </div>
            <span className="live-dot" />
          </div>
          <div className="kite-symbol">
            <Image
              src="/brand/Kite_Logo_Dark.svg"
              alt="Kite AI"
              width={114}
              height={46}
            />
          </div>
          <div className="visual-card card-bottom">
            <GitPullRequest size={18} />
            <div>
              Your contribution matters<small>代码连接开发者与生态</small>
            </div>
          </div>
          <span className="visual-label">BUILD / COMMIT / GROW</span>
        </div>
      </section>
      <div className="section-kicker">
        <span>PROGRAM AT A GLANCE</span>
        <span>{demo ? "只读演示数据" : "当前活动数据"}</span>
      </div>
      <section className="stats-grid">
        <Stat
          label="本期参与开发者"
          value={String(rows.length).padStart(2, "0")}
          note={demo ? "虚构钱包，仅用于预览" : "已登记活动的唯一钱包"}
        />
        <Stat
          label="本期有完成周的开发者"
          value={String(completed).padStart(2, "0")}
          note="至少一周已审核且登记条件满足"
        />
        <Stat
          label="四周累计奖励"
          value={
            <>
              40<span className="stat-unit"> USDC</span>
            </>
          }
          note="达标解锁 · 第五周起审核 · 领取未开放"
        />
      </section>
      <ProgressTable rows={rows} weeks={campaign.weeks} />
      <section className="bottom-grid" id="how-it-works">
        <div className="panel how-panel">
          <div className="panel-title">
            <div>
              <p className="eyebrow">YOUR BUILDING JOURNEY</p>
              <h2>从第一行代码开始</h2>
            </div>
            <Sparkles size={20} />
          </div>
          <div className="steps">
            {[
              ["01", "连接与绑定", "OKX 钱包登录，绑定唯一 GitHub 身份。"],
              [
                "02",
                "每周提交贡献",
                "确认本周仓库和原创代码，等待管理员审核。",
              ],
              ["03", "登记与解锁", "新仓库申请 EC 登记，按周累计奖励进度。"],
            ].map(([n, title, description]) => (
              <div className="step" key={n}>
                <span>{n}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </div>
            ))}
          </div>
          <ProcessGuide audience="participant" />
        </div>
        <div className="panel ecosystem-panel">
          <p className="eyebrow">ECOSYSTEM VISIBILITY</p>
          <h2>让真实贡献被看见</h2>
          <p>
            内部审核、EC
            仓库登记与外部榜单分别跟踪。登记完成后，等待平台采集和更新。
          </p>
          <a
            href="https://www.developerreport.com/"
            target="_blank"
            rel="noreferrer"
          >
            Electric Capital Developer Report <ArrowUpRight size={16} />
          </a>
          <small>数据来源以外部平台公开结果为准</small>
        </div>
      </section>
    </>
  );
}
