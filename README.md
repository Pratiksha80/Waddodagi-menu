<<<<<<< HEAD
<<<<<<< HEAD
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
2. Copy `.env.example` to `.env` and fill the required server settings; current app code does not use `GEMINI_API_KEY`.
3. Run the app:
   `npm run dev`

## Owner authentication and menu storage

Configure `OWNER_EMAIL`, `OWNER_PASSWORD`, `OWNER_NAME`, and a random `SESSION_SECRET` of at least 32 characters in `.env`. These are read by the server and must not use a `VITE_` prefix. Owner sign-in is verified by the server and uses a signed, eight-hour, HTTP-only, same-site cookie. The browser does not store the password or a trusted session flag. Configure the same server-only variables in the production host environment and run `npm run build` followed by `npm start`.

Categories and products are stored in PostgreSQL through the Express server. For Supabase on Render, open the Supabase project's **Connect** dialog and select **Session pooler**; this connection is IPv4-compatible. Add the full connection string as `DATABASE_URL` in the Render web service environment, replacing `[YOUR-PASSWORD]` with the database password and URL-encoding reserved password characters. Also set `OWNER_EMAIL`, `OWNER_PASSWORD`, `OWNER_NAME`, and a random `SESSION_SECRET` of at least 32 characters. Keep these server-side; never use a `VITE_` prefix. The server creates the menu tables on startup. Public customers can read the menu; changes require the owner session cookie. Existing menu data saved in browser localStorage is not automatically migrated; copy/re-enter it after the shared database is live.
=======
# mithai-namkeen-digital-menu
>>>>>>> 8929a18253c0e2e0805908062df2348fc4f9e2ba
=======

>>>>>>> 2850cdabf9f703d4d382afbdff3199cdcc4c6b4d
