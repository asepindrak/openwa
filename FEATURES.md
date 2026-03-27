# OpenWA Features

This document lists all features available in OpenWA, extracted from the API specification.

## Authentication
- Register new workspace account
- Login to existing account
- JWT bearer token authentication for dashboard users
- API key authentication for agents and external integrations

## Workspace
- Bootstrap endpoint for initial data load
- Load current user information
- Load list of sessions
- Load list of chats
- Load active chat ID
- Load initial messages for active chat

## Sessions (Multi-device Management)
- Create new WhatsApp session
- Connect/pair session with WhatsApp via QR code
- Disconnect/logout session
- List all sessions
- Session status tracking (pending, connected, disconnected, error)
- Phone number assignment
- QR code generation for mobile authentication

## Contacts
- Browse all contacts
- Search contacts by name, phone number, or message preview
- Open contact to start new chat
- Contact avatar support
- Unread message count per contact
- Last message preview
- Last message timestamp

## Chats
- Browse all chats (conversations)
- Search chats by contact name, title, or message content
- Open chat to view messages
- Chat ordering (most recent first)
- Contact information in chat
- Latest message preview in chat
- Chat status and timestamps

## Messages
- List messages in a chat
- Search messages within chat
- Send text messages
- Send media messages (images, videos, documents, audio)
- Reply to specific messages
- Forward messages to other chats
- Delete sent messages
- Message direction tracking (inbound/outbound)
- Message type support (text, image, video, document, audio, etc.)
- Message delivery status (sent, delivered, read)
- Message timestamps
- Sender and receiver information

## Media
- Multipart media file upload
- Media file storage with file paths
- Media association with messages via mediaFileId
- Support for images, videos, documents, audio files

## Runtime Documentation
- Swagger UI for interactive API exploration
- OpenAPI 3.1.0 specification JSON
- Agent-friendly README documentation
- Health check endpoint
- Version information endpoint
- Runtime metadata

## Real-time Updates
- Socket.IO connection for real-time message updates
- Typing indicators
- Online status
- Message delivery status updates
- Session status changes
- Chat updates
- Contact updates

## Additional Features
- Local-first architecture
- Self-hosted deployment
- CLI package format
- Next.js dashboard frontend
- Express API backend
- Prisma ORM with SQLite database
- Multi-user support
- Multi-session support per user
- Dark theme UI
- Search functionality across messages, chats, and contacts
- Message grouping (consecutive images)
- Reply preview with original message
- Media preview modal
- Emoji picker for message composition
- Settings management
- Logout functionality
