import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

const outDir = process.env.PDF_DIR || process.env.PDF_STORAGE_PATH || path.join(process.cwd(), "pdfs");
const outFile = path.join(outDir, "smoke-check.pdf");

async function main() {
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const chromiumPath =
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    process.env.CHROMIUM_PATH ||
    ["/usr/bin/chromium-browser", "/usr/bin/chromium", "/usr/lib/chromium/chrome"].find((p) =>
      fs.existsSync(p)
    );

  console.log("Launching Chromium:", chromiumPath || "<default>");
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: chromiumPath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-zygote",
    ],
  });

  const page = await browser.newPage();
  await page.setContent("<html><body><h1>PDF Smoke Check</h1><p>OK</p></body></html>", {
    waitUntil: "networkidle0",
  });
  await page.pdf({ path: outFile, format: "A4", printBackground: true });
  await browser.close();
  console.log("check:pdf OK ->", outFile);
}

main().catch((err) => {
  console.error("check:pdf FAIL", err);
  process.exit(1);
});
