const fs = require("fs");
const path = require("path");
const {
  rootDir,
  mediaDir,
  storageDir,
  workspacesDir,
  ensureRuntimeDirs,
} = require("../utils/paths");
const IDENTITY_PATH = path.join(storageDir, "IDENTITY.md");
const TOOLS_PATH = path.join(storageDir, "TOOLS.md");
const aiProviderService = require("./ai-provider-service");
const llmService = require("./llm-service");
const chatService = require("./chat-service");
const assistantService = require("./assistant-service");
const apiKeyService = require("./api-key-service");
const webhookService = require("./webhook-service");
const sessionService = require("./session-service");
const terminalService = require("./terminal-service");
const { prisma } = require("../database/client");
const { v4: uuidv4 } = require("uuid");
const toolCredentialService = require("./tool-credential-service");
const userSettings = require("./user-settings");
const OS_NAME_MAP = { win32: "Windows", darwin: "macOS", linux: "Linux" };
const hostPlatform = process.platform || "unknown";
const hostOS = OS_NAME_MAP[hostPlatform] || hostPlatform;

function ensureToolsFile() {
  // ensure runtime dirs exist before writing into the user data dir
  try {
    ensureRuntimeDirs();
  } catch (e) {
    // ignore
  }

  if (!fs.existsSync(TOOLS_PATH)) {
    const defaultContent = `# TOOLS.md

This file documents tools and skills available to the OpenWA Assistant.

Default skills:
- add_device: create a new WhatsApp session/device for the user.
- add_llm_provider: add an LLM provider (OpenAI/Anthropic/Ollama/OpenRouter).
- update_assistant: change assistant display name, avatar, or persona.
- create_api_key: generate an API key for the user.
- update_webhook: set incoming webhook URL and key.
- update_tools_md: update this file with new tools/skills provided by user.

The assistant may append new tool descriptions here when the user provides external tool documentation.
`;

    fs.writeFileSync(TOOLS_PATH, defaultContent, "utf8");
  }
}

async function readToolsFile() {
  try {
    ensureToolsFile();
    return fs.readFileSync(TOOLS_PATH, "utf8");
  } catch (err) {
    return "";
  }
}

async function updateToolsFile({ action = "append", content = "" }) {
  ensureToolsFile();
  if (action === "replace") {
    fs.writeFileSync(TOOLS_PATH, String(content || ""), "utf8");
    return { ok: true };
  }

  // default append
  fs.appendFileSync(TOOLS_PATH, `\n${String(content || "")}\n`, "utf8");
  return { ok: true };
}

function ensureIdentityFile() {
  try {
    ensureRuntimeDirs();
  } catch (e) {
    // ignore
  }

  if (!fs.existsSync(IDENTITY_PATH)) {
    const defaultContent = `# IDENTITY.md

This file documents the user's identity and preferences for the OpenWA Assistant.

Example fields:
- name: Your Name
- displayName: Friendly name to use when addressing you
- email: you@example.com
- role: Owner
- organization: Example Corp
- timezone: Asia/Jakarta
- locale: id-ID
- bio: Short description about yourself

Edit this file so the assistant can use accurate identity/context when replying or taking actions.
`;
    fs.writeFileSync(IDENTITY_PATH, defaultContent, "utf8");
  }
}

async function readIdentityFile() {
  try {
    ensureIdentityFile();
    return fs.readFileSync(IDENTITY_PATH, "utf8");
  } catch (err) {
    return "";
  }
}

// Register an external tool manifest: validate, persist registry, and append to TOOLS.md
async function registerExternalTool(
  userId,
  manifest = {},
  { overwrite = false } = {},
) {
  try {
    ensureRuntimeDirs();
  } catch (e) {
    // ignore
  }
  if (!manifest || typeof manifest !== "object") {
    throw new Error("manifest must be an object");
  }

  const id = String(manifest.id || "").trim();
  const name = String(manifest.name || "").trim();
  const description = String(manifest.description || "").trim();

  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new Error(
      "manifest.id is required and must be alphanumeric (dash/underscore allowed)",
    );
  }
  if (!name) throw new Error("manifest.name is required");
  if (!description) throw new Error("manifest.description is required");

  const registryPath = path.join(storageDir, "tools_registry.json");
  let registry = {};
  try {
    if (fs.existsSync(registryPath)) {
      const raw = fs.readFileSync(registryPath, "utf8");
      registry = raw ? JSON.parse(raw) : {};
    }
  } catch (e) {
    registry = {};
  }

  if (registry[id] && !overwrite) {
    throw new Error(`tool with id '${id}' already exists`);
  }

  const invokeVal = manifest.invoke || manifest.type || "none";

  const entry = {
    id,
    name,
    description,
    docs: manifest.docs || manifest.docsUrl || null,
    invoke: invokeVal,
    // allow invocation automatically when the manifest includes an explicit HTTP base URL
    invokeEnabled: /^https?:\/\//i.test(String(invokeVal || "")),
    example: manifest.example || null,
    addedBy: userId,
    addedAt: new Date().toISOString(),
  };

  registry[id] = entry;

  try {
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2), "utf8");
  } catch (e) {
    throw new Error(`failed to write registry: ${e.message}`);
  }

  // Append a human-readable entry to TOOLS.md
  const append = `### Tool: ${entry.name} (${entry.id})\n\n${entry.description}\n\nDocs: ${entry.docs || "N/A"}\nInvoke: ${entry.invoke}\n\n`;
  await updateToolsFile({ action: "append", content: append });

  // Clean duplicates in TOOLS.md so older entries for the same tool id are removed
  try {
    const toolsText = await readToolsFile();
    const cleaned = removeDuplicateToolEntries(toolsText);
    if (cleaned !== toolsText) {
      await updateToolsFile({ action: "replace", content: cleaned });
    }
  } catch (e) {
    // ignore cleanup errors
  }

  return { ok: true, tool: entry };
}

