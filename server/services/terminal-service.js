const { spawn } = require("child_process");
const { prisma } = require("../database/client");
const { getConfig } = require("../config");
const userSettings = require("./user-settings");

function runShellCommand(command, timeout = 300000, cwd) {
  return new Promise((resolve) => {
    const child = spawn(command, {
      shell: true,
      windowsHide: true,
      cwd: cwd || process.cwd(),
    });
    let stdout = "";
    let stderr = "";
    let finished = false;

    const onFinish = (code) => {
      if (finished) return;
      finished = true;
      resolve({ code, stdout, stderr });
    };

    child.stdout.on("data", (d) => {
      try {
        stdout += String(d || "");
      } catch (e) {}
    });

    child.stderr.on("data", (d) => {
      try {
        stderr += String(d || "");
      } catch (e) {}
    });

    child.on("error", (err) => {
      if (finished) return;
      finished = true;
      resolve({
        code: -1,
        stdout,
        stderr: (stderr || "") + String(err.message || err),
      });
    });

    child.on("close", (code) => onFinish(code));

    if (timeout && timeout > 0) {
      setTimeout(() => {
        try {
          child.kill();
        } catch (e) {}
        if (!finished) {
          finished = true;
          resolve({ code: -1, stdout, stderr: (stderr || "") + "\n<timeout>" });
        }
      }, timeout);
    }
  });
}

async function requestExecution(
  userId,
  {
    command,
    approvalMode = "manual",
    timeout = 300000,
    trustedAuto = false,
    chatId = null,
  } = {},
  io,
) {
  if (!command) throw new Error("command is required");

  getConfig();
  const allowlist = (process.env.OPENWA_TERMINAL_ALLOWLIST || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Check in-memory per-user setting for bypassing the host allowlist
  let userPrefAuto = false;
  try {
    userPrefAuto = !!(await userSettings.getSetting(
      userId,
      "autoApproveAllTerminalCommands",
    ));
  } catch (e) {
    // ignore
  }

  if (userPrefAuto) {
    approvalMode = "auto";
  }

  const record = await prisma.terminalCommand.create({
    data: {
      userId,
      command,
      approvalMode: approvalMode === "auto" ? "auto" : "manual",
      status: "pending",
    },
  });

  // Auto-execute when explicitly requested and either the user has enabled
  // bypassing the host allowlist or the command matches the configured allowlist.
  const canAuto =
    approvalMode === "auto" &&
    (trustedAuto ||
      userPrefAuto ||
      (allowlist.length > 0 &&
        allowlist.some((a) => command.trim().startsWith(a))));
  if (canAuto) {
    await prisma.terminalCommand.update({
      where: { id: record.id },
      data: { status: "running" },
    });
    const res = await runShellCommand(command, timeout);
    const result = {
      stdout: res.stdout,
      stderr: res.stderr,
      exitCode: res.code,
    };
    await prisma.terminalCommand.update({
      where: { id: record.id },
      data: {
        status: res.code === 0 ? "completed" : "failed",
        result,
        executedAt: new Date(),
      },
    });
    try {
      io &&
        io.to(`user:${userId}`).emit("terminal_result", {
          id: record.id,
          chatId,
          status: res.code === 0 ? "completed" : "failed",
          result,
          command,
        });
    } catch (e) {}
    return { id: record.id, chatId, executed: true, result, command };
  }

  // Emit request for manual approval
  try {
    io &&
      io.to(`user:${userId}`).emit("terminal_request", {
        id: record.id,
        chatId,
        userId,
        command,
        approvalMode: record.approvalMode,
        status: record.status,
        requestedAt: record.requestedAt,
      });
  } catch (e) {}

  return { id: record.id, chatId, executed: false, command };
}

async function listPendingRequests(userId) {
  return prisma.terminalCommand.findMany({
    where: { userId, status: "pending" },
    orderBy: { requestedAt: "desc" },
  });
}

async function listHistory(userId, limit = 50) {
  return prisma.terminalCommand.findMany({
    where: { userId },
    orderBy: { requestedAt: "desc" },
    take: Number(limit) || 50,
  });
}

async function getRequestById(id) {
  return prisma.terminalCommand.findUnique({ where: { id } });
}

async function approveRequest(approverId, requestId, approve = true, io) {
  const record = await prisma.terminalCommand.findUnique({
    where: { id: requestId },
  });
  if (!record) throw new Error("Request not found");
  if (record.status !== "pending") throw new Error("Request is not pending");

  if (!approve) {
    await prisma.terminalCommand.update({
      where: { id: requestId },
      data: { status: "denied" },
    });
    try {
      io &&
        io
          .to(`user:${record.userId}`)
          .emit("terminal_result", { id: requestId, status: "denied" });
    } catch (e) {}
    return { ok: true, denied: true };
  }

  await prisma.terminalCommand.update({
    where: { id: requestId },
    data: { status: "running" },
  });
  const res = await runShellCommand(record.command);
  const result = { stdout: res.stdout, stderr: res.stderr, exitCode: res.code };
  await prisma.terminalCommand.update({
    where: { id: requestId },
    data: {
      status: res.code === 0 ? "completed" : "failed",
      result,
      executedAt: new Date(),
    },
  });
  try {
    io &&
      io.to(`user:${record.userId}`).emit("terminal_result", {
        id: requestId,
        status: res.code === 0 ? "completed" : "failed",
        result,
      });
  } catch (e) {}

  return { ok: true, result };
}

module.exports = {
  runShellCommand,
  requestExecution,
  listPendingRequests,
  approveRequest,
  listHistory,
  getRequestById,
};
