# Sensible Soccer ROM Editor - Web Interface

This is the web interface for the Sensible Soccer ROM Editor, built with **React + Vite**. ROM processing runs locally in your browser. Optional Google Analytics runs only after a visitor accepts analytics cookies; ROM contents and team edits are not sent to analytics.

## Analytics and cookie preferences

The banner uses [CookieConsent](https://cookieconsent.orestbida.com/), bundled locally through npm. Visitors can accept, reject, or manage optional analytics and revisit their choice using **Cookie settings** in the footer. Choices last 180 days. Withdrawing consent disables GA collection and clears its cookies without reloading the editor.

Production builds use `G-0RKDRT3Y45` from `.env.production`. Development has analytics disabled by default. To test locally, copy `.env.example` to `.env.local` and set `VITE_GA_MEASUREMENT_ID` to your web stream's `G-...` measurement ID. Deployment environment variables can override the production ID; rebuild after changing them. This ID is public, not a secret. A missing or invalid ID disables analytics and removes the optional analytics category.

In the GA web stream settings, disable Enhanced Measurement if you want only the page view configured here (and to avoid automatic form, download, or URL-based events). Advertising signals and ad personalization are disabled in code. No Google script is loaded before opt-in. After opting in, verify the visit in GA Realtime; rejection should produce no Google Analytics requests. Use a fresh browser profile to verify the initial banner, then test withdrawal and a reload to verify the saved choice.

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
current document. The optional music player has independent error handling.

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
Keep development/test servers restricted to trusted interfaces. AudioWorklet-based
MOD playback needs a secure context (HTTPS or localhost); ordinary editing does not
require audio support. Unreachable legacy admin and six-step upload components have
been removed; the current application does not require an API backend.