// Remove duplicate "### Tool: Name (id)" blocks.
// Keep only the last occurrence when duplicates are detected by:
// - exact tool id
// - normalized docs URL
// - slugified tool name
// This helps avoid repeated entries appended for the same tool when
// registration happens multiple times using different ids or manifests.
function removeDuplicateToolEntries(content) {
  if (!content) return content;
  const lines = content.split(/\r?\n/);
  const entries = [];
  const headerRe = /^###\s+Tool:\s*(.*?)\s*\(([^)]+)\)\s*$/;

  function normalizeDocsUrl(u) {
    if (!u) return null;
    try {
      const url = new URL(String(u).trim());
      // keep origin + pathname, remove trailing slash
      return (url.origin + url.pathname).replace(/\/+$/, "").toLowerCase();
    } catch (e) {
      return String(u || "")
        .trim()
        .replace(/\/+$/, "")
        .toLowerCase();
    }
  }

  // find all entry blocks and capture id, name, docs line
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(headerRe);
    if (m) {
      const name = String(m[1] || "").trim();
      const id = String(m[2] || "").trim();
      const start = i;
      // find end of block (next header or EOF)
      let end = lines.length;
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].match(headerRe)) {
          end = j;
          break;
        }
      }

      // look for Docs: line within block
      let docsRaw = null;
      for (let k = start + 1; k < end; k++) {
        const dm = lines[k].match(/^\s*Docs:\s*(\S.*)$/i);
        if (dm) {
          docsRaw = dm[1].trim();
          break;
        }
      }

      entries.push({
        id,
        name,
        nameKey: slugify(name),
        docsRaw,
        docsKey: docsRaw ? normalizeDocsUrl(docsRaw) : null,
        start,
        end,
      });

      i = end - 1;
    }
  }

  if (entries.length === 0) return content;

  // compute last occurrence index for each key we care about
  const lastIndexForKey = {};
  entries.forEach((e, idx) => {
    lastIndexForKey[`id:${e.id}`] = idx;
    if (e.docsKey) lastIndexForKey[`docs:${e.docsKey}`] = idx;
    if (e.nameKey) lastIndexForKey[`name:${e.nameKey}`] = idx;
  });

  // mark any entry that is NOT the last occurrence for any of its keys
  const toRemoveRanges = [];
  entries.forEach((e, idx) => {
    const keys = [`id:${e.id}`];
    if (e.docsKey) keys.push(`docs:${e.docsKey}`);
    if (e.nameKey) keys.push(`name:${e.nameKey}`);

    const shouldRemove = keys.some((k) => lastIndexForKey[k] !== idx);
    if (shouldRemove) toRemoveRanges.push({ start: e.start, end: e.end });
  });

  if (toRemoveRanges.length === 0) return content;

  // build new content skipping removed ranges
  const removed = new Set();
  toRemoveRanges.forEach((r) => {
    for (let k = r.start; k < r.end; k++) removed.add(k);
  });

  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (!removed.has(i)) out.push(lines[i]);
  }

  // normalize multiple blank lines
  let result = out.join("\n");
  result = result.replace(/\n{3,}/g, "\n\n");
  return result;
}

function slugify(input) {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
}

async function fetchAndRegisterTool(userId, options = {}) {
  const { url, apiKey, headerName, overwrite = false } = options || {};
  if (!url) throw new Error("url is required");

  const normalized = String(url).trim();
  let res;
  try {
    const headers = {};
    if (apiKey) {
      const hn = headerName ? String(headerName) : "Authorization";
      headers[hn] =
        hn.toLowerCase() === "authorization" && !/^\s*Bearer\s+/i.test(apiKey)
          ? `Bearer ${apiKey}`
          : apiKey;
    }

    res = await fetch(normalized, {
      method: "GET",
      headers,
      redirect: "follow",
    });
  } catch (err) {
    throw new Error(`failed to fetch url: ${err.message}`);
  }

  const ct = (res.headers.get("content-type") || "").toLowerCase();
  let json = null;
  let text = null;

  if (ct.includes("application/json") || ct.includes("+json")) {
    try {
      json = await res.json();
    } catch (e) {
      text = await res.text();
    }
  } else {
    text = await res.text();
    try {
      json = JSON.parse(text);
    } catch (e) {
      json = null;
    }
  }

  // Build a manifest from discovered content
  let manifest = null;
  try {
    if (json && typeof json === "object") {
      if (json.id && json.name && json.description) {
        manifest = {
          id: String(json.id),
          name: String(json.name),
          description: String(json.description),
          docs: normalized,
          invoke: json.invoke || null,
          example: json.example || null,
        };
      } else if (json.openapi || json.swagger) {
        const info = json.info || {};
        const title = String(info.title || new URL(normalized).hostname);
        const description = String(
          info.description || `OpenAPI imported from ${normalized}`,
        );
        const id = slugify(title || normalized);

        // Try to determine a usable base URL from OpenAPI/Swagger document
        let invokeVal = "openapi";
        try {
          if (
            Array.isArray(json.servers) &&
            json.servers[0] &&
            json.servers[0].url
          ) {
            const serverUrl = String(json.servers[0].url || "").trim();
            if (serverUrl) {
              invokeVal = /^https?:\/\//i.test(serverUrl)
                ? serverUrl
                : new URL(serverUrl, normalized).toString();
            }
          } else if (json.swagger && (json.host || json.basePath)) {
            // Swagger 2.0: build from schemes, host and basePath
            const scheme =
              Array.isArray(json.schemes) && json.schemes[0]
                ? json.schemes[0]
                : "https";
            const host = json.host || new URL(normalized).hostname;
            const basePath = json.basePath || "/";
            invokeVal = `${scheme}://${host}${basePath}`;
          } else {
            // fallback to origin of docs URL
            invokeVal = new URL(normalized).origin;
          }
        } catch (e) {
          invokeVal = "openapi";
        }

        manifest = {
          id,
          name: title,
          description,
          docs: normalized,
          invoke: invokeVal,
        };
      } else if (json.name && json.description) {
        const id = slugify(String(json.name));
        manifest = {
          id,
          name: json.name,
          description: json.description,
          docs: normalized,
        };
      } else {
        const id = slugify(normalized);
        const name = `Imported from ${new URL(normalized).hostname}`;
        manifest = {
          id,
          name,
          description: `Imported JSON from ${normalized}`,
          docs: normalized,
        };
      }
    } else {
      const id = slugify(normalized);
      const name = `Imported from ${new URL(normalized).hostname}`;
      manifest = {
        id,
        name,
        description: `Imported from ${normalized}`,
        docs: normalized,
      };
    }
  } catch (e) {
    throw new Error(`failed to build manifest: ${e.message}`);
  }

  // Persist via existing registry helper
  const result = await registerExternalTool(userId, manifest, { overwrite });

  // If an apiKey was provided when fetching the manifest, store it securely
  if (apiKey) {
    try {
      await toolCredentialService.saveCredential(userId, result.tool.id, {
        apiKey,
        headerName: headerName || "Authorization",
      });
      // annotate result so callers may know credential was stored
      result.credentialSaved = true;
    } catch (e) {
      result.credentialSaved = false;
      result.credentialError = String(e && e.message ? e.message : e);
    }
  }

  return result;
}

