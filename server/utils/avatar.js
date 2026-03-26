function initials(name) {
  return String(name || "?")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function colorForSeed(seed) {
  const palette = [
    ["#25d366", "#d2f8e9"],
    ["#00a884", "#dffaf1"],
    ["#7c4dff", "#efe7ff"],
    ["#ff8a65", "#ffe8e0"],
    ["#5c6bc0", "#e7eaff"],
    ["#26a69a", "#e0f7f4"]
  ];

  const source = String(seed || "");
  const index = source.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % palette.length;
  return palette[index];
}

function createAvatarDataUrl(name, seed = name) {
  const label = initials(name);
  const [background, foreground] = colorForSeed(seed);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="48" fill="${background}"/><text x="48" y="55" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="30" font-weight="700" fill="${foreground}">${label}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

module.exports = {
  createAvatarDataUrl
};
