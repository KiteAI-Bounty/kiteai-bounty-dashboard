export type SubmissionDraftError = {
  code:
    | "EVIDENCE_REQUIRED"
    | "EVIDENCE_INVALID"
    | "MULTIPLE_REPOSITORIES"
    | "SUMMARY_INVALID";
  message: string;
};

export function validateSubmissionDraft(input: {
  evidenceUrls: string[];
  summary: string;
}): SubmissionDraftError | null {
  if (input.evidenceUrls.length === 0)
    return {
      code: "EVIDENCE_REQUIRED",
      message: "请至少填写一条 GitHub Commit 链接。",
    };
  if (input.evidenceUrls.length > 20)
    return {
      code: "EVIDENCE_INVALID",
      message: "一次最多提交 20 条 Commit 链接。",
    };

  const repositories = new Set<string>();
  for (const value of input.evidenceUrls) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return {
        code: "EVIDENCE_INVALID",
        message: `链接格式不正确：${value}`,
      };
    }
    const match = url.pathname.match(
      /^\/([^/]+)\/([^/]+)\/commit\/([0-9a-f]{7,64})$/i,
    );
    if (url.protocol !== "https:" || url.hostname !== "github.com" || !match)
      return {
        code: "EVIDENCE_INVALID",
        message: `请提交完整的 GitHub Commit 链接，例如 https://github.com/owner/repository/commit/sha。错误链接：${value}`,
      };
    repositories.add(
      `${match[1].toLowerCase()}/${match[2].replace(/\.git$/, "").toLowerCase()}`,
    );
  }
  if (repositories.size !== 1)
    return {
      code: "MULTIPLE_REPOSITORIES",
      message: "一次周度提交中的所有 Commit 必须属于同一个仓库。",
    };

  const summaryLength = input.summary.trim().length;
  if (summaryLength < 20)
    return {
      code: "SUMMARY_INVALID",
      message: `本周完成说明至少需要 20 个字符，目前为 ${summaryLength} 个。`,
    };
  if (summaryLength > 4000)
    return {
      code: "SUMMARY_INVALID",
      message: "本周完成说明不能超过 4000 个字符。",
    };
  return null;
}
