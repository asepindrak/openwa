const assert = require("assert");
const path = require("path");

(async () => {
  try {
    const { mediaDir } = require("../server/utils/paths");
    const adapter = require("../server/whatsapp/adapters/wwebjs-adapter");
    const internal = adapter.__internal || {};

    assert.equal(
      typeof internal.resolveStoredMediaPath,
      "function",
      "resolveStoredMediaPath should be exported for testing",
    );

    const resolvedFromRelative = internal.resolveStoredMediaPath(
      "media/sample-image.png",
    );
    assert.equal(resolvedFromRelative, path.join(mediaDir, "sample-image.png"));

    const resolvedFromBareName =
      internal.resolveStoredMediaPath("sample-image.png");
    assert.equal(resolvedFromBareName, path.join(mediaDir, "sample-image.png"));

    const resolvedFromWindowsStyle = internal.resolveStoredMediaPath(
      "media\\sample-image.png",
    );
    assert.equal(
      resolvedFromWindowsStyle,
      path.join(mediaDir, "sample-image.png"),
    );

    console.log("wwebjs media path checks passed");
    process.exit(0);
  } catch (error) {
    console.error("wwebjs media path checks failed:", error);
    process.exit(1);
  }
})();
