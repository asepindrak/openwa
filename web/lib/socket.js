import { io } from "socket.io-client";
import { getApiBaseUrl } from "./api";

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
  const socketBaseUrl = getApiBaseUrl();

  return io(socketBaseUrl, {
    auth: {
      token,
      platform,
    },
  });
}
