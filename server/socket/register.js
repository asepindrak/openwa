const { getUserFromToken } = require("../services/auth-service");
const chatService = require("../services/chat-service");

function userRoom(userId) {
  return `user:${userId}`;
}

function registerSocketHandlers({ io, config, sessionManager }) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const user = await getUserFromToken(token, config);

      if (!user) {
        return next(new Error("Unauthorized"));
      }

      socket.user = user;
      return next();
    } catch (error) {
      return next(error);
    }
  });

  io.on("connection", (socket) => {
    socket.join(userRoom(socket.user.id));

    socket.on("send_message", async (payload = {}, ack) => {
      try {
        // If this is an assistant chat, route to agent service
        const agentService = require("../services/agent-service");
        const chat = await chatService.getChatWithContact(
          socket.user.id,
          payload.chatId,
        );
        const externalId = chat?.contact?.externalId || null;

        if (
          externalId &&
          (externalId === "openwa:assistant" ||
            String(externalId).endsWith(":assistant"))
        ) {
          // store outgoing message and let agent handle reply
          await agentService.handleAssistantMessage(
            socket.user.id,
            payload.chatId,
            payload.body,
            { config, io, socket, sessionManager },
          );
          if (ack) ack({ ok: true });
        } else {
          const result = await chatService.createOutgoingMessage({
            userId: socket.user.id,
            chatId: payload.chatId,
            body: payload.body,
            type: payload.type || "text",
            mediaFileId: payload.mediaFileId || null,
            replyToId: payload.replyToId || null,
          });

          io.to(userRoom(socket.user.id)).emit("new_message", result.message);
          io.to(userRoom(socket.user.id)).emit(
            "contact_list_update",
            result.chat,
          );

          if (result.message.sessionId) {
            await sessionManager.sendMessage(result.message.sessionId, {
              recipient: result.message.receiver,
              body: result.message.body,
              mediaFileId: result.message.mediaFileId,
              mediaPath: result.message.mediaFile?.relativePath || null,
            });

            await chatService.addMessageStatus(result.message.id, "delivered");
            io.to(userRoom(socket.user.id)).emit("message_status_update", {
              messageId: result.message.id,
              status: "delivered",
            });
          }

          if (ack) {
            ack({ ok: true, message: result.message });
          }
        }
      } catch (error) {
        if (ack) {
          ack({ ok: false, error: error.message });
        }
      }
    });

    socket.on("send_media", async (payload = {}, ack) => {
      try {
        const result = await chatService.createOutgoingMessage({
          userId: socket.user.id,
          chatId: payload.chatId,
          body: payload.body,
          type: payload.type || "document",
          mediaFileId: payload.mediaFileId,
          replyToId: payload.replyToId || null,
        });

        io.to(userRoom(socket.user.id)).emit("new_message", result.message);
        io.to(userRoom(socket.user.id)).emit(
          "contact_list_update",
          result.chat,
        );

        if (result.message.sessionId) {
          await sessionManager.sendMessage(result.message.sessionId, {
            recipient: result.message.receiver,
            body: result.message.body,
            mediaFileId: result.message.mediaFileId,
            mediaPath: result.message.mediaFile?.relativePath || null,
          });
        }

        if (ack) {
          ack({ ok: true, message: result.message });
        }
      } catch (error) {
        if (ack) {
          ack({ ok: false, error: error.message });
        }
      }
    });

    socket.on("typing", (payload = {}) => {
      io.to(userRoom(socket.user.id)).emit("typing_event", {
        chatId: payload.chatId,
        isTyping: Boolean(payload.isTyping),
        userId: socket.user.id,
        name: socket.user.name,
      });
    });

    socket.on("open_chat", async (payload = {}, ack) => {
      try {
        await chatService.markChatOpened(socket.user.id, payload.chatId);
        if (ack) {
          ack({ ok: true });
        }
      } catch (error) {
        if (ack) {
          ack({ ok: false, error: error.message });
        }
      }
    });
  });
}

module.exports = {
  registerSocketHandlers,
  userRoom,
};
