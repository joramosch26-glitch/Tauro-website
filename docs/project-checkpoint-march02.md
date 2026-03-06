🧱 Tauro Painting Website — Technical Checkpoint Summary
1️⃣ Current Stack
Frontend Framework

React 19

TypeScript

Build Tool

Vite

Styling

Tailwind CSS

Custom utility classes

Premium dark/light section contrast

Subtle gradients & editorial layout structure

UI Utilities

shadcn/ui

lucide-react (icons)

Routing

react-router-dom

True multi-page SPA (no longer single-scroll layout)

Deployment

GitHub

Vercel (production)

Custom domain connected

DNS verification via Wix

2️⃣ Routing Setup (Multi-Page Conversion)
Original State

One-page scroll layout

Sections stacked on /

Anchor navigation

Current State

Converted to structured multi-page SPA:

Main Routes (in src/App.tsx)
/                → HomeRoute
/services        → Services
/projects        → Projects
/about           → About
/contact         → Contact
/locations       → Locations (Hub)
/locations/orem  → Orem (City Page)
*                → fallback HomeRoute
Architecture Structure
App.tsx
  ├── HomeRoute.tsx
  │     ├── HeroSection.tsx
  │     ├── ServicesSection.tsx
  │     ├── StandardSection.tsx
  │     ├── ProcessSection.tsx
  │     └── etc.
  ├── Services.tsx
  ├── Projects.tsx
  ├── About.tsx
  ├── Contact.tsx
  ├── Locations.tsx
  └── Orem.tsx

Navigation uses:

<NavLink> for active styling

<Link> for internal navigation

No nested routers

Single <BrowserRouter> in main.tsx

3️⃣ SEO Setup Progress
✅ Implemented
Dynamic Meta Handling (inside App.tsx)

Route-based <title>

Route-based <meta name="description">

Dynamic canonical URLs

Dynamic Open Graph tags

Dynamic Twitter tags

Trailing slash normalization

Structured Data

JSON-LD LocalBusiness

Address: Orem, UT

Telephone included

Social profiles included

No schema validation errors

Search Console

Domain Property verified via DNS TXT

Sitemap submitted

Sitemap successfully read

Manual indexing requested for:

/

/services

/projects

/locations

/locations/orem

Sitemap

Includes:

/
services
projects
about
contact

(Locations will be added in next update)

4️⃣ Files Modified Recently
Core
src/App.tsx

Dynamic meta system

Canonical logic

OG/Twitter upsert logic

JSON-LD injection

Route expansion for locations

Fixed duplicate metaByPath key error

src/pages/Services.tsx

H1 optimized for Utah County

Reduced redundant text

Added internal link to /locations

Cleaned visual hierarchy

src/components/HeroSection.tsx

Home H1 optimized

Geographic targeting added

Maintained premium design tone

src/pages/Locations.tsx

Created hub page

Links to Orem

Scalable layout structure

src/pages/Orem.tsx

First city landing page

Optimized H1

Localized content

CTA included

5️⃣ Current Errors We Were Fixing
Error 1: Duplicate Object Key

File:

src/App.tsx

Issue:

ts(1117) An object literal cannot have multiple properties with the same name

Cause:
"/locations/orem" appeared twice in metaByPath.

Fix:
Removed duplicate key.

Error 2: React Helmet Installation Conflict

Attempted:

npm install react-helmet-async

Error:
Peer dependency conflict with React 19.

Resolution:
Abandoned Helmet.
Used manual document.title + meta injection (cleaner and stable).

Error 3: Visual Redundancy in Services Intro

File:

src/pages/Services.tsx

Issue:
Too many geographic mentions stacked visually.

Fix:

Reduced text duplication

Kept single strong paragraph

Added single amber link to /locations

6️⃣ What We Were Trying to Achieve When Errors Appeared
Phase: Geographic Expansion

Goal:
Expand SEO targeting from:

General Utah → Utah County → Specific Cities

First city:

/locations/orem

Strategy:

Create hub /locations

Add first city page

Link internally from Services

Scale to Provo, Lehi, etc.

Error appeared while:

Adding route-specific meta entries

Expanding metaByPath

Scaling structure for city-level pages

📍 Current Project State

You now have:

Multi-page SPA architecture

Dynamic SEO system

Verified domain

Structured data active

City expansion structure started

Clean internal linking

Scalable locations hub

First city page live

No active TypeScript errors.
No runtime errors.
No schema errors.

🎯 Next Phase (Pending)

City expansion:

/locations/provo
/locations/lehi
/locations/american-fork
/locations/pleasant-grove

Using the same structured process:

Unique H1

Unique meta

Localized content

Internal linking

Scalable architecture

This is now a properly structured, scalable, SEO-ready architecture — not a template site.

When you open the new chat, we resume at:

Create /locations/provo following Orem model, but stronger.

Ready when you are.

🚧 CURRENT BLOCKER
1️⃣ File: src/App.tsx
❌ Error Message
ts(1117): An object literal cannot have multiple properties with the same name
📍 Location

Inside the metaByPath object within the SEO useEffect.

🔎 Most Likely Cause

The route key:

"/locations/orem"

was declared twice inside the same metaByPath object while expanding city-level SEO routes.

JavaScript/TypeScript objects cannot contain duplicate keys.
This caused TypeScript to throw error ts(1117).

✅ Resolution Applied

Removed the duplicate "/locations/orem" entry, keeping only one properly defined route configuration.

2️⃣ File: package.json (Dependency Installation Attempt)
❌ Error Message
ERESOLVE unable to resolve dependency tree
peer react@"^16.8.0 || ^17.0.0 || ^18.0.0" from react-helmet-async@2.0.5
📍 Triggered By

Attempting to run:

npm install react-helmet-async
🔎 Most Likely Cause

Project is using:

React 19

But react-helmet-async@2.0.5 only supports React 16–18 as peer dependencies.

This caused a dependency tree resolution conflict.

✅ Resolution Applied

Abandoned Helmet installation.

Maintained existing dynamic SEO system using:

document.title

Dynamic <meta> injection

Canonical + OG handling

JSON-LD injection

This approach is stable and fully compatible with React 19.

📌 Current Status

No active TypeScript errors.

No dependency conflicts.

SEO system functioning correctly.

Routing stable.

City expansion structure ready for continuation.

System currently stable and unblocked.