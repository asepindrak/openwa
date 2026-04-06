const fs = require("fs");
const path = require("path");
const { workspacesDir, ensureDir } = require("../utils/paths");
const terminalService = require("./terminal-service");

async function safeWriteFiles(files = []) {
  const written = [];
  for (const f of files) {
    const rel = String(f.path || f.filename || "").trim();
    const content = f.content || f.body || "";
    if (!rel) continue;

    // Normalize incoming path to avoid absolute paths or drive letters
    // Remove Windows drive prefix (C:\) and any leading slashes/backslashes
    // Strip optional Windows drive letter (e.g. C:) then leading slashes
    let relClean = rel.replace(/^[A-Za-z]:/, "");
    relClean = relClean.replace(/^[\\/]+/, "");
    // Prevent path traversal (.. segments)
    const normalizedRel = path.normalize(relClean);
    if (
      !normalizedRel ||
      normalizedRel === "." ||
      normalizedRel.split(path.sep).includes("..")
    ) {
      throw new Error(`refusing unsafe or empty path: ${rel}`);
    }

    const root = path.resolve(workspacesDir);
    const target = path.resolve(root, normalizedRel);
    const relFromRoot = path.relative(root, target);
    if (relFromRoot.split(path.sep).includes("..")) {
      throw new Error(`refusing to write outside workspaces: ${rel}`);
    }
    ensureDir(path.dirname(target));
    const tmp = target + ".tmp";
    fs.writeFileSync(tmp, String(content || ""), "utf8");
    try {
      fs.renameSync(tmp, target);
    } catch (e) {
      fs.writeFileSync(target, String(content || ""), "utf8");
    }
    written.push(target);
  }
  return written;
}

