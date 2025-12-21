import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

const chromiumPath =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  process.env.CHROMIUM_PATH ||
  ["/usr/bin/chromium-browser", "/usr/bin/chromium", "/usr/lib/chromium/chrome"].find((p) => fs.existsSync(p));

async function main() {
  const outDir = path.join(process.cwd(), "pdfs");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

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
  await page.setContent("<html><body><h1>PDF Smoke Test</h1><p>Hello from Puppeteer.</p></body></html>", {
    waitUntil: "networkidle0",
  });
  const outFile = path.join(outDir, "smoke-test.pdf");
  await page.pdf({ path: outFile, format: "A4", printBackground: true });
  await browser.close();
  console.log("PDF smoke test written to", outFile);
}

main().catch((err) => {
  console.error("PDF smoke test failed:", err);
  process.exit(1);
});