async function chooseProviderId(userId) {
  const providers = await aiProviderService.listProviders(userId);
  if (!providers || providers.length === 0) return null;
  return providers[0].id;
  const identityText = await readIdentityFile();
}

function tryParseJsonObject(text) {
  if (!text) return null;
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch (e) {
    return null;
  }
}

const APP_LAUNCH_INTENT_RE =
  /\b(?:buka(?:kan)?|open|jalankan|run|launch|start)\b/i;
const WINDOWS_APP_COMMANDS = {
  notepad: 'start "" notepad',
  calculator: 'start "" calc',
  calc: 'start "" calc',
  paint: 'start "" mspaint',
  explorer: 'start "" explorer',
  terminal: 'start "" wt',
  cmd: 'start "" cmd',
};
const LOCAL_APP_ALIASES = {
  notepad: ["notepad", "notepad.exe", "editor teks", "text editor"],
  calculator: ["calculator", "calc", "kalkulator"],
  paint: ["paint", "mspaint"],
  explorer: ["explorer", "file explorer", "folder"],
  terminal: ["terminal", "windows terminal", "wt"],
  cmd: ["cmd", "command prompt", "prompt perintah"],
};

function normalizeClientPlatform(platform) {
  const value = String(platform || "")
    .trim()
    .toLowerCase();
  if (!value) return hostPlatform;
  if (value.includes("win")) return "win32";
  if (value.includes("mac") || value.includes("darwin")) return "darwin";
  if (value.includes("linux")) return "linux";
  return value;
}

function getClientPlatform(ctx = {}) {
  return normalizeClientPlatform(
    ctx.clientPlatform ||
      (ctx.socket &&
        ctx.socket.handshake &&
        ctx.socket.handshake.auth &&
        ctx.socket.handshake.auth.platform) ||
      hostPlatform,
  );
}

function detectLocalAppName(message) {
  const text = String(message || "").toLowerCase();
  for (const [appName, aliases] of Object.entries(LOCAL_APP_ALIASES)) {
    if (aliases.some((alias) => text.includes(alias))) {
      return appName;
    }
  }
  return null;
}

function buildLocalAppLaunchCommand(appName, platform) {
  if (!appName) return null;
  if (platform === "win32") {
    return WINDOWS_APP_COMMANDS[appName] || null;
  }
  return null;
}

function resolveDirectAssistantToolCall(userMessage, ctx = {}) {
  const text = String(userMessage || "").trim();
  if (!text || !APP_LAUNCH_INTENT_RE.test(text)) return null;

  const platform = getClientPlatform(ctx);
  const appName = detectLocalAppName(text);
  const command = buildLocalAppLaunchCommand(appName, platform);
  if (!command) return null;

  const label =
    appName === "cmd"
      ? "Command Prompt"
      : appName.charAt(0).toUpperCase() + appName.slice(1);

  return {
    tool: "run_terminal",
    args: {
      command,
      approvalMode: "auto",
      trustedAuto: true,
      timeout: 15000,
    },
    directSummary: `Saya menjalankan ${label} di ${OS_NAME_MAP[platform] || platform}.`,
  };
}

function buildAssistantSystemPrompt({
  assistantDisplayName,
  assistantExternalId,
  assistantPersona,
  toolsText,
  openapiText,
  identityText,
  clientPlatform,
}) {
  const personaText = String(assistantPersona || "").trim();
  const identitySection = String(identityText || "").trim()
    ? `\n\nIDENTITY.md:\n${String(identityText || "").trim()}`
    : "";
  const platformName = OS_NAME_MAP[clientPlatform] || clientPlatform || hostOS;

  return `${personaText || `You are ${assistantDisplayName}, an OpenWA assistant that executes the correct internal tool instead of replying with generic how-to steps when a supported action is clear.`}\n\nAssistant profile:\n- displayName: ${assistantDisplayName}\n- externalId: ${assistantExternalId}\n- hostOS: ${hostOS}\n- userPlatform: ${platformName}\n\nResponse format rules:\n- When you are not calling a tool, write in concise GitHub-flavored Markdown.\n- Use short paragraphs by default.\n- Use flat bullet or numbered lists only when the content is naturally list-shaped.\n- Use fenced code blocks for commands, JSON, or multi-line snippets.\n- Use inline code for commands, paths, env vars, and identifiers.\n- Do not wrap normal prose in code fences.\n- Do not output Markdown code fences when you are returning a tool-call JSON object; return raw JSON only.\n\nYou can perform configuration actions and call tools when requested. Available tools: ${Object.keys(
    tools,
  )}.\n\nFor supported local app launch requests on the user's device, prefer calling run_terminal with the correct OS command instead of describing manual steps. When a user message contains an attachment marker or image content, treat the file as already attached in the current chat. Do not ask the user to upload the file again unless the attachment is explicitly missing or corrupted.${identitySection}\n\nTOOLS.md:\n${toolsText}\n\nOpenAPI doc (JSON):\n${openapiText}\n\nWhen you want to execute a tool, respond with a JSON object only, for example: {"tool":"add_device","args":{"name":"Sales","phoneNumber":"12345"}}. Otherwise respond with a plain text message for the user.`;
}

