const path = require("path");
const { rootDir } = require("../utils/paths");

const packageJson = require(path.join(rootDir, "package.json"));

function createOpenApiDocument(config) {
  return {
    openapi: "3.1.0",
    info: {
      title: "OpenWA API",
      version: packageJson.version,
      description:
        "HTTP API for the local OpenWA runtime, including auth, sessions, chats, contacts, messaging, and runtime metadata. For AI agents, fetch `/docs/readme` first, then authenticate with `X-API-Key` and use the HTTP endpoints directly.",
    },
    servers: [
      {
        url: config.frontendUrl,
        description:
          "Frontend-facing URL with proxied docs/health/version endpoints",
      },
      { url: config.backendUrl, description: "Direct backend API URL" },
    ],
    tags: [
      { name: "Runtime" },
      { name: "Webhooks" },
      { name: "Auth" },
      { name: "Workspace" },
      { name: "Sessions" },
      { name: "Chats" },
      { name: "Contacts" },
      { name: "Messages" },
      { name: "Media" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
        apiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "X-API-Key",
        },
      },
      schemas: {
        ErrorResponse: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
          required: ["error"],
        },
        WebhookConfig: {
          type: "object",
          properties: {
            url: { type: "string", format: "uri" },
            apiKey: { type: "string" },
          },
        },
        WebhookPayload: {
          type: "object",
          description:
            "Payload delivered to configured webhooks for incoming messages",
          properties: {
            chat: { $ref: "#/components/schemas/Chat" },
            message: { $ref: "#/components/schemas/Message" },
          },
        },
        WebhookResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean" },
            webhook: { $ref: "#/components/schemas/WebhookConfig" },
          },
        },
        User: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            email: { type: "string", format: "email" },
            createdAt: { type: "string", format: "date-time" },
          },
          required: ["id", "name", "email", "createdAt"],
        },
        AuthResponse: {
          type: "object",
          properties: {
            token: { type: "string" },
            user: { $ref: "#/components/schemas/User" },
          },
          required: ["token", "user"],
        },
        Session: {
          type: "object",
          properties: {
            id: { type: "string" },
            userId: { type: "string" },
            name: { type: "string" },
            phoneNumber: { type: ["string", "null"] },
            status: { type: "string" },
            transportType: { type: ["string", "null"] },
            qrCode: { type: ["string", "null"] },
            errorMessage: { type: ["string", "null"] },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Contact: {
          type: "object",
          properties: {
            id: { type: "string" },
            externalId: { type: "string" },
            displayName: { type: "string" },
            avatarUrl: { type: ["string", "null"] },
            lastMessagePreview: { type: ["string", "null"] },
            lastMessageAt: { type: ["string", "null"], format: "date-time" },
            unreadCount: { type: "integer" },
            sessionId: { type: ["string", "null"] },
            hasChat: { type: "boolean" },
          },
        },
        MediaFile: {
          type: "object",
          properties: {
            id: { type: "string" },
            originalName: { type: "string" },
            mimeType: { type: "string" },
            relativePath: { type: "string" },
          },
        },
        MessageStatus: {
          type: "object",
          properties: {
            status: { type: "string" },
          },
        },
        Message: {
          type: "object",
          properties: {
            id: { type: "string" },
            chatId: { type: "string" },
            sessionId: { type: ["string", "null"] },
            sender: { type: "string" },
            receiver: { type: "string" },
            body: { type: ["string", "null"] },
            type: { type: "string" },
            direction: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
            mediaFile: {
              anyOf: [
                { $ref: "#/components/schemas/MediaFile" },
                { type: "null" },
              ],
            },
            statuses: {
              type: "array",
              items: { $ref: "#/components/schemas/MessageStatus" },
            },
          },
        },
        Chat: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: ["string", "null"] },
            sessionId: { type: ["string", "null"] },
            contact: { $ref: "#/components/schemas/Contact" },
            lastMessage: {
              anyOf: [
                { $ref: "#/components/schemas/Message" },
                { type: "null" },
              ],
            },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
      },
    },
    paths: {
      "/health": {
        get: {
          tags: ["Runtime"],
          summary: "Health check",
          responses: {
            200: {
              description: "Runtime health status",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      service: { type: "string" },
                      version: { type: "string" },
                    },
                    required: ["ok", "service", "version"],
                  },
                },
              },
            },
          },
        },
      },
      "/version": {
        get: {
          tags: ["Runtime"],
          summary: "Get API version",
          responses: {
            "/api/webhook": {
              get: {
                tags: ["Webhooks"],
                summary: "Get current webhook configuration",
                description:
                  "Return the configured webhook for the authenticated user. Agents should use API keys to authenticate.",
                operationId: "getWebhook",
                security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
                responses: {
                  200: {
                    description: "Webhook configuration",
                    content: {
                      "application/json": {
                        schema: {
                          $ref: "#/components/schemas/WebhookResponse",
                        },
                      },
                    },
                  },
                },
                "x-ai-agent-ready": true,
              },
              post: {
                tags: ["Webhooks"],
                summary: "Set or update webhook configuration",
                description:
                  "Configure an endpoint to receive incoming messages. The runtime will POST a JSON payload and include header `x-openwa-webhook-key` with the apiKey value.",
                operationId: "setWebhook",
                security: [{ bearerAuth: [] }],
                requestBody: {
                  required: true,
                  content: {
                    "application/json": {
                      schema: { $ref: "#/components/schemas/WebhookConfig" },
                      examples: {
                        webhook: {
                          summary: "Webhook example",
                          value: {
                            url: "https://example.com/openwa-webhook",
                            apiKey: "S3CR3T",
                          },
                        },
                      },
                    },
                  },
                },
                responses: {
                  200: {
                    description: "Saved webhook",
                    content: {
                      "application/json": {
                        schema: {
                          $ref: "#/components/schemas/WebhookResponse",
                        },
                      },
                    },
                  },
                },
                "x-ai-agent-ready": true,
              },
              delete: {
                tags: ["Webhooks"],
                summary: "Remove webhook configuration",
                operationId: "deleteWebhook",
                security: [{ bearerAuth: [] }],
                responses: {
                  200: { description: "Deleted" },
                },
                "x-ai-agent-ready": true,
              },
            },
            200: {
              description: "Package version",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      version: { type: "string" },
                    },
                    required: ["name", "version"],
                  },
                },
              },
            },
          },
        },
      },
      "/docs/json": {
        get: {
          tags: ["Runtime"],
          summary: "Get OpenAPI document",
          responses: {
            200: {
              description: "OpenAPI JSON document",
            },
          },
        },
      },
      "/docs/readme": {
        get: {
          tags: ["Runtime"],
          summary: "Get agent-friendly API usage guide",
          responses: {
            200: {
              description: "Markdown guide for AI agents and external clients",
            },
          },
        },
      },
      "/api/health": {
        get: {
          tags: ["Runtime"],
          summary: "Backend health alias",
          responses: {
            200: {
              description: "Backend health status",
            },
          },
        },
      },
      "/api/auth/register": {
        post: {
          tags: ["Auth"],
          summary: "Register a user",
          description:
            "Dashboard-oriented auth. External agents should normally use an API key instead of calling register.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    email: { type: "string", format: "email" },
                    password: { type: "string" },
                  },
                  required: ["name", "email", "password"],
                },
              },
            },
          },
          responses: {
            201: {
              description: "User registered",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AuthResponse" },
                },
              },
            },
            400: {
              description: "Validation error",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/api/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Login a user",
          description:
            "Dashboard-oriented auth. External agents normally do not need this when an API key is already provided.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    email: { type: "string", format: "email" },
                    password: { type: "string" },
                  },
                  required: ["email", "password"],
                },
              },
            },
          },
          responses: {
            200: {
              description: "User logged in",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AuthResponse" },
                },
              },
            },
            400: {
              description: "Invalid credentials",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/api/auth/me": {
        get: {
          tags: ["Auth"],
          summary: "Get authenticated user",
          security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
          responses: {
            200: {
              description: "Current user",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      user: { $ref: "#/components/schemas/User" },
                    },
                    required: ["user"],
                  },
                },
              },
            },
            401: {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/api/api-keys": {
        get: {
          tags: ["Auth"],
          summary: "List API keys for the current user",
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: "API key list",
            },
          },
        },
        post: {
          tags: ["Auth"],
          summary: "Create an API key",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                  },
                  required: ["name"],
                },
              },
            },
          },
          responses: {
            201: {
              description: "Created API key",
            },
          },
        },
      },
      "/api/api-keys/{apiKeyId}": {
        delete: {
          tags: ["Auth"],
          summary: "Revoke an API key",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "apiKeyId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Revoked API key",
            },
          },
        },
      },
      "/api/bootstrap": {
        get: {
          tags: ["Workspace"],
          summary: "Load initial workspace payload",
          security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
          responses: {
            200: {
              description: "Workspace bootstrap",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      user: { $ref: "#/components/schemas/User" },
                      sessions: {
                        type: "array",
                        items: { $ref: "#/components/schemas/Session" },
                      },
                      chats: {
                        type: "array",
                        items: { $ref: "#/components/schemas/Chat" },
                      },
                      activeChatId: { type: ["string", "null"] },
                      messages: {
                        type: "array",
                        items: { $ref: "#/components/schemas/Message" },
                      },
                      hasMoreMessages: { type: "boolean" },
                      nextBefore: { type: ["string", "null"] },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/sessions": {
        get: {
          tags: ["Sessions"],
          summary: "List WhatsApp sessions",
          security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
          responses: {
            200: {
              description: "Session list",
            },
          },
        },
        post: {
          tags: ["Sessions"],
          summary: "Create a WhatsApp session",
          security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    phoneNumber: { type: "string" },
                  },
                  required: ["name"],
                },
              },
            },
          },
          responses: {
            201: {
              description: "Created session",
            },
          },
        },
      },
      "/api/sessions/{sessionId}/connect": {
        post: {
          tags: ["Sessions"],
          summary: "Connect a WhatsApp session",
          security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
          parameters: [
            {
              name: "sessionId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Updated session",
            },
          },
        },
      },
      "/api/sessions/{sessionId}/disconnect": {
        post: {
          tags: ["Sessions"],
          summary: "Disconnect a WhatsApp session",
          security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
          parameters: [
            {
              name: "sessionId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Updated session",
            },
          },
        },
      },
      "/api/chats": {
        get: {
          tags: ["Chats"],
          summary: "List chats",
          security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
          parameters: [
            {
              name: "sessionId",
              in: "query",
              required: false,
              schema: { type: "string" },
            },
            {
              name: "q",
              in: "query",
              required: false,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Chat list",
            },
          },
        },
      },
      "/api/contacts": {
        get: {
          tags: ["Contacts"],
          summary: "List contacts",
          security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
          parameters: [
            {
              name: "sessionId",
              in: "query",
              required: false,
              schema: { type: "string" },
            },
            {
              name: "q",
              in: "query",
              required: false,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Contact list",
            },
          },
        },
      },
      "/api/contacts/{contactId}/open": {
        post: {
          tags: ["Contacts"],
          summary: "Open or create a chat for a contact",
          security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
          parameters: [
            {
              name: "contactId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Opened chat",
            },
          },
        },
      },
      "/api/chats/{chatId}/messages": {
        get: {
          tags: ["Messages"],
          summary: "List messages for a chat",
          security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
          parameters: [
            {
              name: "chatId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "take",
              in: "query",
              required: false,
              schema: { type: "integer" },
            },
            {
              name: "before",
              in: "query",
              required: false,
              schema: { type: "string", format: "date-time" },
            },
            {
              name: "search",
              in: "query",
              required: false,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Messages payload",
            },
          },
        },
      },
      "/api/chats/{chatId}/messages/send": {
        post: {
          tags: ["Messages"],
          summary: "Send a message over HTTP",
          description:
            "Preferred for AI agents and external clients that do not use Socket.IO. Supports text messages directly and media messages via an uploaded `mediaFileId`.",
          security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
          parameters: [
            {
              name: "chatId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    body: { type: "string" },
                    type: {
                      type: "string",
                      enum: [
                        "text",
                        "image",
                        "video",
                        "audio",
                        "document",
                        "sticker",
                      ],
                    },
                    mediaFileId: { type: "string" },
                    replyToId: { type: "string" },
                  },
                },
                examples: {
                  textMessage: {
                    summary: "Send a text message",
                    value: {
                      body: "Halo dari agent",
                      type: "text",
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: "Sent message payload",
            },
          },
        },
      },
      "/api/messages/send": {
        post: {
          tags: ["Messages"],
          summary: "Send a message directly to a WhatsApp number or chat",
          description:
            "Send a WhatsApp message using either an existing chatId or a direct phoneNumber. If the chat does not exist yet, the runtime will open a chat for the given WhatsApp number.",
          security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["sessionId"],
                  properties: {
                    chatId: { type: "string" },
                    phoneNumber: { type: "string" },
                    sessionId: {
                      type: "string",
                      description:
                        "Required WhatsApp sessionId used to choose which connected device sends the message.",
                    },
                    displayName: { type: "string" },
                    body: { type: "string" },
                    type: {
                      type: "string",
                      enum: [
                        "text",
                        "image",
                        "video",
                        "audio",
                        "document",
                        "sticker",
                      ],
                    },
                    mediaFileId: { type: "string" },
                    mediaUrl: { type: "string", format: "uri" },
                    replyToId: { type: "string" },
                  },
                },
                examples: {
                  directTextMessage: {
                    summary: "Send a text message by phone number",
                    value: {
                      phoneNumber: "+6281234567890",
                      sessionId: "session-id-abc123",
                      body: "Halo, ini follow up customer",
                      type: "text",
                    },
                  },
                  directMediaMessage: {
                    summary: "Send a media message by URL",
                    value: {
                      phoneNumber: "+6281234567890",
                      sessionId: "session-id-abc123",
                      mediaUrl: "https://example.com/image.jpg",
                      type: "image",
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: "Sent message payload",
            },
          },
        },
      },
      "/api/messages/{messageId}": {
        delete: {
          tags: ["Messages"],
          summary: "Delete a message",
          security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
          parameters: [
            {
              name: "messageId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Delete result",
            },
          },
        },
      },
      "/api/messages/{messageId}/forward": {
        post: {
          tags: ["Messages"],
          summary: "Forward a message",
          security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
          parameters: [
            {
              name: "messageId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    targetChatId: { type: "string" },
                  },
                  required: ["targetChatId"],
                },
              },
            },
          },
          responses: {
            200: {
              description: "Forward result",
            },
          },
        },
      },
      "/api/media": {
        post: {
          tags: ["Media"],
          summary: "Upload media",
          security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  properties: {
                    file: {
                      type: "string",
                      format: "binary",
                    },
                  },
                  required: ["file"],
                },
              },
            },
          },
          responses: {
            201: {
              description: "Uploaded media metadata",
            },
          },
        },
      },
    },
  };
}

