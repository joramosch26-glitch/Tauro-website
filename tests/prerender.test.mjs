import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { after, before, test } from "node:test";
import { chromium } from "playwright-core";
import seo from "../src/seo.json" with { type: "json" };

const root = path.resolve(".");
const dist = path.join(root, "dist");
const previewPort = Number(process.env.PRERENDER_TEST_PORT ?? 4178);
const origin = `http://127.0.0.1:${previewPort}`;
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

async function instrumentSubmissionTimeout(page) {
  await page.addInitScript(() => {
    const submissionTimeoutMs = 15_000;
    const nativeSetTimeout = window.setTimeout.bind(window);
    const nativeClearTimeout = window.clearTimeout.bind(window);
    const timers = { created: [], cleared: [] };
    Object.defineProperty(window, "__tauroSubmissionTimers", { value: timers });
    window.setTimeout = (callback, delay, ...args) => {
      const timerId = nativeSetTimeout(callback, delay === submissionTimeoutMs ? 50 : delay, ...args);
      if (delay === submissionTimeoutMs) timers.created.push(timerId);
      return timerId;
    };
    window.clearTimeout = (timerId) => {
      if (timers.created.includes(timerId)) timers.cleared.push(timerId);
      return nativeClearTimeout(timerId);
    };
  });
}

async function submissionTimeoutRecords(page) {
  return page.evaluate(() => window.__tauroSubmissionTimers);
}

async function mockFormSubmit(page, { status = 200, body, rawBody, contentType = "application/json" }) {
  const submissions = [];
  const corsHeaders = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "accept,content-type",
  };

  await page.route("https://formsubmit.co/**", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    if (route.request().method() !== "POST") {
      await route.abort();
      return;
    }

    submissions.push(JSON.parse(route.request().postData() ?? "{}"));
    await route.fulfill({
      status,
      headers: { ...corsHeaders, "content-type": contentType },
      body: rawBody ?? JSON.stringify(body),
    });
  });

  return submissions;
}

async function fillInquiryForm(form) {
  await form.getByLabel("Name", { exact: true }).fill("Morgan Test");
  await form.getByLabel("Phone (optional)", { exact: true }).fill("8015550100");
  await form.getByLabel("Email", { exact: true }).fill("morgan@example.test");
  await form.getByLabel("Project type", { exact: true }).selectOption("interior");
  await form.getByLabel("Project city or ZIP (optional)", { exact: true }).fill("Provo, UT");
  await form.getByLabel("Project details", { exact: true }).fill("Mock project details for form tests.");
}

