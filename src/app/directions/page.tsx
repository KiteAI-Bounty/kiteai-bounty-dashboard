import Link from "next/link";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { PageTitle } from "@/components/ui";
import { contributionDirections } from "@/modules/directions/catalog";

export default function DirectionsPage() {
  return (
    <>
      <PageTitle
        eyebrow="CONTRIBUTION DIRECTIONS"
        title="贡献方向"
        description="选择一个方向完成真实开源贡献。提交时请选择对应方向，并按验收标准准备证据。"
        action={<Link className="button dark" href="/submissions/current">提交贡献 <ArrowUpRight size={15} /></Link>}
      />
      <section className="directions-list">
        {contributionDirections.map((direction, index) => (
          <details className="direction-card" key={direction.value} open={index === 0}>
            <summary>
              <span className="direction-number">0{index + 1}</span>
              <span className="direction-title">{direction.label}</span>
              {index === 5 && <span className="direction-note">待 A2A 上线</span>}
              <ChevronDown size={18} className="direction-chevron" />
            </summary>
            <div className="direction-content">
              <div className="direction-block"><h3>方向简介</h3><p>{direction.description}</p></div>
              <div className="direction-block"><h3>官方仓库</h3><div className="direction-links">{direction.repos.map((repo) => <a key={repo.url} href={repo.url} target="_blank" rel="noreferrer">{repo.label}<ArrowUpRight size={13} /></a>)}</div></div>
              <div className="direction-block"><h3>建议技术栈</h3><p>{direction.stack}</p></div>
              <div className="direction-block"><h3>验收标准</h3><ul>{direction.acceptance.map((item) => <li key={item}>{item}</li>)}</ul></div>
              <div className="direction-block"><h3>提交时需要提供的证据</h3><p>{direction.evidence}</p></div>
              <div className="direction-block direction-risk"><h3>风险与注意事项</h3><p>{direction.risks}</p></div>
            </div>
          </details>
        ))}
      </section>
    </>
  );
}