function normalizeAssistantInput(input) {
  if (typeof input === "string") {
    return {
      body: input,
      type: "text",
      mediaFileId: null,
      replyToId: null,
    };
  }

  const payload = input && typeof input === "object" ? input : {};
  return {
    body: String(payload.body || ""),
    type: payload.type || (payload.mediaFileId ? "document" : "text"),
    mediaFileId: payload.mediaFileId || null,
    replyToId: payload.replyToId || null,
  };
}

async function loadAssistantMediaFile(userId, mediaFileId) {
  if (!mediaFileId) return null;
  return prisma.mediaFile.findFirst({
    where: {
      id: mediaFileId,
      userId,
    },
  });
}

function buildMessageContentForLLM(message) {
  const body = String(message?.body || "").trim();
  const mediaFile = message?.mediaFile || null;
  if (!mediaFile) return body;

  const attachmentText = `[attachment already uploaded: ${mediaFile.originalName || "file"}; mimeType: ${mediaFile.mimeType || "unknown"}; relativePath: ${mediaFile.relativePath || "unknown"}]`;
  return body ? `${body}\n${attachmentText}` : attachmentText;
}

function isImageMediaFile(mediaFile) {
  return Boolean(
    mediaFile &&
    String(mediaFile.mimeType || "")
      .toLowerCase()
      .startsWith("image/"),
  );
}

function isVisionCapableProvider(providerName) {
  const normalized = String(providerName || "").toLowerCase();
  return normalized === "openai" || normalized === "openrouter";
}

