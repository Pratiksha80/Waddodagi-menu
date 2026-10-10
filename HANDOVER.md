# Waddodagi digital menu: project handover

Updated: 10 October 2026

## 1. What this project does

This is Waddodagi Sweets and Snacks' digital menu. Customers open a public menu on a phone or computer, usually by scanning one QR code. The owner uses a password-protected admin area to manage menu categories and products. The intended production design stores the shared menu in PostgreSQL so a change made on one device is available to other devices.

It is a catalogue, not an ordering or payment system. It has no cart, checkout, online payment, delivery workflow, customer accounts, or separate draft/publish workflow. Saving an owner change writes it to the live menu.

## 2. Main technologies and request path

- **Browser UI:** React 19 + TypeScript, Vite 8, Tailwind CSS 4, Lucide icons, and Motion.
- **Web/API server:** Express 4, started with `tsx` from `server.ts`.
- **Database driver:** `pg` (node-postgres) connects from the server to PostgreSQL using `DATABASE_URL`.
- **Database host:** the configured project is Supabase PostgreSQL. The browser does not connect directly to Supabase and there is no Supabase JavaScript client in the data path.
- **Production serving:** build the React site into `dist`; Express serves those files and falls back to `index.html` for UI routes.
- **Local development:** Express starts Vite in middleware mode, serving the UI and `/api` routes on the same origin (normally `http://localhost:3000`).

The normal data path is:

1. A browser loads the React app from Express/Vite.
2. `MenuContext` requests menu data through `src/services/database.ts`.
3. That service calls the same-origin Express API (`/api/menu`).
4. Express reads or writes Supabase PostgreSQL using the server-only `DATABASE_URL`.
5. Customer and admin screens render the returned categories and products.

Keeping the browser and API on the same origin is why the menu can be shared without putting a database password in the client bundle.

## 3. Pages and routes

| URL | Purpose |
| --- | --- |
| `/` or `/menu` | Customer menu landing page; `/` resolves to the menu. |
| `/menu/category/:id` | Customer view of one category. |
| `/menu/product/:id` | Product details and share link. |
| `/admin/login` | Owner sign-in. |
| `/admin` or `/admin/dashboard` | Counts, recent menu items, category creation, and reset action. |
| `/admin/categories` | Create/edit/delete categories and see assigned product counts. |
| `/admin/products` | Search/filter, change availability, select, and delete products. |
| `/admin/products/add` | Add a product, choose category/status, upload/capture an image, and save. |
| `/admin/products/edit/:id` | Edit or delete a product. |

`src/App.tsx` contains the custom route switch. `NavigationContext.tsx` uses the History API; this is not React Router. Express' production fallback makes direct navigation to the UI routes work.

## 4. Menu data model and persistence

There are two PostgreSQL tables, created by `ensureMenuTables()` in `server.ts` during server startup if they do not exist:

- `categories`: `id`, unique `name`, `description`, `created_at`, `updated_at`.
- `products`: `id`, `name`, `category_id`, `price`, `description`, `image_url`, `status`, `created_at`, `updated_at`. `category_id` references a category; category deletion is restricted while products still use it. Price is non-negative `NUMERIC(10,2)`. Status is `available` or `out_of_stock`.

The live Supabase database currently responds from the local app. A read-only check during this handover found **1 category and 1 product** in it.

### How reads and writes work

- `GET /api/menu` returns categories and products from PostgreSQL and sends `Cache-Control: no-store`.
- `PUT /api/menu` accepts a complete `{ categories, products }` snapshot. It validates values and writes the new snapshot in a transaction using temporary tables, then replaces the current rows.
- `dbService` implements add/edit/delete operations by first loading the complete snapshot, changing it in browser code, and sending the complete snapshot back. Every successful owner action is therefore live immediately.
- `MenuContext` initially loads data, refreshes when the tab gets focus, and polls every 15 seconds. Other open devices should see successful changes within roughly 15 seconds, or when they return to the tab.
- A failed request displays an error; production refuses to fall back to memory when the database is missing. In local development, if `DATABASE_URL` is absent, the server has an in-memory fallback, which is temporary and is lost when the process restarts.

### Important data caveat

This is whole-menu replacement, not individual-row writes. Two owners editing at nearly the same time from stale screens can overwrite each other's changes. A future improvement would use per-category/per-product endpoints or Supabase/Postgres mutations and conflict handling.

## 5. Owner authentication

The owner account is configured with server environment variables, not a users table:

- `OWNER_EMAIL`
- `OWNER_PASSWORD`
- `OWNER_NAME`
- `SESSION_SECRET` (at least 32 characters)

