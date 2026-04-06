const { fetchWebpage, openBrowser } = require("../server/utils/browser");

async function testFetch() {
  console.log("Testing fetchWebpage...");
  const res = await fetchWebpage("https://example.com");
  if (res.ok) {
    console.log("Fetch Success!");
    console.log("Body preview:", res.body.substring(0, 100));
  } else {
    console.error("Fetch Failed:", res.error);
  }
}

async function testBrowser() {
  console.log("\nTesting openBrowser (Playwright)...");
  const res = await openBrowser("https://example.com");
  if (res.ok) {
    console.log("Browser Success!");
    console.log("Title:", res.title);
    console.log("Content preview:", res.content.substring(0, 100));
  } else {
    console.error("Browser Failed:", res.error);
  }
}

async function runTests() {
  await testFetch();
  await testBrowser();
}

runTests().catch(console.error);
