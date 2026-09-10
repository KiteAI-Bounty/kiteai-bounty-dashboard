"use client";

import { FileUp, Users } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

type ImportResult = {
  displayName: string;
  contact: string;
  wallet: string;
  result: "created" | "updated";
};

export function ParticipantImport() {
  const router = useRouter();
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<ImportResult[]>([]);

  async function importCsv() {
    setBusy(true);
    setError("");
    setResults([]);
    try {
      const response = await fetch("/api/admin/participants", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const body = (await response.json()) as {
        data?: ImportResult[];
        error?: { message: string };
      };
      if (!response.ok || !body.data)
        throw new Error(body.error?.message ?? "导入失败。");
      setResults(body.data);
      setCsv("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "导入失败。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel participant-import">
      <div className="panel-title">
        <div>
          <h2>参与者白名单</h2>
          <p>上传 CSV；每位参与者必须填写唯一的钱包地址。</p>
        </div>
        <Users size={22} />
      </div>
      <div className="import-toolbar">
        <div className="import-actions">
        <label className="button small file-button">
          <FileUp size={15} />
          选择 CSV
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) setCsv(await file.text());
            }}
          />
        </label>
        <a className="text-link" href="/participants-template.csv" download>
          下载模板
        </a>
        </div>
        <span className="import-hint">支持直接粘贴 CSV 内容，列顺序为 name、contact、github、wallet。</span>
      </div>
      <label className="import-label" htmlFor="participant-csv">CSV 内容</label>
      <textarea
        id="participant-csv"
        value={csv}
        onChange={(event) => setCsv(event.target.value)}
        placeholder={
          "name,contact,github,wallet\n张三,wechat-id,octocat,0x钱包地址"
        }
        rows={6}
      />
      <button
        className="button dark"
        onClick={importCsv}
        disabled={busy || !csv.trim()}
      >
        {busy ? "正在导入…" : "导入白名单"}
      </button>
      {error && <p className="form-error">{error}</p>}
      {results.length > 0 && (
        <div className="import-results">
          <p>已处理 {results.length} 人，名单钱包现在可以签名登录。</p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>参与者</th>
                  <th>联系方式</th>
                  <th>钱包</th>
                </tr>
              </thead>
              <tbody>
                {results.map((item) => (
                  <tr key={item.contact}>
                    <td>{item.displayName}</td>
                    <td>{item.contact}</td>
                    <td className="mono">{item.wallet}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
