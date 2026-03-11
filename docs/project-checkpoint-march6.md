Tauro Painting Website — Technical Checkpoint Summary
1. Current stack

Frontend:

React

Vite

Tailwind CSS

React Router

TypeScript is in use in the project (.tsx, vite.config.ts)

Deployment:

GitHub

Vercel

Production domain connected to tauropainting.com

SEO / indexing tooling:

Google Search Console connected

sitemap.xml in place

Static HTML SEO postbuild added for core and city routes

2. Project architecture

Main structure currently looks like this:

src/
  components/
    HeroSection.tsx
    ServicesSection.tsx
    StandardSection.tsx
    ProcessSection.tsx
    ...
  pages/
    Services.tsx
    Projects.tsx
    About.tsx
    Contact.tsx
    Locations.tsx
    Orem.tsx
    Provo.tsx
    Alpine.tsx
    Highland.tsx
    Mapleton.tsx
    Lehi.tsx
    AmericanFork.tsx
    PleasantGrove.tsx
    Springville.tsx
    CedarHills.tsx
    WoodlandHills.tsx
    ElkRidge.tsx
  App.tsx
  main.tsx
  citySeo.ts

public/
  sitemap.xml
  robots.txt (if present in current repo)

scripts/
  postbuild-prerender.mjs

root/
  vite.config.ts
  vercel.json
  package.json

Architecture pattern:

main.tsx holds the single BrowserRouter

App.tsx controls routes + shared SEO/meta logic

