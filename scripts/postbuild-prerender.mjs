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
  {
    route: "/locations",
    title: "Painting Service Areas in Utah County | Tauro Painting",
    description:
      "Explore the Utah County cities Tauro Painting serves, including Orem, Provo, Alpine, Highland, Mapleton, Lehi, American Fork, Pleasant Grove, and Springville.",
    canonical: "https://tauropainting.com/locations",
  },
  {
    route: "/locations/orem",
    title: "House Painters in Orem, UT | Tauro Painting",
    description:
      "Tauro Painting provides professional interior and exterior house painting in Orem, Utah. Reliable painters, clean finishes, and free estimates.",
    canonical: "https://tauropainting.com/locations/orem",
  },
  {
    route: "/locations/provo",
    title: "House Painters in Provo, UT | Tauro Painting",
    description:
      "Professional house painters in Provo, Utah. Interior and exterior painting with premium finishes and reliable scheduling.",
    canonical: "https://tauropainting.com/locations/provo",
  },
  {
    route: "/locations/alpine",
    title: "House Painters in Alpine, UT | Tauro Painting",
    description:
      "Interior and exterior house painters serving Alpine, Utah. Premium finishes and reliable painting services by Tauro Painting.",
    canonical: "https://tauropainting.com/locations/alpine",
  },
  {
    route: "/locations/highland",
    title: "House Painters in Highland, UT | Tauro Painting",
    description:
      "Tauro Painting offers interior and exterior painting services in Highland, Utah. Professional results and detailed prep work.",
    canonical: "https://tauropainting.com/locations/highland",
  },
  {
    route: "/locations/mapleton",
    title: "House Painters in Mapleton, UT | Tauro Painting",
    description:
      "Experienced house painters serving Mapleton, Utah. Interior and exterior painting with careful preparation and premium materials.",
    canonical: "https://tauropainting.com/locations/mapleton",
  },
  {
    route: "/locations/lehi",
    title: "House Painters in Lehi, UT | Tauro Painting",
    description:
      "Reliable interior and exterior house painters in Lehi, Utah. Tauro Painting delivers clean finishes and dependable service.",
    canonical: "https://tauropainting.com/locations/lehi",
  },
  {
    route: "/locations/american-fork",
    title: "House Painters in American Fork, UT | Tauro Painting",
    description:
      "Interior and exterior painting services in American Fork, Utah. Tauro Painting provides premium residential painting.",
    canonical: "https://tauropainting.com/locations/american-fork",
  },
  {
    route: "/locations/pleasant-grove",
    title: "House Painters in Pleasant Grove, UT | Tauro Painting",
    description:
      "Professional house painters serving Pleasant Grove, Utah. Interior and exterior painting with reliable scheduling.",
    canonical: "https://tauropainting.com/locations/pleasant-grove",
  },
  {
    route: "/locations/springville",
    title: "House Painters in Springville, UT | Tauro Painting",
    description:
      "Interior and exterior painting services in Springville, Utah. Tauro Painting provides premium finishes and detailed prep.",
    canonical: "https://tauropainting.com/locations/springville",
  },
    {
    route: "/locations/cedar-hills",
    title: "House Painters in Cedar Hills, UT | Tauro Painting",
    description:
      "Professional interior and exterior house painters serving Cedar Hills, Utah. Tauro Painting delivers premium finishes, detailed prep, and reliable service.",
    canonical: "https://tauropainting.com/locations/cedar-hills",
  },
  {
    route: "/locations/woodland-hills",
    title: "House Painters in Woodland Hills, UT | Tauro Painting",
    description:
      "Interior and exterior house painters in Woodland Hills, Utah. Tauro Painting provides careful preparation, premium materials, and refined finishes.",
    canonical: "https://tauropainting.com/locations/woodland-hills",
  },
  {
    route: "/locations/elk-ridge",
    title: "House Painters in Elk Ridge, UT | Tauro Painting",
    description:
      "Reliable interior and exterior house painters serving Elk Ridge, Utah. Tauro Painting offers premium residential painting with clean execution and lasting results.",
    canonical: "https://tauropainting.com/locations/elk-ridge",
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