before(async () => {
  assert.ok(fs.existsSync(path.join(dist, "index.html")), "run npm run build first");
  const viteCli = path.join(root, "node_modules/vite/bin/vite.js");
  let previewOutput = "";
  previewProcess = spawn(process.execPath, [viteCli, "preview", "--host", "127.0.0.1", "--port", String(previewPort), "--strictPort"], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
  });
  previewProcess.stdout.setEncoding("utf8").on("data", (chunk) => { previewOutput += chunk; });
  previewProcess.stderr.setEncoding("utf8").on("data", (chunk) => { previewOutput += chunk; });

  let ready = false;
  for (let i = 0; i < 40; i += 1) {
    if (previewProcess.exitCode !== null) throw new Error(`vite preview exited with ${previewProcess.exitCode}`);
    if (previewOutput.includes(origin)) {
      ready = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(ready, `this test run's Vite preview did not announce ${origin}: ${previewOutput}`);
  const previewResponse = await fetch(origin);
  assert.ok(previewResponse.ok, `this test run's Vite preview returned ${previewResponse.status}`);

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
    assert.equal((html.match(/<h1\b/gi) ?? []).length, 1, `${meta.route} should contain one H1`);
    const escapedTitle = meta.title.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    assert.ok(html.includes(`<title>${escapedTitle}</title>`), `${meta.route} has the wrong title`);
    assert.ok(html.includes(`href="${meta.canonical}"`), `${meta.route} has the wrong canonical`);
    if (expectedPreviewRobots) {
      assert.ok(html.includes(`<meta name="robots" content="${expectedPreviewRobots}"`), `${meta.route} is indexable in a preview build`);
      assert.ok(html.includes('<meta name="tauro-preview" content="noindex"'), "preview marker is missing");
    } else {
      assert.ok(html.includes(`<meta name="robots" content="${meta.robots ?? "index,follow"}"`), `${meta.route} robots directive changed outside a preview build`);
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

  const officeCheckMeta = seo.routes.find(({ route }) => route === "/office-routing-check");
  assert.ok(officeCheckMeta, "temporary office check route is missing from prerender manifest");
  assert.equal(officeCheckMeta.robots, "noindex,nofollow");
  const sitemap = fs.readFileSync(path.join(root, "public", "sitemap.xml"), "utf8");
  assert.ok(!sitemap.includes(officeCheckMeta.canonical), "temporary office check route must not be in the sitemap");
  for (const meta of seo.routes.filter(({ route }) => route !== officeCheckMeta.route)) {
    const file = meta.route === "/" ? path.join(dist, "index.html") : path.join(dist, meta.route.slice(1), "index.html");
    assert.ok(!fs.readFileSync(file, "utf8").includes(`href="${officeCheckMeta.route}"`), `${meta.route} links to the temporary route`);
  }
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
  await page.getByRole("heading", { name: "Two markets. One exacting finish standard." }).waitFor();
  assert.match(await page.locator("body").innerText(), /painting and finishing work in Midway and Park City/i);
  assert.doesNotMatch(await page.locator("body").innerText(), /premium location pages are ready/i);
  await page.getByRole("link", { name: "Service Areas", exact: true }).first().click();
  assert.equal(new URL(page.url()).pathname, "/locations");
  for (const cityPath of expectedCityPaths) {
    assert.ok(await page.locator(`a[href="${cityPath}"]`).count(), `missing navigation link: ${cityPath}`);
  }

  await page.goto(`${origin}${vitePreviewPath("/locations/lehi")}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Interior, exterior, and custom-home painting." }).waitFor();
  assert.match(await page.locator("body").innerText(), /interior and exterior painting, cabinetry, and wood finishes/i);
  assert.match(await page.title(), /Custom Home Painters in Lehi/);

  await page.goto(`${origin}${vitePreviewPath("/projects")}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: "Discuss a project" }).waitFor();
  assert.equal(await page.locator('a[href="/projects"]').filter({ hasText: "Portfolio" }).count(), 0);

  await page.goto(origin, { waitUntil: "domcontentloaded" });
  assert.equal(await page.locator('a[href="/projects"]').filter({ hasText: "Portfolio" }).count(), 1);
  const footer = page.locator("footer");
  assert.equal(await footer.getByRole("link", { name: "Visit Tauro Painting on Instagram" }).count(), 1);
  assert.equal(await footer.getByRole("link", { name: "Visit Tauro Painting on Facebook" }).count(), 1);
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

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  await page.screenshot({ path: "/tmp/tauro-inquiry-home-desktop.png", animations: "disabled" });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  assert.equal(await page.getByRole("link", { name: /call tauro/i }).isVisible(), true);
  assert.equal(await page.getByRole("link", { name: /request a walkthrough/i }).first().isVisible(), true);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.screenshot({ path: "/tmp/tauro-inquiry-home-mobile.png", animations: "disabled" });
  await page.goto(`${origin}${vitePreviewPath("/contact")}`, { waitUntil: "domcontentloaded" });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  assert.equal(await page.locator("form").getByRole("button", { name: "Request a Walkthrough" }).isVisible(), true);
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

test("temporary office check is noindex, unlinked, office-only, and excluded from lead analytics", async () => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await context.route("https://www.googletagmanager.com/**", (route) => route.abort());
  const page = await context.newPage();
  const destinations = [];
  page.on("request", (request) => {
    if (request.url().includes("formsubmit.co") && request.method() === "POST") destinations.push(request.url());
  });
  const submissions = await mockFormSubmit(page, { body: { success: "true", message: "Test accepted." } });
  await page.goto(`${origin}${vitePreviewPath("/office-routing-check")}`, { waitUntil: "domcontentloaded" });
  assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), expectedPreviewRobots ?? "noindex,nofollow");
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), "https://www.tauropainting.com/office-routing-check");
  assert.match(await page.locator("body").innerText(), /Temporary internal test/i);
  assert.equal(await page.locator('a[href="/office-routing-check"]').count(), 0);
  await page.evaluate(() => {
    window.__tauroLeadEvents = [];
    window.gtag = (...args) => window.__tauroLeadEvents.push(args);
  });

  const form = page.locator("form").first();
  await fillInquiryForm(form);
  await form.getByRole("button", { name: "Request a Walkthrough" }).click();
  await page.getByRole("status").waitFor({ state: "visible" });
  assert.deepEqual(destinations, ["https://formsubmit.co/ajax/office@tauropainting.com"]);
  assert.equal(submissions.length, 1);
  assert.equal(submissions[0].submittedFrom, "http://127.0.0.1:4178/office-routing-check");
  assert.deepEqual(await page.evaluate(() => window.__tauroLeadEvents), []);
  await context.close();
});