`POST /api/auth/login` verifies the configured single owner and returns an HTTP-only signed cookie. The cookie is same-site, expires after eight hours, and is marked `secure` in production. `GET /api/auth/session` checks the browser session; `/api/menu` writes and all `/admin/...` pages require the owner session. Public customers can read the menu. There is no Supabase Auth integration or multi-user role management; `manager` appears in a type but is not a configured account role.

For local development only, the server has fallback credentials if owner env values are empty. Never depend on these in production. The login attempt counter is in process memory, so it resets when the server restarts and is not shared across instances.

## 6. Images, QR code, and customer updates

### Product images

The add/edit pages use `FileReader.readAsDataURL`, so an uploaded or captured image becomes a base64 data URL stored in the `products.image_url` PostgreSQL text column. There is no object-storage bucket configured. The Express JSON body limit defaults to `100mb` and can be set with `JSON_BODY_LIMIT`; this limits the entire JSON request, not each image. Base64 adds size overhead, and because writes send the whole menu snapshot, large catalogs/images make every save and read heavier. This does **not** mean arbitrary-size uploads are supported. A production-ready image path should store files in Supabase Storage or another object store and keep only the public image URL in PostgreSQL.

### Permanent QR code

`src/components/admin/QrCodeModal.tsx` currently hardcodes `https://waddodagi-menu.onrender.com/menu`. The QR is generated locally as an SVG by `qrcode` in `QrCodeSvg.tsx`; it does not expire. It opens the menu page, which requests current API/database data. Menu changes do not require a new QR as long as that public hostname and `/menu` path stay the same. If the app moves to a new domain, the QR target must be updated and the printed code replaced (or the old domain must redirect).

## 7. Environment files and deployment configuration

Environment variable names are listed in `.env.example`; it contains placeholders only. `.gitignore` ignores `.env*` except `.env.example`, so `.env.local` and `.env.production` should not be committed. The actual database password is deliberately not repeated in this document.

The local `.env.local` currently uses the valid direct Supabase database endpoint. That direct connection was tested from this laptop and succeeded. The local app's `/api/menu` returned HTTP 200 and the database contained 1 category and 1 product during the handover check.

The local `.env.production` is **not ready**: its database URL still has `YOUR_POOLER_HOST`. It is a local ignored file and Render will not automatically read or upload it. Render must have the variables entered in the web service's **Environment** settings (or be explicitly configured to load a secret file, which this project currently does not do).

Expected Render commands from the current `package.json` are:

- Build: `npm install` (or `npm ci`) then `npm run build`
- Start: `npm start`
- The service listens on `process.env.PORT` and `0.0.0.0`.

No `render.yaml` is present in the repository, so the actual service build/start settings and environment values live in the Render dashboard. The repo has a GitHub remote and is on `main`; Render redeploy behavior depends on its dashboard auto-deploy setting.

Production needs at least `NODE_ENV=production`, `DATABASE_URL`, `DATABASE_SSL=true`, `OWNER_EMAIL`, `OWNER_PASSWORD`, `OWNER_NAME`, and a unique `SESSION_SECRET` of 32+ characters. `JSON_BODY_LIMIT` is optional and defaults to `100mb`. Never prefix server secrets with `VITE_`.

## 8. The cloud/free-tier issue and the actual connection failure

The project does **not** require the web host and database to be the same vendor or to have a paid private-network/database integration. The Node server can connect to an external PostgreSQL database over the public network by setting `DATABASE_URL`. Free-tier hosting limits still matter, but a free plan does not inherently mean an external database URL cannot be used.

