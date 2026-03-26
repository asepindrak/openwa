const { prisma } = require("../database/client");

async function retryOnSqliteTimeout(operation) {
  try {
    return await operation();
  } catch (error) {
    if (error?.code !== "P1008") {
      throw error;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
    return operation();
  }
}

async function listUserSessions(userId) {
  return prisma.whatsappSession.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" }
  });
}

async function createUserSession(userId, { name, phoneNumber }) {
  if (!name) {
    throw new Error("Session name is required.");
  }

  return prisma.whatsappSession.create({
    data: {
      userId,
      name: String(name).trim(),
      phoneNumber: phoneNumber ? String(phoneNumber).trim() : null,
      status: "disconnected",
      transportType: "wwebjs"
    }
  });
}

async function getSessionById(userId, sessionId) {
  return prisma.whatsappSession.findFirst({
    where: {
      id: sessionId,
      userId
    }
  });
}

async function listReconnectableSessions() {
  return prisma.whatsappSession.findMany({
    where: {
      status: {
        in: ["ready", "connecting"]
      }
    }
  });
}

async function touchSessionState(sessionId, data) {
  return retryOnSqliteTimeout(() =>
    prisma.whatsappSession.update({
      where: { id: sessionId },
      data
    })
  );
}

module.exports = {
  createUserSession,
  getSessionById,
  listReconnectableSessions,
  listUserSessions,
  touchSessionState
};
