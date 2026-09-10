import { z } from "zod";
import { normalizeWallet } from "./crypto";

export type ParticipantImportRow = {
  displayName: string;
  contact: string;
  githubLogin: string | null;
  wallet: string;
};

const aliases = {
  name: ["name", "displayname", "姓名", "昵称"],
  contact: ["contact", "联系方式", "微信", "email", "邮箱"],
  github: ["github", "githublogin", "github用户名"],
  wallet: ["wallet", "address", "钱包", "钱包地址"],
} as const;

function parseCsv(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(field.trim());
      field = "";
    } else if (character === "\n") {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = "";
    } else if (character !== "\r") field += character;
  }
  if (quoted) throw new Error("CSV_QUOTE_UNCLOSED");
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows.filter((item) => item.some(Boolean));
}

function headerIndex(headers: string[], names: readonly string[]) {
  return headers.findIndex((header) => names.includes(header));
}

const text = z.string().trim().min(1).max(120);
const github = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/);

export function parseParticipantCsv(input: string): ParticipantImportRow[] {
  if (new TextEncoder().encode(input).length > 256_000)
    throw new Error("CSV_TOO_LARGE");
  const rows = parseCsv(input.replace(/^\uFEFF/, ""));
  if (rows.length < 2) throw new Error("CSV_EMPTY");
  const headers = rows[0].map((item) => item.toLowerCase().replaceAll(" ", ""));
  const name = headerIndex(headers, aliases.name);
  const contact = headerIndex(headers, aliases.contact);
  const wallet = headerIndex(headers, aliases.wallet);
  const githubIndex = headerIndex(headers, aliases.github);
  if (name < 0 || contact < 0 || wallet < 0)
    throw new Error("CSV_HEADERS_INVALID");
  const result = rows.slice(1).map((item, index) => {
    try {
      const displayName = text.max(80).parse(item[name]);
      const contactValue = text.parse(item[contact]).toLowerCase();
      const walletValue = normalizeWallet(item[wallet]);
      const githubLogin =
        githubIndex >= 0 && item[githubIndex]
          ? github.parse(item[githubIndex].replace(/^@/, ""))
          : null;
      return {
        displayName,
        contact: contactValue,
        wallet: walletValue,
        githubLogin,
      };
    } catch {
      throw new Error(`CSV_ROW_INVALID:${index + 2}`);
    }
  });
  if (result.length > 200) throw new Error("CSV_TOO_MANY_ROWS");
  const contacts = new Set<string>();
  const wallets = new Set<string>();
  for (const item of result) {
    const contactKey = item.contact.toLowerCase();
    if (contacts.has(contactKey)) throw new Error("CSV_CONTACT_DUPLICATE");
    contacts.add(contactKey);
    if (wallets.has(item.wallet)) throw new Error("CSV_WALLET_DUPLICATE");
    wallets.add(item.wallet);
  }
  return result;
}
