import fs from "fs";
import path from "path";

const distDir = path.resolve("dist");
const baseHtmlPath = path.join(distDir, "index.html");

if (!fs.existsSync(baseHtmlPath)) {
  console.error("postbuild-prerender: dist/index.html not found");
  process.exit(1);
}

const baseHtml = fs.readFileSync(baseHtmlPath, "utf8");

const routes = [
  {
    route: "/",
    title: "House Painters in Utah County | Tauro Painting",
    description:
      "Premium interior and exterior house painters in Utah County. Serving Orem, Provo, Lehi, and surrounding areas. Free estimates.",
    canonical: "https://tauropainting.com/",
  },
  {
    route: "/services",
    title: "Painting Services in Utah County | Tauro Painting",
    description:
      "Interior painting, exterior painting, cabinet refinishing, and detailed prep across Utah County. Fast scheduling and free estimates.",
    canonical: "https://tauropainting.com/services",
  },
  {
    route: "/projects",
    title: "Painting Projects in Utah County | Tauro Painting",
    description:
      "Explore recent residential and commercial painting projects completed across Utah County with premium finishes and meticulous prep.",
    canonical: "https://tauropainting.com/projects",
  },
  {
    route: "/about",
    title: "About Tauro Painting | Utah County",
    description:
      "Learn more about Tauro Painting, our standards, and our approach to premium interior and exterior painting in Utah County.",
    canonical: "https://tauropainting.com/about",
  },
  {
    route: "/contact",
    title: "Contact Tauro Painting | Free Estimate",
    description:
      "Request a free painting estimate from Tauro Painting. Interior and exterior house painters serving Utah County.",
    canonical: "https://tauropainting.com/contact",
  },
];

function escapeAttr(value) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function removeExistingSeoTags(html) {
  return html
    .replace(/<title>.*?<\/title>\s*/is, "")
    .replace(/<meta\s+name="description"[^>]*>\s*/gi, "")
    .replace(/<link\s+rel="canonical"[^>]*>\s*/gi, "")
    .replace(/<meta\s+property="og:type"[^>]*>\s*/gi, "")
    .replace(/<meta\s+property="og:title"[^>]*>\s*/gi, "")
    .replace(/<meta\s+property="og:description"[^>]*>\s*/gi, "")
    .replace(/<meta\s+property="og:url"[^>]*>\s*/gi, "")
    .replace(/<meta\s+property="og:image"[^>]*>\s*/gi, "")
    .replace(/<meta\s+name="twitter:image"[^>]*>\s*/gi, "")
    .replace(/<meta\s+name="twitter:card"[^>]*>\s*/gi, "")
    .replace(/<meta\s+name="twitter:title"[^>]*>\s*/gi, "")
    .replace(/<meta\s+name="twitter:description"[^>]*>\s*/gi, "");
}

function injectSeoHead(html, meta) {
  const cleanHtml = removeExistingSeoTags(html);

  const seoBlock = `
    <title>${escapeAttr(meta.title)}</title>
    <meta name="description" content="${escapeAttr(meta.description)}" />
    <link rel="canonical" href="${escapeAttr(meta.canonical)}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeAttr(meta.title)}" />
    <meta property="og:description" content="${escapeAttr(meta.description)}" />
    <meta property="og:url" content="${escapeAttr(meta.canonical)}" />
    <meta property="og:image" content="https://tauropainting.com/og.jpg" />
    <meta name="twitter:image" content="https://tauropainting.com/og.jpg" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeAttr(meta.title)}" />
    <meta name="twitter:description" content="${escapeAttr(meta.description)}" />
  `;

  return cleanHtml.replace("</head>", `${seoBlock}\n</head>`);
}

for (const meta of routes) {
  const finalHtml = injectSeoHead(baseHtml, meta);

  const outputPath =
    meta.route === "/"
      ? path.join(distDir, "index.html")
      : path.join(distDir, meta.route.slice(1), "index.html");

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, finalHtml, "utf8");

  console.log(`Generated: ${outputPath}`);
}