src/pages/* contains route-level pages

src/components/* contains reusable sections/components

scripts/postbuild-prerender.mjs generates static HTML metadata per route after build

3. Routing setup

Original state:

One-page scroll site

All sections stacked under /

Anchor navigation

Current state:

True multi-page SPA with React Router

Converted key sections into their own routes

Current routing structure includes:

/

/services

/projects

/about

/contact

/locations

/locations/orem

/locations/provo

/locations/alpine

/locations/highland

/locations/mapleton

/locations/lehi

/locations/american-fork

/locations/pleasant-grove

/locations/springville

/locations/cedar-hills

/locations/woodland-hills

/locations/elk-ridge

Routing notes:

Single BrowserRouter in main.tsx

NavLink / Link used for internal navigation

No nested routers

Routing now supports SEO-targeted city pages instead of a single long homepage

4. SEO setup progress

Implemented:

Route-based unique <title>

Route-based unique meta descriptions

Canonical URLs

Open Graph tags

Twitter tags

sitemap.xml

Google Search Console connected

Static HTML output for important routes after build

City page titles now render correctly per route in production

Core pages now render route-specific HTML in production:

/services

/projects

/about

/contact

City pages now render their own titles correctly in production as well

Important SEO milestone reached:

Google no longer has to rely only on client-side JS to understand core and city routes

Static route-specific HTML is now being served correctly for main pages and city pages

Still recommended / partially done:

robots.txt should be verified in production

LocalBusiness schema exists or was discussed; areaServed enhancement was identified as valuable

Internal linking between city pages and main service pages is still recommended

Search Console re-submission / re-indexing should continue now that production HTML is fixed

5. Files modified recently

Top files touched most recently / most significantly:

src/App.tsx

src/pages/Services.tsx

src/pages/Locations.tsx

src/pages/Orem.tsx

src/pages/Provo.tsx

vite.config.ts

vercel.json

package.json

public/sitemap.xml

scripts/postbuild-prerender.mjs

Also touched:

index.html

src/citySeo.ts

6. Build / dev environment

Build tool:

Vite

Config:

vite.config.ts

React plugin active

alias @ points to ./src

Build scripts:

npm run dev

npm run build

npm run preview

Important build change:

package.json build now runs:

vite build

then node scripts/postbuild-prerender.mjs

This means:

Vite builds the app normally

postbuild script writes route-specific static HTML files into dist

Vercel:

Project connected to GitHub

Production deploys from main

Preview deploys used during SEO render testing

Production: Staged behavior appeared during rollout, then successful promotion to production was completed

Environment variables:

No critical env-based blocker came up in this phase

No special .env dependency was central to current SEO/render work

Git status / workflow:

Main branch restored and stabilized after prerender experiments

Test branch seo-render-test used temporarily for safe render experiments

Successful approach merged back into main

7. CURRENT BLOCKER

Current status:

No active code blocker at the moment

The main rendering/indexing blocker was resolved

Previous blocker that mattered most:

Google was not effectively indexing core pages because production routes were serving SPA-style generic HTML instead of route-specific HTML

Key issues encountered during this phase:

Generic HTML seen in production source:

/services, /projects, /about, /contact were effectively serving home-style HTML in source

Vercel routing conflict:

vercel.json rewrite behavior caused route HTML files to be ignored

Earlier prerender plugin approach failed in Vercel:

deploys hung or timed out even though local build worked

Exact error / failure patterns encountered:

Vercel deploy hanging after successful build output

Preview worked in unique deploy URL before production alias/domain reflected changes

Production: Staged in Vercel before promotion

Earlier in the project:

ts(1117): An object literal cannot have multiple properties with the same name

duplicate route key in metaByPath

Earlier install issue:

ERESOLVE unable to resolve dependency tree

react-helmet-async incompatible with React 19

Files involved in the blocker phase:

vercel.json

package.json

scripts/postbuild-prerender.mjs

src/App.tsx

index.html

vite.config.ts

What changed right before the main render/indexing issue was resolved:

Added manual postbuild static SEO generation

Adjusted vercel.json

Verified preview deploy using unique deployment URL

Promoted staged production deployment

8. Current objective

What we were trying to accomplish:

Make Google able to index:

/services

/projects

/about

/contact

all /locations/* city pages

Ensure each page serves its own route-specific HTML metadata in production

Turn the site from a client-side SPA shell into something search engines can understand per route

Expand Utah County local SEO through city pages with real indexable HTML

9. Next milestone

Next planned milestone:

Strengthen local SEO now that rendering is fixed

Recommended next steps:

Re-submit updated sitemap in Google Search Console

Request indexing for a few priority URLs:

/services

/projects

/locations/provo

/locations/orem

/locations/lehi

Add stronger internal linking:

from /services to city pages

from city pages to nearby city pages

Add or improve LocalBusiness schema with areaServed

Verify robots.txt

Run mobile + PageSpeed QA

Confirm contact form / conversion flow is production-ready

Practical next milestone statement:

Complete SEO launch polish and indexing acceleration for core + city pages


CURRENT BLOCKER
1. Exact error message(s)

There is currently no active runtime or build error in the terminal or browser console.
The previous blocker was a production rendering mismatch, where Vercel served the SPA fallback instead of route-specific HTML.

Observed behavior:

view-source:https://tauropainting.com/projects

showed:

<title>Tauro Painting | Professional House Painters in Utah</title>

instead of the route-specific title:

<title>Painting Projects in Utah County | Tauro Painting</title>

Meanwhile the preview deployment URL showed the correct HTML.

2. Exact file name(s) involved

Files involved in the issue:

vercel.json
package.json
scripts/postbuild-prerender.mjs

Primary routing conflict came from:

vercel.json
3. Code section where the error occurred

Problematic section in vercel.json:

{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}

This rewrite rule forced all routes to serve the SPA entry file.

This caused:

/services
/projects
/about
/contact
/locations/*

to ignore the static HTML files generated during the build.

4. What we changed right before the error appeared

Right before the issue was discovered, we introduced:

Static HTML generation after build

scripts/postbuild-prerender.mjs

executed via:

"build": "vite build && node scripts/postbuild-prerender.mjs"

The script created files such as:

dist/services/index.html
dist/projects/index.html
dist/locations/provo/index.html

Local builds confirmed the files existed.

However, production still served the SPA fallback.

5. Most likely root cause

The rewrite rule in vercel.json:

/(.*) → /index.html

overrode the filesystem routes generated in dist.

Vercel therefore ignored:

dist/services/index.html
dist/projects/index.html
dist/locations/*

and always served the root HTML.

This created a production-only SEO rendering mismatch.

6. Smallest safe fix to try next

Ensure Vercel respects generated route files before falling back to SPA routing.

Update vercel.json so rewrites only apply when a file does not exist.

Example safe rewrite rule:

{
  "rewrites": [
    {
      "source": "/((?!.*\\.).*)",
      "destination": "/index.html"
    }
  ]
}

This allows Vercel to serve:

dist/services/index.html
dist/projects/index.html
dist/locations/*

while still supporting SPA routing for unknown paths.