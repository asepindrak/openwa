import { io } from "socket.io-client";

export function createSocket(token) {
  return io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:55222", {
    auth: {
      token
    }
  });
}