function resolveMediaFilePath(mediaFile) {
  const relativePath = String(mediaFile?.relativePath || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .trim();
  if (!relativePath) return null;
  const normalized = relativePath.startsWith("media/")
    ? relativePath.slice("media/".length)
    : relativePath;
  return path.join(mediaDir, normalized);
}

function buildAssistantAttachmentInstruction(body, mediaFile) {
  const attachmentText = buildMessageContentForLLM({ body, mediaFile });
  return body
    ? `User attached a file to this message. The file is already uploaded in the current chat and does not need to be re-uploaded. Caption or question: ${body}\n${attachmentText}`
    : `User attached a file to this message. The file is already uploaded in the current chat and does not need to be re-uploaded. ${attachmentText}`;
}

function buildVisionUserContent(body, mediaFile) {
  const filePath = resolveMediaFilePath(mediaFile);
  if (!filePath || !fs.existsSync(filePath)) {
    return buildAssistantAttachmentInstruction(body, mediaFile);
  }

  const maxInlineBytes = 5 * 1024 * 1024;
  if (mediaFile?.size && Number(mediaFile.size) > maxInlineBytes) {
    return buildAssistantAttachmentInstruction(body, mediaFile);
  }

  const base64 = fs.readFileSync(filePath).toString("base64");
  const blocks = [];
  const instruction = body
    ? `User attached this image and asked: ${body}. Analyze the attached image directly.`
    : "User attached this image. Analyze the attached image directly.";

  blocks.push({ type: "text", text: instruction });
  blocks.push({
    type: "image_url",
    image_url: {
      url: `data:${mediaFile.mimeType || "image/png"};base64,${base64}`,
    },
  });

  return blocks;
}

function buildLlmUserContent({ body, mediaFile, providerName }) {
  if (!mediaFile) {
    return String(body || "").trim();
  }

  if (isImageMediaFile(mediaFile) && isVisionCapableProvider(providerName)) {
    return buildVisionUserContent(body, mediaFile);
  }

  return buildAssistantAttachmentInstruction(body, mediaFile);
}

function buildUserRequestSummaryText({ body, mediaFile }) {
  return (
    buildAssistantAttachmentInstruction(body, mediaFile) ||
    String(body || "").trim() ||
    "User sent an attachment."
  );
}

function formatLlmErrorForUser(error) {
  const message = String(error?.message || error || "");
  if (!message) {
    return "Model AI sedang bermasalah. Coba kirim lagi beberapa saat lagi.";
  }

  if (
    /openai request failed|response contained no choices|server_error|llm generate failed/i.test(
      message,
    )
  ) {
    return "Model AI dari provider sedang bermasalah sementara. Pesan Anda sudah diterima, silakan coba lagi beberapa saat lagi.";
  }

  return `Model AI gagal memproses permintaan saat ini. ${message}`;
}

function buildToolResultFallbackText(toolName, toolResult) {
  if (toolName === "run_terminal" && toolResult?.executed) {
    return "Perintah berhasil dijalankan.";
  }

  if (toolResult?.ok === true) {
    return `Tool ${toolName} berhasil dijalankan.`;
  }

  return `Tool ${toolName} executed. Result: ${JSON.stringify(toolResult)}`;
}

async function storeAssistantTerminalMessage({
  userId,
  chatId,
  assistantSender,
  assistantDisplayName,
  command,
  terminalId,
  executed,
  io,
}) {
  const body = executed
    ? `Terminal command finished: ${command}`
    : `Terminal command pending approval: ${command}`;

  const assistantMsg = chatId
    ? await chatService.storeIncomingMessageInChat({
        userId,
        chatId,
        sender: assistantSender,
        body,
        externalMessageId: `terminal:${terminalId}`,
      })
    : await chatService.storeIncomingMessage({
        userId,
        sessionId: null,
        sender: assistantSender,
        displayName: assistantDisplayName,
        body,
        externalMessageId: `terminal:${terminalId}`,
      });

  try {
    io && io.to(`user:${userId}`).emit("new_message", assistantMsg.message);
    io &&
      io.to(`user:${userId}`).emit("contact_list_update", assistantMsg.chat);
  } catch (e) {
    // ignore emit errors
  }
}

function getTerminalCommandForTool(toolName, args, toolResult) {
  if (!toolResult?.id) return null;

  if (toolName === "run_terminal") {
    return String(args?.command || toolResult?.command || "").trim() || null;
  }

  if (toolName === "run_copilot") {
    return String(toolResult?.command || "").trim() || null;
  }

  return null;
}

const tools = {
  add_device: async (userId, args, ctx) => {
    const name = String(args.name || "").trim();
    const phoneNumber = args.phoneNumber || null;
    if (!name) throw new Error("name is required");

    // Create session record and companion chat
    const session = await sessionService.createUserSession(userId, {
      name,
      phoneNumber: phoneNumber || null,
    });

    try {
      await chatService.createSessionCompanionChat(userId, session);
    } catch (e) {
      // ignore companion chat errors
    }

    // Optionally attempt immediate connect if sessionManager provided
    try {
      if (ctx && ctx.sessionManager) {
        await ctx.sessionManager.connectSession(userId, session.id, {
          force: true,
        });
      }
    } catch (e) {
      // ignore connection errors; return created session so caller can act
    }

    return { ok: true, session };
  },
  add_llm_provider: async (userId, args) => {
    const provider = String(args.provider || "").toLowerCase();
    const name = String(args.name || provider || "Provider");
    const cfg = args.config || {};
    const created = await aiProviderService.createProvider(userId, {
      provider,
      name,
      config: cfg,
    });
    return { ok: true, provider: created };
  },
  update_assistant: async (userId, args) => {
    const { displayName, avatarUrl, persona } = args || {};
    const updated = await assistantService.updateAssistant(userId, {
      displayName,
      avatarUrl,
      persona,
    });
    return { ok: true, assistant: updated };
  },
  create_api_key: async (userId, args) => {
    const name = String(args.name || `agent-${Date.now()}`);
    const result = await apiKeyService.createApiKey(userId, { name });
    return { ok: true, apiKey: result };
  },
  update_webhook: async (userId, args) => {
    const { url, apiKey } = args || {};
    if (!url) throw new Error("url is required");
    const cfg = webhookService.setWebhook(userId, { url, apiKey });
    return { ok: true, webhook: cfg };
  },
  run_terminal: async (userId, args, ctx) => {
    const { command, approvalMode, timeout = 300000, trustedAuto } = args || {};
    if (!command) throw new Error("command is required");

    // If the user has enabled auto-approve in settings, prefer auto when
    // approvalMode isn't explicitly set to 'manual'. This ensures server-side
    // agent invocations follow the user's toggle.
    let effectiveApprovalMode = approvalMode;
    try {
      const pref = await userSettings.getSetting(
        userId,
        "autoApproveAllTerminalCommands",
      );
      if (!effectiveApprovalMode && pref) effectiveApprovalMode = "auto";
    } catch (e) {
      // ignore and fallback to provided/default
    }

    // Pass socket/io so terminal-service can emit request/result events
    const res = await terminalService.requestExecution(
      userId,
      {
        command,
        approvalMode: effectiveApprovalMode,
        timeout,
        trustedAuto: !!trustedAuto,
        chatId: ctx?.chatId || null,
      },
      ctx && ctx.io,
    );
    return res;
  },
  run_copilot: async (userId, args, ctx) => {
    const prompt = String(args.prompt || args.command || "").trim();
    if (!prompt) throw new Error("prompt is required");
    const escaped = prompt.replace(/"/g, '\\"');
    const command = `copilot -sp "${escaped}"`;
    const timeout = Number(args.timeout) || 300000;

    try {
      const execRes = await terminalService.requestExecution(
        userId,
        { command, approvalMode: "auto", timeout, chatId: ctx?.chatId || null },
        ctx && ctx.io,
      );
      return {
        ok: true,
        command,
        id: execRes?.id,
        executed: !!execRes?.executed,
        result: execRes?.result,
      };
    } catch (err) {
      throw new Error(`copilot execution failed: ${err.message}`);
    }
  },
  search_messages: async (userId, args) => {
    const q = String(args.q || "").trim();
    if (!q) throw new Error("q is required");
    const chatId = args.chatId || null;
    const limit = Math.max(1, Math.min(Number(args.limit) || 10, 50));

    const where = {
      AND: [
        { chat: { userId } },
        ...(chatId ? [{ chatId }] : []),
        {
          OR: [
            { body: { contains: q } },
            { sender: { contains: q } },
            { mediaFile: { originalName: { contains: q } } },
            { mediaFile: { fileName: { contains: q } } },
          ],
        },
      ],
    };

    const results = await prisma.message.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        mediaFile: true,
        chat: { include: { contact: true } },
        replyTo: { include: { mediaFile: true } },
        statuses: true,
      },
    });

    return {
      ok: true,
      count: results.length,
      messages: results.map((m) => ({
        id: m.id,
        chatId: m.chatId,
        chatTitle: m.chat?.title || null,
        contact: m.chat?.contact
          ? {
              id: m.chat.contact.id,
              displayName: m.chat.contact.displayName,
              externalId: m.chat.contact.externalId,
            }
          : null,
        sender: m.sender,
        body: m.body,
        type: m.type,
        createdAt: m.createdAt,
        mediaFile: m.mediaFile
          ? {
              id: m.mediaFile.id,
              originalName: m.mediaFile.originalName,
              mimeType: m.mediaFile.mimeType,
              relativePath: m.mediaFile.relativePath,
            }
          : null,
      })),
    };
  },
  register_tool: async (userId, args) => {
    const manifest = args.manifest || args || {};
    const overwrite = Boolean(args.overwrite);
    const res = await registerExternalTool(userId, manifest, { overwrite });

    // If apiKey provided with direct manifest registration, save it for caller
    if (args.apiKey) {
      try {
        await toolCredentialService.saveCredential(userId, res.tool.id, {
          apiKey: args.apiKey,
          headerName: args.headerName || "Authorization",
        });
        res.credentialSaved = true;
      } catch (e) {
        res.credentialSaved = false;
        res.credentialError = String(e && e.message ? e.message : e);
      }
    }

    return res;
  },
  register_tool_from_url: async (userId, args) => {
    const url = args.url || args.manifestUrl || args.link;
    const apiKey = args.apiKey || args.key || null;
    const headerName = args.headerName || null;
    const overwrite = Boolean(args.overwrite);
    const res = await fetchAndRegisterTool(userId, {
      url,
      apiKey,
      headerName,
      overwrite,
    });
    return res;
  },
  invoke_registered_tool: async (userId, args, ctx) => {
    const toolId = args.id || args.toolId || args.name;
    if (!toolId) throw new Error("tool id is required");
    const options = args.options || args || {};
    const res = await invokeRegisteredTool(userId, toolId, options, ctx);
    return { ok: true, result: res };
  },
  update_tools_md: async (userId, args) => {
    const { action, content } = args || {};
    await updateToolsFile({
      action: action || "append",
      content: content || "",
    });
    return { ok: true };
  },
};

