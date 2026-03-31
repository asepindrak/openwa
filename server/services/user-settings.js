const { prisma } = require("../database/client");

// In-memory fallback cache used when the DB table isn't available
// (e.g. before migrations have been applied) or when transient errors occur.
const inMemory = new Map();

async function getSetting(userId, key) {
  if (!userId) return undefined;
  const id = String(userId);

  // Try DB first. If the DB/table is not available, fall back to in-memory.
  try {
    if (prisma && prisma.userSetting) {
      const rec = await prisma.userSetting.findUnique({
        where: { userId: id },
      });
      if (rec) {
        if (key === "autoApproveAllTerminalCommands")
          return rec.autoApproveAllTerminalCommands;
        if (key === "defaultAiProviderId") return rec.defaultAiProviderId;
        if (key === "defaultAiModel") return rec.defaultAiModel;
        return undefined;
      }
    }
  } catch (e) {
    // ignore DB errors and fall back to in-memory
  }

  const current = inMemory.get(id) || {};
  return current[key];
}

async function setSetting(userId, key, value) {
  if (!userId) return;
  const id = String(userId);

  try {
    const data = {};
    if (key === "autoApproveAllTerminalCommands")
      data.autoApproveAllTerminalCommands = !!value;
    else if (key === "defaultAiProviderId")
      data.defaultAiProviderId = value || null;
    else if (key === "defaultAiModel") data.defaultAiModel = value || null;
    else {
      const current = inMemory.get(id) || {};
      current[key] = value;
      inMemory.set(id, current);
      return;
    }

    if (prisma && prisma.userSetting) {
      await prisma.userSetting.upsert({
        where: { userId: id },
        update: data,
        create: { userId: id, ...data },
      });
    }
  } catch (e) {
    // ignore DB errors
  }

  const current = inMemory.get(id) || {};
  current[key] = value;
  inMemory.set(id, current);
}

async function setBulk(userId, obj = {}) {
  if (!userId) return;
  const id = String(userId);

  try {
    const data = {};
    if (obj.autoApproveAllTerminalCommands !== undefined)
      data.autoApproveAllTerminalCommands =
        !!obj.autoApproveAllTerminalCommands;
    if (obj.defaultAiProviderId !== undefined)
      data.defaultAiProviderId = obj.defaultAiProviderId || null;
    if (obj.defaultAiModel !== undefined)
      data.defaultAiModel = obj.defaultAiModel || null;

    if (Object.keys(data).length > 0 && prisma && prisma.userSetting) {
      await prisma.userSetting.upsert({
        where: { userId: id },
        update: data,
        create: { userId: id, ...data },
      });
    }
  } catch (e) {
    // ignore DB errors
  }

  const current = inMemory.get(id) || {};
  Object.assign(current, obj || {});
  inMemory.set(id, current);
}

module.exports = { setSetting, getSetting, setBulk };
