# TOOLS.md

This file documents tools and skills available to the OpenWA Assistant.

Purpose: provide a human-readable registry of available assistant tools and examples. The system may append entries here for externally-registered tools (append-only).

Default skills

- `add_device` — Create a new WhatsApp session/device for the user.
- `add_llm_provider` — Add an LLM provider (OpenAI / Anthropic / Ollama / OpenRouter).
- `update_assistant` — Change assistant display name, avatar, or persona.
- `create_api_key` — Generate an API key for the user.
- `update_webhook` — Set incoming webhook URL and key.
- `update_tools_md` — Append or update human-readable entries in this file when new external tools are registered.

Detailed examples for commonly-used tools

- `run_terminal` (run_terminal)

  Description: request execution of a shell command on the host. Supports `approvalMode` (`auto` | `manual`) and returns execution results when completed.

  Example request:

  ```json
  {
    "command": "npm run build",
    "approvalMode": "manual",
    "cwd": "workspaces/my-project",
    "timeout": 120000
  }
  ```

  Example response:

  ```json
  {
    "id": "term_abc123",
    "status": "done",
    "stdout": "Build succeeded...",
    "stderr": "",
    "exitCode": 0,
    "startedAt": "2026-03-31T12:00:00Z",
    "finishedAt": "2026-03-31T12:00:10Z"
  }
  ```

  Notes:
  - Auto-execution requires configuration of `OPENWA_TERMINAL_ALLOWLIST` on the host.
  - Prefer `manual` approval for destructive or network-facing commands.

- `search_messages` (search_messages)

  Description: search messages and attachments in the user's message database.

  Example request:

  ```json
  { "q": "invoice", "chatId": "12345@c.us", "limit": 20 }
  ```

  Example response (truncated):

  ```json
  { "results": [{ "id": "m1", "chatId": "12345@c.us", "text": "Invoice attached", "media": [...] } ] }
  ```

- `run_copilot` (run_copilot)

  Description: run the local `copilot` CLI with a short prompt. Returns captured stdout/stderr and exit code.

  Example request:

  ```json
  { "prompt": "create api route nextjs create order" }
  ```

  Example response:

  ```json
  { "exitCode": 0, "stdout": "Created pages/api/orders.js", "stderr": "" }
  ```

  Notes:
  - `copilot` must be installed on the host.
  - The `copilot` command is executed inside the `workspaces/` folder at the project root; place projects you want Copilot to edit under `workspaces/` first.

- Coding capabilities

  The assistant can act as a coding agent: create/modify files, scaffold routes, run linters/tests, and run CLI tools. Use coding tools responsibly and prefer manual approval for potentially destructive operations.

Auto-registered tools

When external tools are registered via the API (for example `POST /api/agent/register-tool-url`), the system appends a human-readable entry below. Appended entries follow this simple pattern:

```
### Tool: <Name> (<id>)
<short description>

Docs: <url>
Invoke: <http base | none>
```

Security / Admin

- `OPENWA_TERMINAL_ALLOWLIST`: when set, only commands matching the allowlist are eligible for auto-execution.
- `approvalMode`: `auto` vs `manual`. Manual-mode terminal requests require human approval via the dashboard/UI.
- `invokeEnabled`: per-tool flag that controls if non-owner users may call a registered tool. By default, only the registering user (`addedBy`) may invoke the tool unless an admin enables `invokeEnabled`.
- Registration and review: use the dashboard or admin endpoints to register external tools, review their `docs`, and verify required auth (API keys) before allowing invocation.
- Best practices: require explicit admin approval for tools that perform state changes or network calls; keep invocation logs and audit trails.

If you want, I can also add a minimal frontend form to register a tool from a URL (calls `/api/agent/register-tool-url`) and a dashboard to toggle `invokeEnabled` for each tool.

Quick curl examples

- Register a tool by manifest URL (dashboard/admin only — requires a dashboard JWT):

```bash
curl -X POST 'http://localhost:3000/api/agent/register-tool-url' \
  -H 'Authorization: Bearer <DASHBOARD_JWT>' \
  -H 'Content-Type: application/json' \
  -d '{
    "url": "https://example.com/manifest.json",
    "apiKey": "<MANIFEST_API_KEY>",
    "headerName": "Authorization",
    "overwrite": true
  }'
```

Replace `http://localhost:3000` with your OpenWA server host and port.

- Invoke a registered tool (authenticated — user JWT or API key allowed):

Using user JWT:

```bash
curl -X POST 'http://localhost:3000/api/agent/invoke-tool/<tool_id>' \
  -H 'Authorization: Bearer <USER_JWT>' \
  -H 'Content-Type: application/json' \
  -d '{
    "method": "GET",
    "path": "/hello"
  }'
```

Using API key (header `X-API-Key` or `X-OpenWA-API-Key`):

```bash
curl -X POST 'http://localhost:3000/api/agent/invoke-tool/<tool_id>' \
  -H 'X-API-Key: <API_KEY>' \
  -H 'Content-Type: application/json' \
  -d '{
    "method": "POST",
    "path": "/echo",
    "body": { "msg": "ping" }
  }'
```

Notes:

- Replace `<tool_id>`, `<USER_JWT>`, `<API_KEY>`, and host as appropriate.
- For dashboard actions (register), use a valid dashboard JWT (dashboard-only middleware). For regular invocations, either a user JWT or an API key is accepted.