// Invoke a registered tool by id. Supports HTTP and OpenAPI-backed tools.
async function invokeRegisteredTool(userId, toolId, options = {}, ctx = {}) {
  const registryPath = path.join(storageDir, "tools_registry.json");
  if (!fs.existsSync(registryPath)) throw new Error("tools registry not found");
  let registry = {};
  try {
    registry = JSON.parse(fs.readFileSync(registryPath, "utf8") || "{}");
  } catch (e) {
    throw new Error("failed to read tools registry");
  }

  const entry = registry[toolId];
  if (!entry) throw new Error(`tool not found: ${toolId}`);

  // Authorization: allow if the invoking user added the tool or the tool has invokeEnabled
  if (entry.addedBy !== userId && !entry.invokeEnabled) {
    throw new Error("not authorized to invoke this tool");
  }

  // Resolve base URL
  let baseUrl = null;
  if (entry.invoke && /^https?:\/\//i.test(String(entry.invoke))) {
    baseUrl = String(entry.invoke);
  } else if (
    String(entry.invoke) === "openapi" &&
    entry.docs &&
    /^https?:\/\//i.test(String(entry.docs))
  ) {
    try {
      const openapiResp = await fetch(String(entry.docs));
      const doc = await openapiResp.json().catch(() => null);
      if (
        doc &&
        Array.isArray(doc.servers) &&
        doc.servers[0] &&
        doc.servers[0].url
      ) {
        baseUrl = String(doc.servers[0].url);
      } else {
        baseUrl = new URL(entry.docs).origin;
      }
    } catch (e) {
      baseUrl = new URL(entry.docs).origin;
    }
  } else if (entry.docs && /^https?:\/\//i.test(String(entry.docs))) {
    // fallback to docs origin
    baseUrl = new URL(entry.docs).origin;
  }

  if (!baseUrl)
    throw new Error("cannot determine base URL for tool invocation");

  const method = (options.method || options.verb || "GET").toUpperCase();
  const pathOrUrl = options.url || options.path || "/";
  let targetUrl;
  try {
    targetUrl = /^https?:\/\//i.test(String(pathOrUrl))
      ? String(pathOrUrl)
      : new URL(pathOrUrl, baseUrl).toString();
  } catch (e) {
    throw new Error("invalid target path/url");
  }

  // If caller did not provide an apiKey in options, try to load a stored credential
  if (!options.apiKey) {
    try {
      const cred = await toolCredentialService.getCredentialForUser(
        userId,
        toolId,
      );
      if (cred && cred.apiKey) {
        options.apiKey = cred.apiKey;
        options.headerName =
          options.headerName || cred.headerName || "Authorization";
      }
    } catch (e) {
      // ignore credential errors and proceed without stored apiKey
    }
  }

  const headers = Object.assign({}, options.headers || {});
  // support passing apiKey in options
  if (options.apiKey) {
    const hn = options.headerName || "Authorization";
    headers[hn] =
      hn.toLowerCase() === "authorization" &&
      !/^\s*Bearer\s+/i.test(options.apiKey)
        ? `Bearer ${options.apiKey}`
        : options.apiKey;
  }

  // Add meta headers
  headers["x-openwa-tool-id"] = toolId;
  headers["x-openwa-user-id"] = userId;

  // Append query params
  if (options.params && typeof options.params === "object") {
    const u = new URL(targetUrl);
    Object.entries(options.params || {}).forEach(([k, v]) =>
      u.searchParams.append(k, String(v)),
    );
    targetUrl = u.toString();
  }

  // Body handling
  let body = undefined;
  if (
    options.body !== undefined &&
    options.body !== null &&
    method !== "GET" &&
    method !== "HEAD"
  ) {
    if (typeof options.body === "object" && !(options.body instanceof Buffer)) {
      body = JSON.stringify(options.body);
      headers["content-type"] = headers["content-type"] || "application/json";
    } else {
      body = options.body;
    }
  }

  // Timeout support
  const timeout = Number(options.timeout) || 0;
  let controller;
  let signal = undefined;
  if (timeout > 0) {
    controller = new AbortController();
    signal = controller.signal;
    setTimeout(() => controller.abort(), timeout);
  }

  let resp;
  try {
    resp = await fetch(targetUrl, {
      method,
      headers,
      body,
      signal,
      redirect: "follow",
    });
  } catch (err) {
    if (err.name === "AbortError") throw new Error("request timed out");
    throw new Error(`request failed: ${err.message}`);
  }

  const headersObj = {};
  for (const [k, v] of resp.headers) headersObj[k] = v;

  const rawText = await resp.text().catch(() => "");
  let parsed = null;
  try {
    parsed = JSON.parse(rawText);
  } catch (e) {
    parsed = null;
  }

  return {
    ok: resp.ok,
    status: resp.status,
    statusText: resp.statusText,
    headers: headersObj,
    body: parsed !== null ? parsed : rawText,
    rawBody: rawText,
  };
}

