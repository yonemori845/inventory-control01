/**
 * Supabase（PostgreSQL）に supabase/migrations 配下の SQL をファイル名順で実行する。
 *
 * DATABASE_URL の解決順:
 * 1. 既に設定されている環境変数
 * 2. プロジェクト直下の `.env.local`（なければ `.env`）をこのスクリプトが読み込む
 *
 * 前提:
 * - `.env.local` に `DATABASE_URL=postgresql://...` を 1 行で書く（`=` の前後に空白を入れない）。
 * - 既にスキーマがある DB へ流すとエラーになることがある（二重作成）。未適用のプロジェクト向け。
 *
 * 実行:
 *   npm run db:apply-migrations
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const migrationsDir = path.join(root, "supabase", "migrations");

/**
 * 1 行を KEY=VALUE に分解（半角/全角 =、KEY 前後の空白に対応）。
 */
function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  let rest = trimmed;
  if (rest.startsWith("export ")) rest = rest.slice(7).trim();
  const eqAscii = rest.indexOf("=");
  const eqWide = rest.indexOf("＝");
  let eq = -1;
  if (eqAscii >= 0 && eqWide >= 0) eq = Math.min(eqAscii, eqWide);
  else eq = eqAscii >= 0 ? eqAscii : eqWide;
  if (eq <= 0) return null;
  const key = rest.slice(0, eq).trim();
  let val = rest.slice(eq + 1).trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  return { key, val };
}

/**
 * 未設定のキーだけ `.env*` から補完する（BOM・クォート・全角 = に対応）。
 */
async function loadEnvFromFiles() {
  for (const name of [".env.local", ".env"]) {
    const fp = path.join(root, name);
    let text;
    try {
      text = await readFile(fp, "utf8");
    } catch (e) {
      if (e.code === "ENOENT") continue;
      throw e;
    }
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    for (let line of text.split(/\r?\n/)) {
      const parsed = parseEnvLine(line);
      if (!parsed) continue;
      if (process.env[parsed.key] === undefined) process.env[parsed.key] = parsed.val;
    }
  }
}

/** 失敗時: ファイルの有無と DATABASE_URL 行の有無だけ表示（値は出さない） */
async function printDiagnostics() {
  console.error("\n--- 診断（接続文字列の中身は表示しません）---");
  console.error(`参照しているプロジェクトルート: ${root}`);
  if (process.cwd() !== root) {
    console.error(
      `注意: カレントディレクトリがルートと異なります (${process.cwd()})。\n` +
        "  npm run は通常ルートで実行してください。",
    );
  }

  for (const name of [".env.local", ".env"]) {
    const fp = path.join(root, name);
    let text;
    try {
      text = await readFile(fp, "utf8");
    } catch (e) {
      if (e.code === "ENOENT") {
        console.error(`· ${name}: ファイルなし (${fp})`);
        continue;
      }
      throw e;
    }
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

    const hasDatabaseUrl = /^\s*DATABASE_URL\s*[=＝]/m.test(text);
    const hasWideEq =
      /DATABASE_URL\s*＝/.test(text) ||
      text.split(/\r?\n/).some((ln) => /^\s*DATABASE_URL\s*＝/.test(ln));
    let emptyValue = false;
    for (const line of text.split(/\r?\n/)) {
      const p = parseEnvLine(line);
      if (p && p.key === "DATABASE_URL" && !String(p.val).trim()) emptyValue = true;
    }

    const keyNames = [];
    for (const line of text.split(/\r?\n/)) {
      const p = parseEnvLine(line);
      if (p && /^[A-Za-z_][A-Za-z0-9_]*$/.test(p.key)) keyNames.push(p.key);
    }

    console.error(`· ${name}: あり (${fp})`);
    console.error(`    DATABASE_URL らしき行: ${hasDatabaseUrl ? "見つかった" : "見つからない"}`);
    if (hasDatabaseUrl && emptyValue) {
      console.error("    → DATABASE_URL= の右側が空です。URI を貼り付けてください。");
    }
    if (hasWideEq) {
      console.error("    → 全角の「＝」を使っている行があります。半角 = に直してください。");
    }
    const similar = keyNames.filter(
      (k) =>
        k !== "DATABASE_URL" &&
        k !== "NEXT_PUBLIC_SUPABASE_URL" &&
        (k.includes("DATABSE") ||
          k.includes("POSTGRES_URL") ||
          /^DATABASE_/i.test(k)),
    );
    if (similar.length) {
      console.error(`    タイポの可能性がある変数名: ${similar.join(", ")}`);
    }
    if (keyNames.includes("NEXT_PUBLIC_SUPABASE_URL") && !keyNames.includes("DATABASE_URL")) {
      console.error(
        "    ※ NEXT_PUBLIC_SUPABASE_URL は API 用です。マイグレーションには DATABASE_URL（Postgres 接続 URI）が別途必要です。",
      );
    }
    if (keyNames.length && !keyNames.includes("DATABASE_URL")) {
      console.error(
        `    認識した変数名の例（先頭のみ）: ${keyNames.slice(0, 8).join(", ")}${keyNames.length > 8 ? ", ..." : ""}`,
      );
    }
  }
}

await loadEnvFromFiles();

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("[apply-supabase-migrations] DATABASE_URL が見つかりません。");
  await printDiagnostics();
  console.error(
    "\n次の 1 行を .env.local の末尾に追加してください（例。パスワードとホストは自分の値に）:\n" +
      "  DATABASE_URL=postgresql://postgres:パスワード@db.xxxxx.supabase.co:5432/postgres\n" +
      "保存後、もう一度 npm run db:apply-migrations を実行してください。",
  );
  process.exit(1);
}

const files = (await readdir(migrationsDir))
  .filter((f) => f.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  console.error("[apply-supabase-migrations] migrations が見つかりません:", migrationsDir);
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });

await client.connect();
console.log("[apply-supabase-migrations] 接続しました。以下を順に実行します:\n", files.join("\n "), "\n");

try {
  for (const name of files) {
    const full = path.join(migrationsDir, name);
    const sql = await readFile(full, "utf8");
    console.log("→", name, `(${sql.length} chars)`);
    await client.query(sql);
  }
  console.log("\n[apply-supabase-migrations] 完了しました。");
} catch (e) {
  console.error("\n[apply-supabase-migrations] エラー:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