function createSwaggerHtml() {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>OpenWA API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: #f4f5f7;
        color: #1f2937;
      }

      #swagger-ui {
        min-height: 100vh;
      }

      .swagger-ui .topbar {
        display: none;
      }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: "/docs/json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        displayRequestDuration: true,
        presets: [SwaggerUIBundle.presets.apis]
      });
    </script>
  </body>
</html>`;
}

function createAgentReadme(config, apiKeySecret) {
  const keyBlock = apiKeySecret
    ? `

## API Key (auto-generated)

Use this API key for agent requests:

\`X-API-Key: ${apiKeySecret}\`

or

\`Authorization: Bearer ${apiKeySecret}\`
`
    : "";

  return `# OpenWA Agent Guide

Recommended base URL for agents:

- ${config.frontendUrl}

Use the frontend URL because docs and runtime metadata endpoints are already proxied to the backend.

## Authentication

Use either of these headers:

\`\`\`
X-API-Key: <api-key>
\`\`\`

or

\`\`\`
Authorization: Bearer <api-key>
\`\`\`

Agents do **not** need to log in through dashboard auth endpoints as long as they already have an API key.

${keyBlock}

## Quick start

1. Check runtime availability:
  - \`GET /health\`
  - \`GET /version\`
2. Fetch the machine-readable specification:
  - \`GET /docs/json\`
3. List and manage WhatsApp sessions:
  - \`GET /api/sessions\`
  - \`POST /api/sessions\`
  - \`POST /api/sessions/:sessionId/connect\`
  - \`POST /api/sessions/:sessionId/disconnect\`
4. Read chats and contacts:
  - \`GET /api/chats\`
  - \`GET /api/contacts\`
5. Open or create a chat from a contact:
  - \`POST /api/contacts/:contactId/open\`
6. Read or search messages:
  - \`GET /api/chats/:chatId/messages\`
  - \`GET /api/chats/:chatId/messages?search=keyword\`
7. Send a message:
  - \`POST /api/chats/:chatId/messages/send\`
  - \`POST /api/messages/send\` — send directly by \`phoneNumber\`, including \`mediaUrl\` or \`mediaFileId\` for media messages

> \`sessionId\` is required for all send requests.

### Example payloads

Send a text message to an existing chat:
\`\`\`json
{
  "sessionId": "<sessionId>",
  "chatId": "<chatId>",
  "body": "Halo, ini follow up customer",
  "type": "text"
}
\`\`\`

Send a direct message by phone number:
\`\`\`json
{
  "sessionId": "<sessionId>",
  "phoneNumber": "+6281234567890",
  "body": "Halo, ini follow up customer",
  "type": "text"
}
\`\`\`

Media message by URL:
\`\`\`json
{
  "sessionId": "<sessionId>",
  "phoneNumber": "+6281234567890",
  "mediaUrl": "https://example.com/image.jpg",
  "type": "image"
}
\`\`\`

8. Configure webhooks (optional)
  - \`GET /api/webhook\` — read current webhook configuration
  - \`POST /api/webhook\` — set webhook { "url": "https://...", "apiKey": "..." }
  - \`DELETE /api/webhook\` — remove the webhook

When an incoming message arrives the runtime will \`POST\` a JSON payload to your configured URL with header \`x-openwa-webhook-key\` set to the \`apiKey\` you provided. The payload contains \`chat\` and \`message\` objects described in the OpenAPI schemas.

## Important notes

 - \`/api/auth/register\` and \`/api/auth/login\` are meant for dashboard or human login flows, not the normal agent flow.
 - API keys are created from the OpenWA dashboard under **Settings → API Access**.
 - For media messages, upload the file to \`POST /api/media\` first, then send the returned \`mediaFileId\` through the HTTP send message endpoint.
 - Main business endpoints accept JWT **or** API key authentication, but API key management endpoints only accept dashboard JWT authentication.
`;
}
module.exports = {
  createOpenApiDocument,
  createAgentReadme,
  createSwaggerHtml,
  packageVersion: packageJson.version,
  packageName: packageJson.name,
};
