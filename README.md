<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/6b95ba6c-1902-4b1e-8be5-2b73bfcb8cad

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Owner authentication and menu storage

Configure `OWNER_EMAIL`, `OWNER_PASSWORD`, `OWNER_NAME`, and a random `SESSION_SECRET` of at least 32 characters in `.env.local`. These are read by the server and must not use a `VITE_` prefix. Owner sign-in is verified by the server and uses a signed, eight-hour, HTTP-only, same-site cookie. The browser does not store the password or a trusted session flag. Configure the same server-only variables in production and run `npm run build` followed by `npm start`.

Categories and products currently persist in this browser's `localStorage`, including after refresh. They do not sync across devices or browsers. For a shared live menu, replace the local repository with a database and server-protected admin data endpoints.
