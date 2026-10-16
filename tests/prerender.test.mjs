import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { after, before, test } from "node:test";
import { chromium } from "playwright-core";
import seo from "../src/seo.json" with { type: "json" };

const root = path.resolve(".");
const dist = path.join(root, "dist");
const origin = "http://127.0.0.1:4178";
const vitePreviewPath = (route) => route === "/" ? "/" : `${route}/`;
const expectedPreviewRobots = process.env.VERCEL_ENV === "preview" ? "noindex,nofollow" : null;
const expectedCityPaths = [
  "/locations/orem",
  "/locations/provo",
  "/locations/alpine",
  "/locations/highland",
  "/locations/mapleton",
  "/locations/lehi",
  "/locations/american-fork",
  "/locations/pleasant-grove",
  "/locations/springville",
  "/locations/cedar-hills",
  "/locations/woodland-hills",
  "/locations/elk-ridge",
];

let previewProcess;
let browser;

before(async () => {
  assert.ok(fs.existsSync(path.join(dist, "index.html")), "run npm run build first");
  const viteCli = path.join(root, "node_modules/vite/bin/vite.js");
  previewProcess = spawn(process.execPath, [viteCli, "preview", "--host", "127.0.0.1", "--port", "4178", "--strictPort"], {
    cwd: root,
    stdio: "ignore",
  });

  let ready = false;
  for (let i = 0; i < 40; i += 1) {
    if (previewProcess.exitCode !== null) throw new Error(`vite preview exited with ${previewProcess.exitCode}`);
    try {
      const response = await fetch(origin);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  assert.ok(ready, "vite preview did not start");

  const executablePath = process.env.CHROMIUM_PATH || "/usr/bin/chromium";
  browser = await chromium.launch({ headless: true, executablePath });
});

after(async () => {
  await browser?.close();
  if (previewProcess && previewProcess.exitCode === null) {
    previewProcess.kill("SIGTERM");
    await new Promise((resolve) => previewProcess.once("exit", resolve));
  }
});

test("renders only the public SEO allowlist and controlled 404", () => {
  const uniqueRoutes = new Set(seo.routes.map(({ route }) => route));
  assert.equal(uniqueRoutes.size, seo.routes.length);
  assert.ok(!uniqueRoutes.has(seo.notFound.route));
  assert.ok(![...uniqueRoutes].some((route) => /paint-guide/i.test(route)));

  for (const meta of seo.routes) {
    const file = meta.route === "/"
      ? path.join(dist, "index.html")
      : path.join(dist, meta.route.slice(1), "index.html");
    assert.ok(fs.existsSync(file), `missing prerender output for ${meta.route}`);
    const html = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(html, /<div id="root">\s*<\/div>/i, `${meta.route} has an empty root`);
    assert.match(html, /<main\b/i, `${meta.route} has no server-rendered main content`);
    const escapedTitle = meta.title.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    assert.ok(html.includes(`<title>${escapedTitle}</title>`), `${meta.route} has the wrong title`);
    assert.ok(html.includes(`href="${meta.canonical}"`), `${meta.route} has the wrong canonical`);
    if (expectedPreviewRobots) {
      assert.ok(html.includes(`<meta name="robots" content="${expectedPreviewRobots}"`), `${meta.route} is indexable in a preview build`);
      assert.ok(html.includes('<meta name="tauro-preview" content="noindex"'), "preview marker is missing");
    } else {
      assert.ok(html.includes('<meta name="robots" content="index,follow"'), `${meta.route} robots directive changed outside a preview build`);
      assert.ok(!html.includes('name="tauro-preview"'), "preview marker leaked into a non-preview build");
    }
    assert.match(html, /<script id="ld-json-business" type="application\/ld\+json">/);
    assert.ok(!/paint guide/i.test(html), `${meta.route} contains private guide content`);

    if (seo.pageSchemas[meta.route]) {
      assert.match(html, /<script id="ld-json-page" type="application\/ld\+json">/);
    }
  }

  const notFoundHtml = fs.readFileSync(path.join(dist, "404.html"), "utf8");
  assert.match(notFoundHtml, /404 · Page not found/);
  assert.match(notFoundHtml, /This page is<br[^>]*\/>not in the plan\./);
  assert.ok(notFoundHtml.includes(`<meta name="robots" content="${expectedPreviewRobots ?? "noindex,follow"}"`));
  assert.ok(notFoundHtml.includes(`href="${seo.notFound.canonical}"`));
});

test("initial HTML serves route content without JavaScript and hydrates cleanly", async () => {
  const context = await browser.newContext({ javaScriptEnabled: false, reducedMotion: "reduce" });
  await context.route("https://www.googletagmanager.com/**", (route) => route.abort());
  const page = await context.newPage();
  const response = await page.goto(`${origin}${vitePreviewPath("/locations/orem")}`);
  assert.equal(response.status(), 200);
  await assert.equal(await page.locator("h1").count(), 1);
  assert.match(await page.locator("body").innerText(), /Orem/i);
  await context.close();

  const hydratedContext = await browser.newContext({ reducedMotion: "reduce" });
  await hydratedContext.route("https://www.googletagmanager.com/**", (route) => route.abort());
  const hydratedPage = await hydratedContext.newPage();
  const pageErrors = [];
  hydratedPage.on("pageerror", (error) => pageErrors.push(error.message));
  await hydratedPage.goto(`${origin}${vitePreviewPath("/locations/orem")}`, { waitUntil: "domcontentloaded" });
  await hydratedPage.waitForTimeout(250);
  assert.deepEqual(pageErrors, []);
  assert.equal(await hydratedPage.locator("h1").count(), 1);
  assert.match(await hydratedPage.title(), /Orem/);
  assert.equal(await hydratedPage.locator('link[rel="canonical"]').getAttribute("href"), seo.routes.find(({ route }) => route === "/locations/orem").canonical);
  assert.equal(
    await hydratedPage.locator('meta[name="robots"]').getAttribute("content"),
    expectedPreviewRobots ?? "index,follow",
  );
  await hydratedContext.close();
});

test("desktop and mobile service area navigation works without horizontal overflow", async () => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await context.route("https://www.googletagmanager.com/**", (route) => route.abort());
  const page = await context.newPage();

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${origin}${vitePreviewPath("/locations")}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: "Service Areas", exact: true }).first().click();
  assert.equal(new URL(page.url()).pathname, "/locations");
  for (const cityPath of expectedCityPaths) {
    assert.ok(await page.locator(`a[href="${cityPath}"]`).count(), `missing navigation link: ${cityPath}`);
  }
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}${vitePreviewPath("/locations")}`);
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.locator("#mobile-navigation").getByRole("link", { name: "Service Areas" }).click();
  assert.equal(new URL(page.url()).pathname, "/locations");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));

  await page.screenshot({ path: "/tmp/tauro-website-ssg-mobile.png", fullPage: true, animations: "disabled" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${origin}${vitePreviewPath("/locations")}`);
  await page.screenshot({ path: "/tmp/tauro-website-ssg-desktop.png", fullPage: true, animations: "disabled" });
  await context.close();
});

test("contact form keeps required fields and never sends a real inquiry", async () => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await context.route("https://www.googletagmanager.com/**", (route) => route.abort());
  const page = await context.newPage();
  const externalPosts = [];
  page.on("request", (request) => {
    if (request.url().includes("formsubmit.co") && request.method() === "POST") externalPosts.push(request.url());
  });
  await page.route("https://formsubmit.co/**", (route) => route.abort());
  await page.goto(`${origin}${vitePreviewPath("/contact")}`, { waitUntil: "domcontentloaded" });
  const form = page.locator("form").first();
  assert.ok(await form.locator("[required]").count() > 0);
  assert.equal(await form.evaluate((element) => element.checkValidity()), false);
  await form.getByRole("button", { name: "Request a Walkthrough" }).click();
  assert.deepEqual(externalPosts, []);
  await context.close();
});