The known Render failure was `connect ENETUNREACH` to an IPv6 address on port `5432` while connecting to Supabase's direct host (`db.<project>.supabase.co`). That is a network address-family/reachability issue, not evidence that the password was wrong or that a paid Render-to-database link is required. Supabase documents direct endpoints as IPv6-only by default and its shared **Session pooler** as IPv4-compatible. The exact pooler hostname must be copied from the Supabase project's **Connect → Session pooler** screen; the pooler cluster number cannot safely be guessed. This code intentionally rejects a Supabase direct host at production startup to avoid the known Render failure. [Supabase connection docs](https://supabase.com/docs/guides/database/connecting-to-postgres)

Current plan limitations to account for:

- Render Free web services spin down after 15 minutes without traffic; waking can take about a minute. The filesystem is ephemeral, so local uploads/files are not durable. Render also documents that unusually high service-initiated public traffic can lead to suspension. [Render Free services](https://render.com/docs/free)
- Render Free Postgres is an alternative if desired, but that plan currently expires 30 days after creation and has no backups; it is not a permanent free production database. [Render Free services](https://render.com/docs/free)
- Supabase Free projects can be paused after a week with insufficient database activity. This can interrupt the menu until the project is restored. [Supabase project pausing](https://supabase.com/docs/guides/platform/free-project-pausing)

So the practical path for testing is: keep the app on Render, keep the database on Supabase, and configure Render's `DATABASE_URL` with the exact Supabase Session pooler URI. This is an external database connection, not a Render private-network link. After setting it, redeploy and inspect startup logs and `/api/menu` from the public URL.

## 9. Known issues and cleanup items

1. **Price comes back as a string from PostgreSQL.** The `pg` driver returns `NUMERIC` as a string by default; this was verified in the live local API response (`typeof price === "string"`). The UI types `price` as `number` and calls `.toFixed()` in customer cards, product details, and admin listings. Convert prices to `Number` at the API boundary (or use a consistent numeric parser) before relying on these screens with database data. This is a likely current runtime bug.
2. **Production pooler URL is unfinished.** `.env.production` contains a placeholder host. Render's service environment also needs its actual `DATABASE_URL` updated; changing a local env file has no effect on Render.
3. **README contains merge-conflict markers.** `README.md` still contains `<<<<<<<`, `=======`, and `>>>>>>>` text. It does not affect app execution but should be cleaned up; parts of it also describe the old AI Studio template.
4. **Two schema definitions exist.** Runtime auto-creation in `server.ts` uses text IDs. `src/services/supabaseSchema.ts` provides old manual SQL with UUID IDs and RLS policies; `SupabaseGuideModal` uses it, but that modal is not referenced by the current app router/pages. Do not blindly run that old SQL against the existing database; align schema first. The Express server uses direct PostgreSQL credentials, so its writes do not rely on the browser-side RLS policies.
5. **Image upload is base64 in Postgres**, not external storage, and is constrained by request size and payload growth (see above).
6. **Whole-state writes can race**, especially if two admin devices save concurrently.
7. **No automated test script/suite is defined** in `package.json`. The `lint` script is TypeScript checking (`tsc --noEmit`), not ESLint.
8. **Windows folder path contains `&`.** In this workspace, `npm run lint` and `npm run build` failed because Windows command shims split the path at the ampersand. Running the tools directly succeeded: `node .\node_modules\typescript\bin\tsc --noEmit` and `node .\node_modules\vite\bin\vite.js build`. Moving/cloning the project into a path without `&` should allow the npm scripts to run normally.
9. **AI template residue:** `@google/genai`, `GEMINI_API_KEY`, and `APP_URL` remain in dependency/template metadata, but no current UI/server code uses Gemini. Remove them only if AI Studio compatibility is not needed.

## 10. Main file map

- `src/App.tsx`: app providers and custom route dispatch.
- `src/context/NavigationContext.tsx`: browser path navigation.
- `src/context/AuthContext.tsx`: login/session/logout state.
- `src/context/MenuContext.tsx`: menu state, refresh timer, CRUD orchestration.
- `src/services/database.ts`: browser-side API repository and input validation.
- `src/types/database.ts`: category/product/auth TypeScript models.
- `server.ts`: Express API, PostgreSQL schema creation, auth cookie, static serving.
- `src/pages/customer/*`: public menu/category/product screens.
- `src/pages/admin/*`: owner dashboard and management pages.
- `src/components/admin/QrCodeModal.tsx`: hardcoded permanent menu URL and print/copy UI.
- `src/components/common/QrCodeSvg.tsx`: SVG QR generator.
- `src/services/supabaseSchema.ts`, `src/components/admin/SupabaseGuideModal.tsx`: legacy/manual Supabase schema help; currently unused by active routes.
- `.env.example`: safe variable-name/template reference.
- `.env.local`, `.env.production`: ignored local files; never committed. Render variables are configured separately in its dashboard.

## 11. Suggested order for the next helper

1. Copy the **Session pooler** connection URI from Supabase (do not guess its host); place the encoded-password URI in Render's `DATABASE_URL` environment setting.
2. Confirm the Render service uses `npm run build` and `npm start`, and that all production owner/session variables are set in Render. Redeploy.
3. Check Render startup logs, then open `https://waddodagi-menu.onrender.com/api/menu`. Expect HTTP 200 JSON with the same current category/product counts as Supabase.
4. Fix the price number/string mismatch and verify customer and admin product rendering.
5. Test a laptop admin edit, then refresh the phone menu (or wait up to 15 seconds) and verify that it shows the same data.
6. Clean `README.md`, align/remove the unused SQL guide, and consider object storage for images and row-level CRUD to avoid full-menu payloads and concurrent-save loss.

