<p align="center">
  <img src="./logo-long.png" alt="OpenWA" width="320" />
</p>

# OpenWA

OpenWA is a self-hosted WhatsApp workspace that ships as a CLI package. It combines a Next.js dashboard, an Express API, Prisma-backed data access, Socket.IO realtime updates, media uploads, and runtime API documentation in a single local-first package.

OpenWA is also designed to be **AI-agent-ready**. The runtime exposes agent-friendly documentation, machine-readable OpenAPI output, and API key authentication so AI agents and automation tools can discover capabilities and interact with the workspace without reverse-engineering the app.

## Disclaimer

OpenWA is an independent open source project. It is **not** an official WhatsApp product and is **not** affiliated with, endorsed by, or sponsored by Meta or WhatsApp.

If you use OpenWA with WhatsApp, make sure your usage complies with the terms, policies, and legal requirements that apply in your environment.

## Features

- Dashboard authentication for register, login, and workspace access.
- Workspace bootstrap endpoint for loading the current user, sessions, chats, active chat, and initial messages.
- Multi-session WhatsApp management with session creation, connect, disconnect, and QR pairing.
- Contact and chat browsing with search and chat opening from contacts.
- Message APIs for listing, searching, sending, forwarding, and deleting messages.
- Multipart media upload flow with `mediaFileId` support for outbound media messages.
- Runtime docs endpoints for Swagger UI, OpenAPI JSON, agent README, health checks, and version metadata.
- Dual authentication model:
  - JWT bearer auth for dashboard users.
  - API key auth for agents and external integrations.

## Tech stack

- Node.js 20+
- Next.js 15
- React 19
- Express
- Prisma
- Socket.IO
- `whatsapp-web.js`

## Acknowledgements

