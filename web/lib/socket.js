import { io } from "socket.io-client";

function detectPlatform() {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  if (/Win/i.test(platform) || /Windows/i.test(ua)) return "Windows";
  if (/Mac/i.test(platform) || /Macintosh/i.test(ua) || /Mac OS X/i.test(ua))
    return "macOS";
  if (/Linux/i.test(platform) || /X11/i.test(ua)) return "Linux";
  return "Unknown";
}

export function createSocket(token) {
  const platform = typeof navigator !== "undefined" ? detectPlatform() : null;
  return io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:55222", {
    auth: {
      token,
      platform,
    },
  });
}