test("phone is optional and email remains required on both inquiry forms", async () => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await context.route("https://www.googletagmanager.com/**", (route) => route.abort());
  const page = await context.newPage();
  const submissions = await mockFormSubmit(page, { body: { success: "true", message: "Submission accepted." } });
  const destinations = [];
  page.on("request", (request) => {
    if (request.url().includes("formsubmit.co") && request.method() === "POST") destinations.push(request.url());
  });

  for (const url of [`${origin}/#contact`, `${origin}${vitePreviewPath("/contact")}`]) {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    const form = page.locator("form").first();
    const phone = form.getByLabel("Phone (optional)", { exact: true });
    const email = form.getByLabel("Email", { exact: true });
    assert.equal(await phone.evaluate((element) => element.required), false);
    assert.equal(await email.evaluate((element) => element.required), true);
    await fillInquiryForm(form);
    await phone.fill("");
    assert.equal(await form.evaluate((element) => element.checkValidity()), true);
    await form.getByRole("button", { name: "Request a Walkthrough" }).click();
    await page.getByRole("status").waitFor({ state: "visible" });
  }

  assert.equal(submissions.length, 2);
  assert.equal(submissions[0].phone, "");
  assert.equal(submissions[1].phone, "");
  assert.deepEqual(destinations, [
    "https://formsubmit.co/ajax/tauropaintingutah@gmail.com",
    "https://formsubmit.co/ajax/tauropaintingutah@gmail.com",
  ]);
  await context.close();
});

test("home and contact forms do not report provider-level rejection as success", async () => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await context.route("https://www.googletagmanager.com/**", (route) => route.abort());
  const page = await context.newPage();
  const submissions = await mockFormSubmit(page, {
    status: 200,
    body: { success: "false", message: "Provider rejected the request." },
  });

  for (const url of [`${origin}/#contact`, `${origin}${vitePreviewPath("/contact")}`]) {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    const form = page.locator("form").first();
    await fillInquiryForm(form);
    await form.getByRole("button", { name: "Request a Walkthrough" }).click();

    const alert = page.getByRole("alert");
    await alert.waitFor({ state: "visible" });
    assert.match(await alert.innerText(), /could not accept your request/i);
    assert.equal(await page.getByRole("status").count(), 0);
    assert.equal(await form.getByLabel("Project city or ZIP (optional)", { exact: true }).inputValue(), "Provo, UT");
    assert.equal(await form.getByLabel("Project details", { exact: true }).inputValue(), "Mock project details for form tests.");
    assert.equal(await alert.getByRole("link", { name: "Call Tauro at (801) 928-9520" }).getAttribute("href"), "tel:8019289520");
  }

  assert.equal(submissions.length, 2);
  assert.equal(submissions[0].projectLocation, "Provo, UT");
  assert.equal(submissions[1].projectLocation, "Provo, UT");
  await context.close();
});

