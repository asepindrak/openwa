const https = require("https");
const fetch = require("node-fetch");
const { chromium } = require("playwright");

/**
 * Fetches the content of a webpage using basic fetch.
 * Good for static pages or APIs.
 * @param {string} url
 * @returns {Promise<{ok: boolean, body?: string, error?: string}>}
 */
async function fetchWebpage(url) {
  try {
    const agent = new https.Agent({
      rejectUnauthorized: false,
    });

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      },
      agent: url.startsWith("https") ? agent : undefined,
      timeout: 15000,
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const text = await response.text();
    return { ok: true, body: text };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Opens a browser and extracts the page title and visible text.
 * Good for SPA or pages requiring JS execution.
 * @param {string} url
 * @returns {Promise<{ok: boolean, title?: string, content?: string, error?: string}>}
 */
async function openBrowser(url) {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

    const title = await page.title();
    const content = await page.evaluate(() => {
      // Basic extraction of visible text
      return document.body.innerText;
    });

    return { ok: true, title, content: content.substring(0, 50000) }; // Limit content size
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = {
  fetchWebpage,
  openBrowser,
};
