import Link from "next/link";
export default function NotFound() {
  return (
    <section className="panel empty-state">
      <p className="eyebrow">404 / NOT FOUND</p>
      <h1>这个页面还不存在</h1>
      <p>回到活动总览，继续探索开发者计划。</p>
      <Link className="button dark" href="/">
        返回首页
      </Link>
    </section>
  );
}
