import { ArrowUpRight, BadgeCheck } from "lucide-react";
import {
  ecActivitySnapshot,
  ecSnapshotCommitCount,
} from "@/modules/ec/activity-snapshot";

type LocalAccount = {
  githubLogin: string;
  wallet: string;
};

export function EcActiveDevelopers({ accounts }: { accounts: LocalAccount[] }) {
  const wallets = new Map(
    accounts.map((account) => [
      account.githubLogin.toLowerCase(),
      account.wallet,
    ]),
  );

  return (
    <section className="panel ec-active-developers">
      <div className="panel-title">
        <div>
          <h2>
            EC 活跃开发者
            <span className="count">
              {ecActivitySnapshot.developers.length}
            </span>
          </h2>
          <p>
            EC 公开数据包 {ecActivitySnapshot.snapshotVersion}，活动统计截至{" "}
            {ecActivitySnapshot.activityThrough}；28 天窗口内确认{" "}
            {ecSnapshotCommitCount()} 个有效
            Commit。数据包生成后可能仍有同步延迟。
          </p>
        </div>
        <a
          className="button small"
          href={ecActivitySnapshot.sourceUrl}
          target="_blank"
          rel="noreferrer"
        >
          查看数据源 <ArrowUpRight size={14} />
        </a>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>开发者</th>
              <th>EC 归属仓库</th>
              <th>有效 Commit</th>
              <th>本地账户</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {ecActivitySnapshot.developers.map((developer) => {
              const wallet = wallets.get(developer.githubLogin.toLowerCase());
              return (
                <tr key={developer.githubLogin}>
                  <td>
                    <a
                      href={`https://github.com/${developer.githubLogin}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <strong>@{developer.githubLogin}</strong>
                    </a>
                  </td>
                  <td>
                    <a
                      href={`https://github.com/${developer.repository}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {developer.repository}
                    </a>
                  </td>
                  <td>
                    <strong>{developer.commits}</strong>
                  </td>
                  <td className="mono">
                    {wallet
                      ? `${wallet.slice(0, 7)}…${wallet.slice(-4)}`
                      : "未匹配"}
                  </td>
                  <td>
                    <span className="badge green">
                      <BadgeCheck size={12} /> EC 已确认
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="table-footer">
        <span>KiteAI 生态 ID：{ecActivitySnapshot.ecosystemId}</span>
        <span>
          一次性 {ecActivitySnapshot.oneTimeDevelopers} · 兼职{" "}
          {ecActivitySnapshot.partTimeDevelopers} · 全职{" "}
          {ecActivitySnapshot.fullTimeDevelopers}
        </span>
      </div>
    </section>
  );
}
