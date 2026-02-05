const { chromium: playwright } = require("playwright-core");
const chromium = require("@sparticuz/chromium");

async function getBrowser() {
  let executablePath = null;
  try {
    executablePath = await chromium.executablePath();
  } catch {}

  return playwright.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: executablePath || undefined,
    headless: chromium.headless,
  });
}

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ status: false, message: "Method not allowed" });
  }

  const url = req.query?.url;
  if (!url) {
    return res.status(400).json({ status: false, message: "URL required" });
  }

  let browser;
  try {
    browser = await getBrowser();
    const page = await browser.newPage();

    const m3u8 = new Set();
    const mp4 = new Set();

    page.on("request", (req) => {
      const u = req.url();
      if (u.includes(".m3u8")) m3u8.add(u);
      if (u.includes(".mp4")) mp4.add(u);
    });

    page.on("response", async (res) => {
      try {
        const u = res.url();
        const ct = (res.headers()["content-type"] || "").toLowerCase();
        if (ct.includes("application/vnd.apple.mpegurl") || ct.includes("application/x-mpegurl")) {
          m3u8.add(u);
        }
        if (ct.includes("video/mp4")) {
          mp4.add(u);
        }
      } catch {}
    });

    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(5000);

    return res.json({
      status: true,
      data: {
        m3u8: [...m3u8],
        mp4: [...mp4],
      },
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error?.message || "Failed" });
  } finally {
    if (browser) await browser.close();
  }
};
