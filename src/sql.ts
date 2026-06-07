// Split a SQL script into individual statements on top-level semicolons,
// correctly skipping semicolons inside string/identifier literals and comments.
// Line comments (-- … and # …), block comments (/* … */), '…', "…" and `…`
// are all respected. Comment-only / empty statements are dropped.
export function splitSql(text: string): string[] {
  const out: string[] = [];
  let cur = "";
  let i = 0;
  const n = text.length;
  let inSingle = false, inDouble = false, inBacktick = false;
  let lineComment = false, blockComment = false;

  while (i < n) {
    const c = text[i];
    const next = i + 1 < n ? text[i + 1] : "";

    if (lineComment) {
      cur += c;
      if (c === "\n") lineComment = false;
      i++;
      continue;
    }
    if (blockComment) {
      cur += c;
      if (c === "*" && next === "/") { cur += next; i += 2; blockComment = false; continue; }
      i++;
      continue;
    }
    if (inSingle) {
      cur += c;
      if (c === "'") { if (next === "'") { cur += next; i += 2; continue; } inSingle = false; }
      i++;
      continue;
    }
    if (inDouble) {
      cur += c;
      if (c === '"') { if (next === '"') { cur += next; i += 2; continue; } inDouble = false; }
      i++;
      continue;
    }
    if (inBacktick) {
      cur += c;
      if (c === "`") inBacktick = false;
      i++;
      continue;
    }

    // not inside anything special
    if (c === "-" && next === "-") { lineComment = true; cur += c + next; i += 2; continue; }
    if (c === "#") { lineComment = true; cur += c; i++; continue; }
    if (c === "/" && next === "*") { blockComment = true; cur += c + next; i += 2; continue; }
    if (c === "'") { inSingle = true; cur += c; i++; continue; }
    if (c === '"') { inDouble = true; cur += c; i++; continue; }
    if (c === "`") { inBacktick = true; cur += c; i++; continue; }
    if (c === ";") { out.push(cur); cur = ""; i++; continue; }

    cur += c;
    i++;
  }
  if (cur.trim()) out.push(cur);

  // Strip each statement's *leading* comments/whitespace so it begins with a
  // real keyword (otherwise a preceding `-- …` line would make the backend
  // misclassify the statement and skip pagination).
  return out.map((s) => stripLeadingComments(s)).filter((s) => s.length > 0 && !isCommentOnly(s));
}

function stripLeadingComments(input: string): string {
  let s = input.trim();
  for (;;) {
    const before = s;
    s = s.replace(/^--[^\n]*\n?/, "");
    s = s.replace(/^#[^\n]*\n?/, "");
    s = s.replace(/^\/\*[\s\S]*?\*\//, "");
    s = s.trimStart();
    if (s === before) break;
  }
  return s.trim();
}

/** True if a statement contains only comments / whitespace. */
function isCommentOnly(s: string): boolean {
  const stripped = s
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.replace(/(--.*$|#.*$)/, ""))
    .join("")
    .trim();
  return stripped.length === 0;
}