async function handleAssistantMessage(userId, chatId, input, ctx = {}) {
  const { config, io, socket, sessionManager } = ctx || {};
  const assistantInput = normalizeAssistantInput(input);
  const mediaFile = await loadAssistantMediaFile(
    userId,
    assistantInput.mediaFileId,
  );
  const llmUserMessage = buildMessageContentForLLM({
    body: assistantInput.body,
    mediaFile,
  });

  // store user's outgoing message (so it appears in conversation)
  const userResult = await chatService.createOutgoingMessage({
    userId,
    chatId,
    body: assistantInput.body,
    type: assistantInput.type,
    mediaFileId: assistantInput.mediaFileId,
    replyToId: assistantInput.replyToId,
  });
  const assistantSender =
    (userResult && userResult.message && userResult.message.receiver) ||
    "openwa:assistant";
  const assistantDisplayName =
    (userResult &&
      userResult.chat &&
      userResult.chat.contact &&
      userResult.chat.contact.displayName) ||
    "OpenWA Assistant";
  try {
    io.to(`user:${userId}`).emit("new_message", userResult.message);
    io.to(`user:${userId}`).emit("contact_list_update", userResult.chat);
  } catch (e) {
    // ignore emit errors
  }

  let chatSummary = null;
  if (chatId) {
    try {
      chatSummary = await chatService.getChatWithContact(userId, chatId);
    } catch (e) {
      chatSummary = null;
    }
  }

  const directToolCall = resolveDirectAssistantToolCall(
    assistantInput.body,
    ctx,
  );

  // Prepare context for LLM only when needed.
  let providerId = null;
  let providerName = null;
  if (!directToolCall) {
    providerId = await chooseProviderId(userId);
    if (!providerId) {
      const help =
        "No AI provider configured. Please add an LLM provider in Settings or ask me to add one.";
      const assistantMsg = await chatService.storeIncomingMessage({
        userId,
        sessionId: null,
        sender: assistantSender,
        displayName: assistantDisplayName,
        body: help,
      });
      io.to(`user:${userId}`).emit("new_message", assistantMsg.message);
      io.to(`user:${userId}`).emit("contact_list_update", assistantMsg.chat);
      return;
    }

    try {
      const provider = await aiProviderService.getProvider(userId, providerId);
      providerName = provider?.provider || null;
    } catch (e) {
      providerName = null;
    }
  }

  const toolsText = await readToolsFile();
  const identityText = await readIdentityFile();
  let openapiText = "";
  try {
    const openapiModule = require("../express/openapi");
    const doc = openapiModule.createOpenApiDocument(config || {});
    openapiText = JSON.stringify(doc);
  } catch (e) {
    openapiText = "";
  }

  const clientPlatform = getClientPlatform(ctx);
  const systemPrompt = buildAssistantSystemPrompt({
    assistantDisplayName,
    assistantExternalId:
      (chatSummary && chatSummary.contact && chatSummary.contact.externalId) ||
      assistantSender,
    assistantPersona:
      chatSummary && chatSummary.contact ? chatSummary.contact.persona : null,
    toolsText,
    openapiText,
    identityText,
    clientPlatform,
  });

  if (directToolCall) {
    let toolResult;
    try {
      toolResult = await tools[directToolCall.tool](
        userId,
        directToolCall.args,
        ctx,
      );
    } catch (err) {
      const assistErr = `Tool error: ${err.message}`;
      const assistantMsg = await chatService.storeIncomingMessage({
        userId,
        sessionId: null,
        sender: assistantSender,
        displayName: assistantDisplayName,
        body: assistErr,
      });
      io.to(`user:${userId}`).emit("new_message", assistantMsg.message);
      io.to(`user:${userId}`).emit("contact_list_update", assistantMsg.chat);
      return;
    }

    const terminalCommand = getTerminalCommandForTool(
      directToolCall.tool,
      directToolCall.args,
      toolResult,
    );

    if (terminalCommand && toolResult?.id) {
      await storeAssistantTerminalMessage({
        userId,
        chatId,
        assistantSender,
        assistantDisplayName,
        command: terminalCommand,
        terminalId: toolResult.id,
        executed: !!toolResult.executed,
        io,
      });
      return;
    }

    const finalText =
      toolResult && toolResult.executed
        ? directToolCall.directSummary
        : `Saya menyiapkan permintaan menjalankan aplikasi lokal. Request id: ${toolResult.id}`;

    const assistantMsg = await chatService.storeIncomingMessage({
      userId,
      sessionId: null,
      sender: assistantSender,
      displayName: assistantDisplayName,
      body: finalText,
    });
    io.to(`user:${userId}`).emit("new_message", assistantMsg.message);
    io.to(`user:${userId}`).emit("contact_list_update", assistantMsg.chat);
    return;
  }

  // First LLM call: include chat context when available
  let llmResp;
  try {
    const messagesForLLM = [{ role: "system", content: systemPrompt }];

    if (clientPlatform) {
      messagesForLLM.push({
        role: "system",
        content: `User device platform: ${clientPlatform}. When providing instructions to open local applications or run OS-specific steps, prefer commands and UI flows for ${clientPlatform}.`,
      });
    }

    if (chatSummary) {
      messagesForLLM.push({
        role: "system",
        content: `Active chat with ${chatSummary.contact.displayName} (externalId: ${chatSummary.contact.externalId}). Persona: ${chatSummary.contact.persona || "not set"}. Include recent messages as context.`,
      });

      try {
        const hist = await chatService.listMessages(userId, chatId, {
          take: 40,
        });
        const recent = hist.messages || [];
        for (const m of recent) {
          const role = m.direction === "outbound" ? "user" : "assistant";
          const content = buildMessageContentForLLM(m);
          messagesForLLM.push({ role, content });
        }
      } catch (e) {
        // ignore history errors
      }
    }

    const currentUserContent = buildLlmUserContent({
      body: assistantInput.body,
      mediaFile,
      providerName,
    });

    messagesForLLM.push({
      role: "user",
      content:
        currentUserContent ||
        llmUserMessage ||
        assistantInput.body ||
        "User sent an empty message.",
    });

    llmResp = await llmService.generate(userId, {
      providerId,
      messages: messagesForLLM,
    });
  } catch (err) {
    const fail = formatLlmErrorForUser(err);
    const assistantMsg = await chatService.storeIncomingMessage({
      userId,
      sessionId: null,
      sender: assistantSender,
      displayName: assistantDisplayName,
      body: fail,
    });
    io.to(`user:${userId}`).emit("new_message", assistantMsg.message);
    io.to(`user:${userId}`).emit("contact_list_update", assistantMsg.chat);
    return;
  }

  const text = String(llmResp?.text || "").trim();

  if (!text) {
    const assistantMsg = await chatService.storeIncomingMessage({
      userId,
      sessionId: null,
      sender: assistantSender,
      displayName: assistantDisplayName,
      body: "Model AI tidak mengembalikan isi respons. Silakan coba lagi.",
    });
    io.to(`user:${userId}`).emit("new_message", assistantMsg.message);
    io.to(`user:${userId}`).emit("contact_list_update", assistantMsg.chat);
    return;
  }

  const maybe = tryParseJsonObject(text);
  if (!maybe || !maybe.tool) {
    // plain reply
    const assistantMsg = await chatService.storeIncomingMessage({
      userId,
      sessionId: null,
      sender: assistantSender,
      displayName: assistantDisplayName,
      body: text,
    });
    io.to(`user:${userId}`).emit("new_message", assistantMsg.message);
    io.to(`user:${userId}`).emit("contact_list_update", assistantMsg.chat);
    return;
  }

  const toolName = String(maybe.tool || "");
  const args = maybe.args || {};

  if (!tools[toolName]) {
    const errMsg = `Requested tool not found: ${toolName}`;
    const assistantMsg = await chatService.storeIncomingMessage({
      userId,
      sessionId: null,
      sender: assistantSender,
      displayName: assistantDisplayName,
      body: errMsg,
    });
    io.to(`user:${userId}`).emit("new_message", assistantMsg.message);
    io.to(`user:${userId}`).emit("contact_list_update", assistantMsg.chat);
    return;
  }

  // Execute tool
  let toolResult;
  try {
    toolResult = await tools[toolName](userId, args, ctx);
  } catch (err) {
    const assistErr = `Tool error: ${err.message}`;
    const assistantMsg = await chatService.storeIncomingMessage({
      userId,
      sessionId: null,
      sender: assistantSender,
      displayName: assistantDisplayName,
      body: assistErr,
    });
    io.to(`user:${userId}`).emit("new_message", assistantMsg.message);
    io.to(`user:${userId}`).emit("contact_list_update", assistantMsg.chat);
    return;
  }

  const terminalCommand = getTerminalCommandForTool(toolName, args, toolResult);
  if (terminalCommand && toolResult?.id) {
    await storeAssistantTerminalMessage({
      userId,
      chatId,
      assistantSender,
      assistantDisplayName,
      command: terminalCommand,
      terminalId: toolResult.id,
      executed: !!toolResult.executed,
      io,
    });
    return;
  }

  // Let LLM summarize the tool result for the user
  let finalText = buildToolResultFallbackText(toolName, toolResult);
  try {
    const summaryResp = await llmService.generate(userId, {
      providerId,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `User requested: ${buildUserRequestSummaryText({ body: assistantInput.body, mediaFile })}`,
        },
        {
          role: "assistant",
          content: `Tool ${toolName} returned: ${JSON.stringify(toolResult)}`,
        },
        {
          role: "user",
          content:
            "Please produce a short, friendly summary for the user explaining what I did and any next steps.",
        },
      ],
    });

    if (summaryResp && summaryResp.text) {
      finalText = summaryResp.text;
    }
  } catch (e) {
    // ignore and fall back to default finalText
  }

  const assistantMsg = await chatService.storeIncomingMessage({
    userId,
    sessionId: null,
    sender: assistantSender,
    displayName: assistantDisplayName,
    body: finalText,
  });
  io.to(`user:${userId}`).emit("new_message", assistantMsg.message);
  io.to(`user:${userId}`).emit("contact_list_update", assistantMsg.chat);
}

module.exports = {
  handleAssistantMessage,
  readToolsFile,
  updateToolsFile,
  registerExternalTool,
  fetchAndRegisterTool,
  invokeRegisteredTool,
  __internal: {
    buildAssistantSystemPrompt,
    buildAssistantAttachmentInstruction,
    buildLlmUserContent,
    buildMessageContentForLLM,
    buildToolResultFallbackText,
    buildUserRequestSummaryText,
    buildVisionUserContent,
    formatLlmErrorForUser,
    getTerminalCommandForTool,
    isImageMediaFile,
    isVisionCapableProvider,
    normalizeAssistantInput,
    resolveMediaFilePath,
    resolveDirectAssistantToolCall,
    getClientPlatform,
  },
};
