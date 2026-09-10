import { LockKeyhole, CircleCheck } from "lucide-react";
import { PageTitle } from "@/components/ui";
import { rewardPolicyDraft } from "@/modules/rewards/policy";
import { readEnvironment } from "@/config/env";
import { getCurrentUser } from "@/modules/auth/service";
import { redirect } from "next/navigation";

export default async function Rewards() {
  if (readEnvironment(process.env).DATA_MODE === "database") {
    const user = await getCurrentUser();
    if (user?.role === "ADMIN") redirect("/admin");
  }
  return (
    <>
      <PageTitle
        eyebrow="REWARDS & MILESTONES"
        title="持续贡献，逐步解锁。"
        description="首期奖励规则预览。实际资格将在审核与 EC 登记模块接入后计算。"
      />
      <section className="reward-hero">
        <div>
          <p className="eyebrow">FOUR WEEKS OF BUILDING</p>
          <h2>每一周，离目标更近一步。</h2>
          <p>完成至第三周解锁 25 USDC，第四周累计 40 USDC。</p>
        </div>
        <div className="reward-amount">
          40<span>USDC / 人</span>
        </div>
      </section>
      <div className="reward-grid">
        {[1, 2, 3, 4].map((n) => (
          <section className="panel reward-card" key={n}>
            <span className="eyebrow">WEEK 0{n}</span>
            <h2>
              {n < 3
                ? "持续积累"
                : `${rewardPolicyDraft.milestones[n - 3].cumulativeUsdc} USDC`}
            </h2>
            <p>
              {n < 3
                ? "前两周积累有效贡献，不单独发放奖励。"
                : n === 3
                  ? "完成至第三周，解锁第一阶段奖励。"
                  : "完成至第四周，累计解锁完整奖励。"}
            </p>
            <span className={`badge ${n < 3 ? "muted" : "green"}`}>
              <CircleCheck size={12} />
              {n < 3 ? "贡献里程碑" : "累计奖励规则"}
            </span>
          </section>
        ))}
      </div>
      <section className="panel claim-panel">
        <div>
          <h2>
            <LockKeyhole size={21} />
            领取功能即将开放
          </h2>
          <p>
            首期从 10 月 12 日起审核发放；须满足 EC
            登记、管理员发放审核和支付功能开放条件。
          </p>
          <small>
            四周结算、连续周计算细则仍为待确认方案；本页不代表已产生可领取金额。
          </small>
        </div>
        <button className="button dark" disabled>
          暂未开放领取
        </button>
      </section>
    </>
  );
}
