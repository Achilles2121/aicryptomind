/* eslint-env node */
import fs from "fs";
import path from "path";
import process from "process";

const badPatterns = [
  /Ã¤/,
  /Ã„/,
  /Ã¶/,
  /Ã–/,
  /Ã¼/,
  /Ãœ/,
  /ÃŸ/,
  /fÃ¼r/,
  /mÃ¶g/,
  /GrÃ¼n/,
  /StÃ¤rk/,
  /SeitwÃ¤rts/,
  /VolatilitÃ¤t/,
  /â€“/,
  /â€”/,
  /â€ž/,
  /â€œ/,
  /â€/,
  /â€¦/,
  /â†’/,
  /Ã–mer/,
  /EintrÃ¤ge/,
];

const includeExt = new Set([".js", ".jsx", ".ts", ".tsx", ".json", ".html"]);
const ignoreDirs = new Set(["node_modules", ".git", "dist", ".vercel"]);
const ignoreFiles = new Set([path.join("scripts", "check-encoding.js")]);

async function walk(dir) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (ignoreDirs.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
    } else if (includeExt.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }
  return files;
}

async function main() {
  const files = await walk(process.cwd());
  const offenders = [];

  for (const file of files) {
    const relative = path.relative(process.cwd(), file);
    if (ignoreFiles.has(relative)) continue;
    const content = await fs.promises.readFile(file, "utf8");
    const matches = badPatterns.filter((re) => re.test(content)).map((re) => re.source);
    if (matches.length) {
      offenders.push({ file, matches });
    }
  }

  if (offenders.length) {
    console.error("Encoding issues detected:");
    offenders.forEach(({ file, matches }) => {
      console.error(`- ${file}: ${matches.join(", ")}`);
    });
    process.exit(1);
  } else {
    console.log("No encoding issues found.");
  }
}

main().catch((err) => {
  console.error("Encoding check failed:", err);
  process.exit(1);
});
