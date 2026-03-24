# Sensible Soccer ROM Editor - Web Interface

This is the web interface for the Sensible Soccer ROM Editor, built with **React + Vite**. The entire application runs client-side in your browser, meaning no data is sent to any server.

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

