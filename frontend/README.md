# Sensible Soccer ROM Editor - Web Interface

This is the web interface for the Sensible Soccer ROM Editor, built with **React + Vite**. ROM processing runs locally in your browser. Optional Google Analytics runs only after a visitor accepts analytics cookies; ROM contents and team edits are not sent to analytics.

## Analytics and cookie preferences

The banner uses [CookieConsent](https://cookieconsent.orestbida.com/), bundled locally through npm. Visitors can accept, reject, or manage optional analytics and revisit their choice using **Cookie settings** in the footer. Choices last 180 days. Withdrawing consent disables GA collection and clears its cookies without reloading the editor.

Production builds use `G-0RKDRT3Y45` from `.env.production`. Development has analytics disabled by default. To test locally, copy `.env.example` to `.env.local` and set `VITE_GA_MEASUREMENT_ID` to your web stream's `G-...` measurement ID. Deployment environment variables can override the production ID; rebuild after changing them. This ID is public, not a secret. A missing or invalid ID disables analytics and removes the optional analytics category.

In the GA web stream settings, disable Enhanced Measurement if you want only the page view configured here (and to avoid automatic form, download, or URL-based events). Advertising signals and ad personalization are disabled in code. No Google script is loaded before opt-in. After opting in, verify the visit in GA Realtime; rejection should produce no Google Analytics requests. Use a fresh browser profile to verify the initial banner, then test withdrawal and a reload to verify the saved choice.

## Quick Start

### Prerequisites

- Node.js 18+

### Setup

From the `frontend` directory, install the dependencies:

```bash
npm install
```

### Starting the Application

Start the development server:

```bash
npm run dev
```

The application will start on http://localhost:5173

### Usage

1. Open your browser to http://localhost:5173
2. **Step 1**: Upload your Sensible Soccer ROM file (.md or .bin)
3. **Step 2**: Review the ROM information and download the `teams.json` file
4. **Step 3**: Edit the JSON file with your changes (team names, players, tactics, etc.)
5. **Step 4**: Upload your modified `teams.json` file
6. **Step 5**: Review validation results (errors must be fixed, warnings are optional)
7. **Step 6**: Download your modified ROM file

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