Special thanks to [`whatsapp-web.js`](https://wwebjs.dev/). OpenWA builds on top of that excellent open source project for WhatsApp Web integration.

If you find this project useful, please also support and star the `whatsapp-web.js` project.

## Getting started

Install OpenWA globally:

```bash
npm i -g @adens/openwa
```

Run OpenWA:

```bash
openwa
```

When OpenWA starts, it launches the local frontend and backend runtime and automatically opens your browser to the OpenWA frontend dashboard by default.

If you are working on this repository locally instead of using the published CLI package:

```bash
npm install
npm run build
npm start
```

## Default runtime

By default, OpenWA starts two local services:

- Frontend dashboard: `http://localhost:55111`
- Backend API: `http://localhost:55222`

Important runtime endpoints such as docs, health, and version are also proxied through the frontend URL for convenience.

## Environment configuration

OpenWA reads `.env` from the repository root. These are the runtime variables currently used by the app:

```env
HOST=127.0.0.1
FE_PORT=55111
BE_PORT=55222
OPENWA_FRONTEND_URL=http://localhost:55111
OPENWA_BACKEND_URL=http://localhost:55222
OPENWA_JWT_SECRET=openwa-local-dev-secret
OPENWA_AUTO_OPEN=true
OPENWA_USE_WWEBJS=true
OPENWA_ALLOW_MOCK=false
```

Notes:

- Set `OPENWA_AUTO_OPEN=false` to disable automatic browser opening.
- Set `OPENWA_USE_WWEBJS=false` to disable the WhatsApp Web adapter.
- Set `OPENWA_ALLOW_MOCK=true` to allow the mock adapter when needed.

## Typical usage flow

1. Start OpenWA.
2. Open the dashboard at `http://localhost:55111`.
3. Register the first user or log in.
4. Create a new WhatsApp session from the dashboard.
5. Connect the session to generate a QR code.
6. Pair the device and wait for the workspace to sync chats and contacts.
7. Send text or media from the dashboard or the HTTP API.
8. Create an API key from **Settings → API Access** for agents or external integrations.

## Runtime documentation

OpenWA exposes runtime documentation directly from the app:

- Swagger UI: `GET /docs`
- OpenAPI JSON: `GET /docs/json`
- Agent guide markdown: `GET /docs/readme`
- Health check: `GET /health`
- Version: `GET /version`
- Backend health alias: `GET /api/health`

If you are building an agent or automation client, prefer the frontend URL as the base URL because the main runtime metadata endpoints are already proxied there.

This makes OpenWA a strong fit for AI agents: an agent can read `/docs/readme`, fetch `/docs/json`, authenticate with an API key, and immediately start working with chats, contacts, sessions, and messages through a documented API surface.

## API summary

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

These endpoints are intended for dashboard users. External agents that already have an API key normally do not need to use dashboard login flows.

### API keys

- `GET /api/api-keys`
- `POST /api/api-keys`
- `DELETE /api/api-keys/{apiKeyId}`

API key management requires dashboard JWT authentication.

### Workspace

- `GET /api/bootstrap`

Returns the initial workspace payload, including the current user, sessions, chats, active chat, initial message batch, and pagination metadata.

### Sessions

- `GET /api/sessions`
- `POST /api/sessions`
- `POST /api/sessions/{sessionId}/connect`
- `POST /api/sessions/{sessionId}/disconnect`

### Chats and contacts

- `GET /api/chats`
- `GET /api/contacts`
- `POST /api/contacts/{contactId}/open`

`/api/chats` and `/api/contacts` support `sessionId` and `q` query filters.

### Messages

- `GET /api/chats/{chatId}/messages`
- `POST /api/chats/{chatId}/messages/send`
- `DELETE /api/messages/{messageId}`
- `POST /api/messages/{messageId}/forward`

`GET /api/chats/{chatId}/messages` supports:

- `take`
- `before`
- `search`

### Media

- `POST /api/media`

Upload a file first, then use the returned `mediaFileId` when calling the send message endpoint.

## API authentication

OpenWA supports two main authentication modes.

### JWT bearer

```http
Authorization: Bearer <jwt-token>
```

Used by the dashboard after login or registration.

### API key

```http
X-API-Key: <api-key>
```

or:

```http
Authorization: Bearer <api-key>
```

Recommended for agents, automation, and external integrations.

## API examples

List chats:

```bash
curl -H "X-API-Key: <api-key>" http://localhost:55111/api/chats
```

Read messages for a chat:

```bash
curl -H "X-API-Key: <api-key>" http://localhost:55111/api/chats/<chatId>/messages
```

Send a text message:

```bash
curl -X POST http://localhost:55111/api/chats/<chatId>/messages/send \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <api-key>" \
  -d "{\"body\":\"Hello from OpenWA\",\"type\":\"text\"}"
```

Upload media:

```bash
curl -X POST http://localhost:55111/api/media \
  -H "X-API-Key: <api-key>" \
  -F "file=@./example.png"
```

## Project structure

- `bin/` - CLI entrypoint
- `server/` - backend runtime, OpenAPI docs, auth, sessions, chats, media, and sockets
- `web/` - Next.js dashboard
- `prisma/` - database schema
- `storage/` - runtime storage and generated files

## Development

For repository-based local development:

1. Install dependencies with `npm install`.
2. Configure `.env` if you need non-default ports or runtime behavior.
3. Run `npm run dev` for development mode.
4. Run `npm run build` before shipping production changes.

If you are working on API-facing features, validate them against:

- `server/express/openapi.js`
- `/docs`
- `/docs/json`
- `/docs/readme`

## Contributing

Contributions are welcome.

If you want to contribute:

1. Fork the repository.
2. Create a feature branch.
3. Make focused changes.
4. Test your changes locally.
5. Open a pull request with a clear description of what changed and why.

Good contribution areas include:

- WhatsApp session reliability
- Dashboard UX
- API ergonomics
- Documentation improvements
- Tests and validation
- Developer experience

## Issues and bug reports

If you find a bug or want to request a feature, please open an issue with:

- what you expected
- what happened
- steps to reproduce
- logs or screenshots if relevant
- environment details such as Node.js version and runtime mode

## Security and responsible use

Please do not use this project for spam, abuse, or policy-violating automation.

If you discover a security issue, report it responsibly and avoid posting sensitive details publicly before maintainers have a chance to assess it.

## License

This project is released under the MIT license. See `package.json` for the current license declaration.

## For agents and integrations

Recommended call order:

1. `GET /health`
2. `GET /version`
3. `GET /docs/json`
4. `GET /api/chats` or `GET /api/contacts`
5. `POST /api/contacts/{contactId}/open`
6. `GET /api/chats/{chatId}/messages`
7. `POST /api/chats/{chatId}/messages/send`

## If you need an agent-oriented markdown guide directly from the runtime, use `GET /docs/readme`.

---