test("successful provider acknowledgment clears the contact form; HTTP failure keeps the home form actionable", async () => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await context.route("https://www.googletagmanager.com/**", (route) => route.abort());
  const page = await context.newPage();
  await instrumentSubmissionTimeout(page);
  const successSubmissions = await mockFormSubmit(page, {
    body: { success: "true", message: "Submission accepted." },
  });

  await page.goto(`${origin}${vitePreviewPath("/contact")}`, { waitUntil: "domcontentloaded" });
  const contactForm = page.locator("form").first();
  await fillInquiryForm(contactForm);
  await contactForm.getByLabel("Project city or ZIP (optional)").fill("");
  await contactForm.getByRole("button", { name: "Request a Walkthrough" }).click();
  await page.getByRole("status").waitFor({ state: "visible" });
  const successTimers = await submissionTimeoutRecords(page);
  assert.equal(successTimers.created.length, 1);
  assert.deepEqual(successTimers.cleared, successTimers.created);
  assert.equal(await contactForm.getByLabel("Project city or ZIP (optional)", { exact: true }).inputValue(), "");
  assert.equal(successSubmissions.length, 1);
  assert.equal(successSubmissions[0].projectLocation, "");

  await fillInquiryForm(contactForm);
  await contactForm.getByLabel("Project city or ZIP (optional)").fill("");
  await contactForm.getByRole("button", { name: "Request a Walkthrough" }).click();
  const duplicateAlert = page.getByRole("alert");
  await duplicateAlert.waitFor({ state: "visible" });
  assert.match(await duplicateAlert.innerText(), /request was sent recently/i);
  assert.equal(await page.getByRole("status").count(), 0);
  assert.equal(await contactForm.getByLabel("Project city or ZIP (optional)", { exact: true }).inputValue(), "");
  assert.equal(successSubmissions.length, 1);

  await page.unroute("https://formsubmit.co/**");
  const failedSubmissions = await mockFormSubmit(page, {
    status: 503,
    body: { success: false, message: "Service unavailable." },
  });
  await page.goto(`${origin}/#contact`, { waitUntil: "domcontentloaded" });
  const homeForm = page.locator("form").first();
  await fillInquiryForm(homeForm);
  await homeForm.getByRole("button", { name: "Request a Walkthrough" }).click();
  const alert = page.getByRole("alert");
  await alert.waitFor({ state: "visible" });
  assert.match(await alert.innerText(), /could not accept your request/i);
  assert.equal(await homeForm.getByLabel("Project city or ZIP (optional)", { exact: true }).inputValue(), "Provo, UT");
  assert.equal(await homeForm.getByRole("button", { name: "Request a Walkthrough" }).isEnabled(), true);
  assert.equal(failedSubmissions.length, 1);
  const completedTimers = await submissionTimeoutRecords(page);
  assert.equal(completedTimers.created.length, 1);
  assert.deepEqual(completedTimers.cleared, completedTimers.created);
  await context.close();
});

test("a 2xx response without acknowledgment is submitted-but-unconfirmed on both forms", async () => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await context.route("https://www.googletagmanager.com/**", (route) => route.abort());
  const page = await context.newPage();
  const submissions = await mockFormSubmit(page, {
    status: 200,
    body: { message: "Response without an acknowledgment." },
  });
  for (const url of [`${origin}/#contact`, `${origin}${vitePreviewPath("/contact")}`]) {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    const form = page.locator("form").first();
    await fillInquiryForm(form);
    await form.getByRole("button", { name: "Request a Walkthrough" }).click();

    const status = page.getByRole("status");
    await status.waitFor({ state: "visible" });
    assert.match(await status.innerText(), /request submitted; receipt unconfirmed/i);
    assert.match(await status.innerText(), /call us to confirm before sending again/i);
    assert.equal(await page.getByRole("alert").count(), 0);
    assert.equal(await status.getByRole("link", { name: "Call Tauro at (801) 928-9520" }).getAttribute("href"), "tel:8019289520");
    assert.equal(await page.getByRole("status").filter({ hasText: "Request received successfully" }).count(), 0);
    assert.equal(await form.getByLabel("Project city or ZIP (optional)", { exact: true }).inputValue(), "Provo, UT");
    assert.equal(await form.getByLabel("Project details", { exact: true }).inputValue(), "Mock project details for form tests.");
  }
  assert.equal(submissions.length, 2);
  await context.close();
});

