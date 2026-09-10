"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="panel empty-state">
      <h1>暂时无法读取活动数据</h1>
      <p>请检查数据库连接和初始化状态，或稍后重试。</p>
      <button className="button dark" onClick={reset}>
        重新加载
      </button>
    </section>
  );
}
