import fs from "fs";
import path from "path";

const distDir = path.resolve("dist");
const baseHtmlPath = path.join(distDir, "index.html");
const seoPath = path.resolve("src", "seo.json");

if (!fs.existsSync(baseHtmlPath)) {
  console.error("postbuild-prerender: dist/index.html not found");
  process.exit(1);
}

const baseHtml = fs.readFileSync(baseHtmlPath, "utf8");
const seo = JSON.parse(fs.readFileSync(seoPath, "utf8"));
const routes = [...seo.routes, seo.notFound];

function escapeAttr(value) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function removeExistingSeo(html) {
  return html
    .replace(/<title>.*?<\/title>\s*/is, "")
    .replace(/<meta\s+name="description"[^>]*>\s*/gi, "")
    .replace(/<meta\s+name="robots"[^>]*>\s*/gi, "")
    .replace(/<link\s+rel="canonical"[^>]*>\s*/gi, "")
    .replace(/<meta\s+property="og:[^"]+"[^>]*>\s*/gi, "")
    .replace(/<meta\s+name="twitter:[^"]+"[^>]*>\s*/gi, "")
    .replace(/<script\s+id="ld-json-business"[^>]*>.*?<\/script>\s*/gis, "")
    .replace(/<script\s+id="ld-json-page"[^>]*>.*?<\/script>\s*/gis, "");
}

function buildPageSchema(meta) {
  const breadcrumbs = seo.pageSchemas[meta.route];
  if (!breadcrumbs) return "";

  const webpageId = `${meta.canonical}#webpage`;
  const breadcrumbId = `${meta.canonical}#breadcrumb`;
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": webpageId,
        url: meta.canonical,
        name: meta.title,
        description: meta.description,
        about: { "@id": seo.business["@id"] },
        breadcrumb: { "@id": breadcrumbId },
      },
      {
        "@type": "BreadcrumbList",
        "@id": breadcrumbId,
        itemListElement: breadcrumbs.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          item: item.item,
        })),
      },
    ],
  };

  return `<script id="ld-json-page" type="application/ld+json">${JSON.stringify(schema).replace(/</g, "\\u003c")}</script>`;
}

function injectSeoHead(html, meta) {
  const cleanHtml = removeExistingSeo(html);
  const robots = meta.robots ?? "index,follow";
  const businessSchema = `<script id="ld-json-business" type="application/ld+json">${JSON.stringify(seo.business).replace(/</g, "\\u003c")}</script>`;
  const pageSchema = buildPageSchema(meta);
  const seoBlock = `
    <title>${escapeAttr(meta.title)}</title>
    <meta name="description" content="${escapeAttr(meta.description)}" />
    <meta name="robots" content="${escapeAttr(robots)}" />
    <link rel="canonical" href="${escapeAttr(meta.canonical)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${escapeAttr(seo.siteName)}" />
    <meta property="og:title" content="${escapeAttr(meta.title)}" />
    <meta property="og:description" content="${escapeAttr(meta.description)}" />
    <meta property="og:url" content="${escapeAttr(meta.canonical)}" />
    <meta property="og:image" content="${escapeAttr(seo.socialImage.url)}" />
    <meta property="og:image:width" content="${seo.socialImage.width}" />
    <meta property="og:image:height" content="${seo.socialImage.height}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeAttr(meta.title)}" />
    <meta name="twitter:description" content="${escapeAttr(meta.description)}" />
    <meta name="twitter:image" content="${escapeAttr(seo.socialImage.url)}" />
  `;

  return cleanHtml.replace("</head>", `${seoBlock}\n${businessSchema}\n${pageSchema}\n</head>`);
}

for (const meta of routes) {
  const finalHtml = injectSeoHead(baseHtml, meta);
  const outputPath = meta.route === "/"
    ? path.join(distDir, "index.html")
    : meta.route === "/404"
      ? path.join(distDir, "404.html")
      : path.join(distDir, meta.route.slice(1), "index.html");

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, finalHtml, "utf8");
  console.log(`Generated: ${outputPath}`);
}
