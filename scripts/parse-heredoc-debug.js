const path = require("path");
const command =
  "mkdir -p article-api && cd article-api && cat > index.js <<'JS'\nconsole.log('hello from heredoc');\nJS && echo done";

function findLastCdDir(str, idx) {
  const sub = str.slice(0, idx);
  const re = /(?:^|\s|&&|;)cd\s+([^\s;&|]+)/g;
  let m;
  let last = null;
  while ((m = re.exec(sub))) last = m[1];
  return last;
}

function findFilenameBeforeIndex(str, idx) {
  const sub = str.slice(0, idx);
  const posCat = sub.lastIndexOf("cat");
  const posTee = sub.lastIndexOf("tee");
  const pos = Math.max(posCat, posTee);
  if (pos === -1) return null;
  const after = sub.slice(pos);
  const m = after.match(/(?:cat|tee)\s*(?:>|>>)\s*(['"])?([^\s'";|]+)\1/);
  if (m) return m[2];
  return null;
}

let scanIdx = 0;
const heredocFiles = [];
let commandCopy = command;
while (scanIdx < commandCopy.length) {
  const idx = commandCopy.indexOf("<<", scanIdx);
  if (idx === -1) break;
  let j = idx + 2;
  while (commandCopy[j] === " " || commandCopy[j] === "\t") j++;
  let delim = null;
  if (commandCopy[j] === "'" || commandCopy[j] === '"') {
    const q = commandCopy[j];
    j++;
    const k = commandCopy.indexOf(q, j);
    if (k === -1) break;
    delim = commandCopy.slice(j, k);
    j = k + 1;
  } else {
    const m = commandCopy.slice(j).match(/^([A-Za-z0-9_+-]+)/);
    if (!m) break;
    delim = m[1];
    j += m[1].length;
  }
  let contentStart = j;
  if (commandCopy[contentStart] === "\r") contentStart++;
  if (commandCopy[contentStart] === "\n") contentStart++;
  const delimIdx = commandCopy.indexOf("\n" + delim, contentStart);
  let delimFoundAt = -1;
  if (delimIdx !== -1) delimFoundAt = delimIdx + 1;
  else {
    const alt = commandCopy.indexOf(delim, contentStart);
    if (alt !== -1) delimFoundAt = alt;
  }
  if (delimFoundAt === -1) break;
  const content = commandCopy
    .slice(contentStart, delimFoundAt)
    .replace(/^[\r\n]+|[\r\n]+$/g, "");
  const filename = findFilenameBeforeIndex(commandCopy, idx);
  const cdDir = findLastCdDir(commandCopy, idx);
  const targetPath = cdDir ? path.join(cdDir, filename) : filename;
  heredocFiles.push({ filename, cdDir, targetPath, content });
  const posCat = Math.max(
    commandCopy.lastIndexOf("cat", idx),
    commandCopy.lastIndexOf("tee", idx),
  );
  const removeStart = posCat !== -1 ? posCat : idx;
  const removeEnd = delimFoundAt + delim.length;
  commandCopy =
    commandCopy.slice(0, removeStart) + " " + commandCopy.slice(removeEnd);
  scanIdx = removeStart + 1;
}

console.log("Original command:\n", command);
console.log("\nParsed heredoc files:", JSON.stringify(heredocFiles, null, 2));
console.log("\nRemaining command:\n", commandCopy);
