import { chromium } from "playwright";

let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

// Singleton browser — launch once, reuse for all PDF renders
async function getBrowser() {
    if (!browser) {
        browser = await chromium.launch({ headless: true });
    }
    return browser;
}

export async function generatePDF(htmlContent: string, outputPath: string): Promise<string> {
    const br   = await getBrowser();
    const page = await br.newPage();

    try {
        await page.setContent(htmlContent, { waitUntil: "networkidle" });
        await page.emulateMedia({ media: "print" });
        await page.pdf({
            path:   outputPath,
            format: "A4",
            margin: { top: "20mm", right: "15mm", bottom: "20mm", left: "15mm" },
            printBackground: true,
            tagged: true,  // accessibility-compliant tagged PDF (Playwright v1.42+)
        });
        return outputPath;
    } finally {
        await page.close();
    }
}

// Graceful shutdown
process.on("exit", async () => {
    if (browser) await browser.close();
});
