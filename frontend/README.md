# Sensible Soccer ROM Editor - Web Interface

This is the web interface for the Sensible Soccer ROM Editor, built with **React + Vite**. ROM processing runs locally in your browser. Google Analytics loads automatically when configured; ROM contents and team edits are not sent to analytics.

## Analytics

Google Analytics initializes on page load without a cookie notice. Production builds use `VITE_GA_MEASUREMENT_ID` from `.env.production`. A missing or invalid ID disables analytics; development has no ID configured by default.

To test locally, set `VITE_GA_MEASUREMENT_ID` in `.env.development.local` to your test web stream's `G-...` measurement ID and restart Vite. Use `.env.production.local` or deployment environment variables to override the production ID, then rebuild. This ID is public, not a secret.

Advertising signals and ad personalization are disabled in code. The initial page view excludes URL parameters, fragments, and the referrer. In the GA web stream settings, disable Enhanced Measurement if you want only the page view configured here (and to avoid automatic form, download, or URL-based events).

## Quick Start

### Prerequisites

- Node.js 26 recommended (supported: 22.22.2+ on 22.x, 24.15.0+ on 24.x, or 26+)

### Setup

From the `frontend` directory, install the dependencies:

```bash
npm ci
```

### Starting the Application

Start the development server:

```bash
npm run dev
```

The application will start on http://localhost:5173/sensi/

### Usage

1. Open the app and choose **Open ROM file** (or drag in a `.md`/`.bin` ROM).
2. Select a category and team. Edit names, formation, players, and kits directly.
3. Use **Export JSON** to save the current document, or **Import JSON** to replace it with validated team data.
4. Correct validation errors and keep within the displayed team-data byte budget.
5. Choose **Download Modified ROM**. The writer validates the exact current document and updates the ROM checksum.
6. **Start Over** resets the document and cancels pending imports. Opening another ROM also starts a new editor document.

Edits are held in memory; export JSON before closing or refreshing the page. All
primary editing controls work with the keyboard. Import errors preserve the
current document.

## Development

The frontend is built with React and uses Vite for fast development. ROM decoding and encoding are handled directly in the browser using JavaScript/TypeScript.

The pixel font, Press Start 2P, is bundled through Fontsource and served from the site's own assets. Rendering does not depend on access to Google Fonts.

Key files and directories:
- `src/App.jsx` - Main application component with step flow
- `src/components/` - React components for each step
- `src/lib/` - Client-side ROM logic, decoding, and encoding

## Building for Production

To build the frontend for production:

```bash
npm run build
```

This creates a `dist/` folder with static files. Since the app is entirely client-side, you can host these files on any static web hosts (e.g., GitHub Pages, Vercel, Netlify, or AWS S3) without needing a backend server.

## Checks and deployment

Run `npm run check` for schema, lint, typecheck, frontend tests, and production
build. `npm run test:e2e` exercises the production build in
Chromium; install it first with `npx playwright install chromium` or set
`CHROMIUM_PATH` to an existing executable. CI also runs the full dependency audit.

The Vite base is `/sensi/`: serve `dist/` at that URL prefix. For another prefix,
change `base` in `vite.config.js` and rebuild. `npm run preview` serves the built
app locally at `/sensi/`; it is a verification server, not the hosting deployment.
Keep development/test servers restricted to trusted interfaces. Unreachable legacy admin and six-step upload components have
been removed; the current application does not require an API backend.

## Search visibility

The page heading, introduction, guide and footer are static HTML in `index.html`;
React mounts the editor inside `#root`. Keep the global stylesheet linked from
HTML so the guide remains styled without JavaScript. Vite replaces
`%APP_VERSION%` with the package version at development/build time.

The canonical and Open Graph URLs use `https://maidavale.org/sensi/`.
`public/sitemap.xml` lists that same URL. If the deployment path changes, update
these along with Vite's base. See [SEO_ACTIONS.md](../SEO_ACTIONS.md) for the
verification results, root-site changes and publishing/Search Console checklist.
