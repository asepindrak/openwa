#!/usr/bin/env node
function recentChatTimestamp(chat) {
  return chat?.contact?.lastMessageAt || chat?.lastMessage?.createdAt || null;
}

function sortChats(chats) {
  return [...chats].sort((left, right) => {
    const leftPinned = left.pinnedAt ? new Date(left.pinnedAt) : null;
    const rightPinned = right.pinnedAt ? new Date(right.pinnedAt) : null;

    if (leftPinned && rightPinned) {
      return rightPinned - leftPinned;
    }

    if (leftPinned) return -1;
    if (rightPinned) return 1;

    const leftRecent = recentChatTimestamp(left);
    const rightRecent = recentChatTimestamp(right);

    if (leftRecent && rightRecent) {
      return new Date(rightRecent) - new Date(leftRecent);
    }

    if (rightRecent) return 1;
    if (leftRecent) return -1;

    return new Date(right.updatedAt) - new Date(left.updatedAt);
  });
}

const chats = [
  {
    id: "a",
    pinnedAt: null,
    contact: { lastMessageAt: "2026-04-07T10:00:00Z", displayName: "A" },
    updatedAt: "2026-04-07T10:00:00Z",
  },
  {
    id: "b",
    pinnedAt: "2026-04-07T11:00:00Z",
    contact: { lastMessageAt: "2026-04-07T09:00:00Z", displayName: "B" },
    updatedAt: "2026-04-07T09:00:00Z",
  },
  {
    id: "c",
    pinnedAt: null,
    contact: { lastMessageAt: "2026-04-07T12:00:00Z", displayName: "C" },
    updatedAt: "2026-04-07T12:00:00Z",
  },
  {
    id: "d",
    pinnedAt: "2026-04-07T12:30:00Z",
    contact: { lastMessageAt: "2026-04-07T08:00:00Z", displayName: "D" },
    updatedAt: "2026-04-07T08:00:00Z",
  },
];

const sorted = sortChats(chats);
console.log("sorted ids:", sorted.map((c) => c.id).join(", "));
console.log("expected pinned first (d,b) then c,a");