test("boolean success is accepted, explicit failure is rejected, and non-JSON 2xx is unconfirmed", async () => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await context.route("https://www.googletagmanager.com/**", (route) => route.abort());
  const page = await context.newPage();

  await mockFormSubmit(page, { body: { success: true, message: "Accepted." } });
  await page.goto(`${origin}${vitePreviewPath("/contact")}`, { waitUntil: "domcontentloaded" });
  let form = page.locator("form").first();
  await fillInquiryForm(form);
  await form.getByRole("button", { name: "Request a Walkthrough" }).click();
  await page.getByRole("status").waitFor({ state: "visible" });

  await page.unroute("https://formsubmit.co/**");
  await mockFormSubmit(page, { body: { success: false, message: "Rejected." } });
  await page.goto(`${origin}/#contact`, { waitUntil: "domcontentloaded" });
  form = page.locator("form").first();
  await fillInquiryForm(form);
  await form.getByRole("button", { name: "Request a Walkthrough" }).click();
  let alert = page.getByRole("alert");
  await alert.waitFor({ state: "visible" });
  assert.match(await alert.innerText(), /could not accept your request/i);
  assert.equal(await form.getByLabel("Project details", { exact: true }).inputValue(), "Mock project details for form tests.");

  await page.unroute("https://formsubmit.co/**");
  await mockFormSubmit(page, { body: { error: "Rejected." } });
  await page.goto(`${origin}/#contact`, { waitUntil: "domcontentloaded" });
  form = page.locator("form").first();
  await fillInquiryForm(form);
  await form.getByRole("button", { name: "Request a Walkthrough" }).click();
  alert = page.getByRole("alert");
  await alert.waitFor({ state: "visible" });
  assert.match(await alert.innerText(), /could not accept your request/i);

  await page.unroute("https://formsubmit.co/**");
  await mockFormSubmit(page, { rawBody: "not-json", contentType: "text/plain" });
  await page.goto(`${origin}${vitePreviewPath("/contact")}`, { waitUntil: "domcontentloaded" });
  form = page.locator("form").first();
  await fillInquiryForm(form);
  await form.getByRole("button", { name: "Request a Walkthrough" }).click();
  const unconfirmedStatus = page.getByRole("status");
  await unconfirmedStatus.waitFor({ state: "visible" });
  assert.match(await unconfirmedStatus.innerText(), /request submitted; receipt unconfirmed/i);
  assert.equal(await page.getByRole("alert").count(), 0);
  assert.equal(await form.getByLabel("Project details", { exact: true }).inputValue(), "Mock project details for form tests.");
  await context.close();
});

test("a hanging FormSubmit request times out accessibly, preserves fields, and clears its timer", async () => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await context.route("https://www.googletagmanager.com/**", (route) => route.abort());
  const page = await context.newPage();
  await instrumentSubmissionTimeout(page);
  await page.addInitScript(() => {
    const nativeFetch = window.fetch.bind(window);
    window.__formSubmitMockPosts = [];
    window.fetch = (input, init) => {
      if (String(input) === "https://formsubmit.co/ajax/tauropaintingutah@gmail.com") {
        window.__formSubmitMockPosts.push(JSON.parse(String(init?.body ?? "{}")));
        return new Promise((_, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Mock request aborted by timeout", "AbortError"));
          }, { once: true });
        });
      }
      return nativeFetch(input, init);
    };
  });

  await page.goto(`${origin}${vitePreviewPath("/contact")}`, { waitUntil: "domcontentloaded" });
  const form = page.locator("form").first();
  await fillInquiryForm(form);
  const submitButton = form.getByRole("button", { name: "Request a Walkthrough" });
  await submitButton.click();
  const alert = page.getByRole("alert");
  await alert.waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const button = document.querySelector('form button[type="submit"]');
    return button instanceof HTMLButtonElement && !button.disabled;
  });
  assert.equal(await submitButton.isEnabled(), true, "pending state clears after timeout");
  assert.match(await alert.innerText(), /could not confirm whether your request was received/i);
  assert.match(await alert.innerText(), /call us to confirm before sending again/i);
  assert.equal(await alert.getByRole("link", { name: "Call Tauro at (801) 928-9520" }).getAttribute("href"), "tel:8019289520");
  assert.equal(await form.getByLabel("Name", { exact: true }).inputValue(), "Morgan Test");
  assert.equal(await form.getByLabel("Project details", { exact: true }).inputValue(), "Mock project details for form tests.");
  assert.equal(await page.getByRole("status").count(), 0);
  assert.equal(await page.evaluate(() => window.__formSubmitMockPosts.length), 1, "no automatic retry occurs");
  const timers = await submissionTimeoutRecords(page);
  assert.equal(timers.created.length, 1);
  assert.deepEqual(timers.cleared, timers.created);
  await context.close();
});