async function executeTool({ action, data = {}, userId, ctx = {} }) {
  console.info(`[tool-executor] action=${action} user=${userId}`);
  try {
    if (action === "write_files") {
      const files = Array.isArray(data.files) ? data.files : [];
      const written = await safeWriteFiles(files);
      return { ok: true, action, result: { written } };
    }

    if (action === "run_terminal") {
      let command = String(data.command || data.cmd || "").trim();
      if (!command) throw new Error("run_terminal missing command");

      // Sanitize common shell prefixes that are not portable (e.g. 'set -e')
      // Remove leading 'set -e', 'set -o errexit', or variants that would break on Windows
      try {
        command = command.replace(/^\s*set\s+-o\s+errexit\s*[;\n\r]*/i, "");
        command = command.replace(/^\s*set\s+-[a-zA-Z]+\s*[;\n\r]*/i, (m) => {
          // If the flags include 'e' (errexit) remove the whole set invocation
          return /e/i.test(m) ? "" : m;
        });
      } catch (e) {}

      // Insert '&&' between commands when the LLM concatenates commands without separators,
      // for example: "cd dir npm install" -> "cd dir && npm install".
      try {
        command = command.replace(
          /([^\r\n;&|])\s+(?=(?:cd|npm|node|cat|mkdir|rm|echo|curl|git|sed|touch|cp|mv|python|pip|yarn|sudo|wget|tar)\b)/gi,
          "$1 && ",
        );
      } catch (e) {}

      // Detect heredoc-style file creation (e.g. cat > file <<'DELIM' ... DELIM)
      // and write those files directly into the workspace before running the shell command.
      const heredocFiles = [];
      // Helper to find last occurrence of cd before an index
      function findLastCdDir(str, idx) {
        const sub = str.slice(0, idx);
        const re = /(?:^|\s|&&|;)cd\s+([^\s;&|]+)/g;
        let m;
        let last = null;
        while ((m = re.exec(sub))) last = m[1];
        return last;
      }

      // Helper to find filename from last cat/tee before index
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

      // Iterate and extract heredoc blocks
      let scanIdx = 0;
      while (scanIdx < command.length) {
        const idx = command.indexOf("<<", scanIdx);
        if (idx === -1) break;

        // parse delimiter (possibly quoted)
        let j = idx + 2;
        // skip optional whitespace
        while (command[j] === " " || command[j] === "\t") j++;
        let delim = null;
        if (command[j] === "'" || command[j] === '"') {
          const q = command[j];
          j++;
          const k = command.indexOf(q, j);
          if (k === -1) break;
          delim = command.slice(j, k);
          j = k + 1;
        } else {
          // unquoted delimiter: read until whitespace
          const m = command.slice(j).match(/^([A-Za-z0-9_+-]+)/);
          if (!m) break;
          delim = m[1];
          j += m[1].length;
        }

        // content starts after any whitespace/newline following j
        let contentStart = j;
        // If the next character is a newline, skip it
        if (command[contentStart] === "\r") contentStart++;
        if (command[contentStart] === "\n") contentStart++;

        // find closing delimiter occurrence
        const delimIdx = command.indexOf("\n" + delim, contentStart);
        let delimFoundAt = -1;
        if (delimIdx !== -1) {
          delimFoundAt = delimIdx + 1; // position of delimiter
        } else {
          // fallback: search for delimiter without newline prefix
          const alt = command.indexOf(delim, contentStart);
          if (alt !== -1) delimFoundAt = alt;
        }

        if (delimFoundAt === -1) break;

        const content = command
          .slice(contentStart, delimFoundAt)
          .replace(/^[\r\n]+|[\r\n]+$/g, "");

        // find filename target
        const filename = findFilenameBeforeIndex(command, idx);
        if (!filename) {
          // cannot determine filename; skip this heredoc
          scanIdx = j;
          continue;
        }

        // determine cwd prefix based on last cd before this heredoc
        const cdDir = findLastCdDir(command, idx);
        const targetPath = cdDir ? path.join(cdDir, filename) : filename;

        // queue for writing
        heredocFiles.push({ path: targetPath, content });

        // remove the heredoc block (from the 'cat' occurrence to the end of delimiter)
        const posCat = Math.max(
          command.lastIndexOf("cat", idx),
          command.lastIndexOf("tee", idx),
        );
        const removeStart = posCat !== -1 ? posCat : idx;
        const removeEnd = delimFoundAt + delim.length;
        command =
          command.slice(0, removeStart) + " " + command.slice(removeEnd);

        // continue scanning after removeStart
        scanIdx = removeStart + 1;
      }

      // If we found heredoc-derived files, write them using safeWriteFiles
      if (heredocFiles.length > 0) {
        try {
          const written = await safeWriteFiles(heredocFiles);
          // attach written files info to data for downstream handling
          data._heredoc_written = written;
        } catch (e) {
          return {
            ok: false,
            action,
            error: `failed to write heredoc files: ${e && e.message ? e.message : e}`,
          };
        }
      }
      const cwd = data.cwd || data.dir || null;
      const approvalMode = data.approvalMode || data.mode || "manual";
      const timeout = Number(data.timeout) || undefined;
      // If there's no remaining command after extracting heredocs, return written info
      const remainingCommand = String(command || "").trim();
      if (!remainingCommand) {
        return {
          ok: true,
          action,
          result: { written: data._heredoc_written || [] },
        };
      }

      const res = await terminalService.requestExecution(
        userId,
        {
          command: remainingCommand,
          approvalMode,
          timeout,
          trustedAuto: !!data.trustedAuto,
          cwd,
        },
        ctx && ctx.io,
      );

      // include written files info if any
      if (data._heredoc_written) {
        return {
          ok: true,
          action,
          result: { written: data._heredoc_written, terminal: res },
        };
      }

      return { ok: true, action, result: res };
    }

    if (action === "invoke_registered_tool") {
      // Delegates to agent-service's invokeRegisteredTool to reuse registry logic
      const agentService = require("./agent-service");
      const id = data.id || data.toolId || data.name;
      if (!id) throw new Error("invoke_registered_tool missing id");
      const opts = data.options || data || {};
      const res = await agentService.invokeRegisteredTool(
        userId,
        id,
        opts,
        ctx,
      );
      return { ok: true, action, result: res };
    }

    // Unknown action: surface error to orchestrator
    throw new Error(`unknown action: ${action}`);
  } catch (err) {
    console.error(
      `[tool-executor] error action=${action} err=${err && err.message}`,
    );
    return {
      ok: false,
      action,
      error: String(err && err.message ? err.message : err),
    };
  }
}

module.exports = {
  executeTool,
};
