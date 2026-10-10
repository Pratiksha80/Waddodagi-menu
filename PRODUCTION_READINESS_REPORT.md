# Production Readiness Report

Updated: 10 October 2026

## Executive summary

**Verdict: NOT READY for production deployment.** The repository has a coherent single-owner menu app and an Express/PostgreSQL request path, but production deployment is blocked on the actual database URI and host environment, unverified live schema compatibility, and unresolved data-loss/security-hardening risks. No production database connection, production API, or deployment was tested during this audit.

The earlier connection audit already identified the likely Supabase direct-host IPv6 issue and an unfinished local production URI. This report does not repeat that investigation. It records only the impact on readiness: use the exact Supabase Session Pooler URI copied from the dashboard, configure it in the hosting service, and verify it after deployment.

The least disruptive architecture is a persistent Node/Express host with the existing static build and same-origin API. Continue with Render only if its service is available and its resource limits fit the project; the handover says the current free usage was exhausted, so if that remains true, use another persistent Node host. Do not migrate to Vercel solely to solve the database URI issue. Vercel can host Express, but this repository's current `app.listen()` startup, production static serving, and per-process pool need a serverless adaptation and verification.

## Scope and evidence labels

- **CONFIRMED**: established by source/config inspection or a local request made during this audit.
- **INFERENCE**: a likely outcome based on the implementation, but not verified against a live production service/database.
- **NOT TESTED**: requires a real Supabase schema/connection, production host, owner configuration, or additional integration testing.
- No database writes, schema changes, credential rotations, deployments, or destructive commands were performed.
- Credential-bearing env files were not printed or modified. `HANDOVER.md` was already untracked before this work and was not changed.

## Architecture and API inventory

The browser is a Vite-built React SPA. In development, `server.ts` starts Vite middleware; in production it serves `dist` through Express. The same Express process owns the API and a node-postgres pool, and its production startup runs `CREATE TABLE IF NOT EXISTS` before listening.

Current Express API routes (menu routes are implemented in `src/server/menuRoutes.ts` and backed by `src/server/menuRepository.ts`):

| Method and path | Access | Behavior |
| --- | --- | --- |
| `GET /api/menu` | Public | Reads all categories and products; `Cache-Control: no-store`. |
| `POST /api/menu/reset` | Owner session | Preserves the existing dashboard reset action as an explicit transaction; returns `{ success: true }`. |
| `POST /api/categories` | Owner session | Creates one category; returns `{ category }`. |
| `PUT /api/categories/:id` | Owner session | Updates one category while preserving its ID; returns `{ category }`. |
| `DELETE /api/categories/:id` | Owner session | Deletes one empty category; returns `{ success: true }`. |
| `POST /api/products` | Owner session | Creates one product; returns `{ product }`. |
| `PUT /api/products/:id` | Owner session | Partially updates supplied product fields while preserving ID and unspecified fields; returns `{ product }`. |
| `PATCH /api/products/:id/availability` | Owner session | Changes only `available`/`out_of_stock`; returns `{ product }`. |
| `DELETE /api/products/:id` | Owner session | Deletes one product; returns `{ success: true }`. |
| `POST /api/images` | Owner session | Uploads one raw JPEG/PNG/WebP/GIF file up to 5 MiB to configured Supabase Storage; returns `{ image_url }`. |
| `DELETE /api/images` | Owner session | Best-effort cleanup of an unreferenced generated object in the configured bucket; legacy and external URLs are ignored. |
| `POST /api/auth/login` | Public | Checks the configured single owner and sets a signed session cookie. |
| `GET /api/auth/session` | Public | Returns the authenticated user or 401. |
| `POST /api/auth/logout` | Public | Clears the session cookie; returns 204. |
| `GET /api/admin/session` | Public route, session checked | Duplicate session-check endpoint; returns user or 401. |

The later `/admin/*` Express middleware guards UI paths by redirecting unauthenticated users to login. It is not the API authorization layer. All eight mutation routes use explicit `requireOwner` middleware. The old whole-snapshot `PUT /api/menu` mutation has been removed; no frontend call site uses it.

Still missing: pagination/server-side filtering, health/readiness endpoint, CSRF token/origin validation, backup/export/restore endpoints, and an automated historical base64-image copy/cutover utility. New image uploads are implemented but remain unavailable until external Storage configuration is supplied. Menu writes are now per-resource operations. Reads still return the full menu, and there is no optimistic version check for concurrent edits to the same record.
The old `PUT /api/menu` full-snapshot contract is removed. Deploy the updated frontend and backend together; any already-open old client tab must reload before it can save changes.

## Confirmed findings

### Authentication and authorization

- **PASS, isolated API tests:** all mutation routes require the supplied owner middleware; tests confirm unauthenticated category creation and availability changes return 401. Production supplies the existing signed-cookie `requireOwner` middleware.
- `requireOwner` checks a signed cookie before each protected menu mutation route. Customer reads are intentionally public.
- Cookie settings are `HttpOnly`, `SameSite=Strict`, `Path=/`, eight-hour `Max-Age`, and `Secure` when `NODE_ENV=production`. The server validates signature, expiry, and configured owner email on each protected request.
- Login rate limiting is an in-memory counter keyed by `req.ip`, limited to 10 attempts per 15 minutes. It is reset on successful login and lost on restart; multiple instances do not share it. Behind a proxy, correct client IP interpretation depends on Express proxy configuration, which is not set here.
- Logout is a POST that clears the cookie in the browser and on the server. The client does not wait for the logout response. The cookie is stateless, so server-side logout is cookie deletion rather than revocation; a copied valid cookie can remain valid until expiration or secret change.
- **CSRF assessment:** `SameSite=Strict`, no CORS, and JSON request bodies reduce ordinary cross-site write risk. There is no `Origin`/`Sec-Fetch-Site` validation or CSRF token; add origin checks before exposing the API cross-origin or changing cookie policy.

### Menu CRUD, validation, and database schema

- Categories/products can be created, edited, listed, filtered client-side, and deleted through `src/services/database.ts`; availability changes use the dedicated status route. Category deletion is prevented when products reference it, both in the repository and by the database FK when present.
- Each mutation validates supported keys, names (1-255 characters), descriptions (up to 20,000 characters), numeric price (0-99,999,999.99 with at most two decimals), status, category reference, and image URL/data-URL syntax and maximum length. IDs and category relationships stay unchanged unless a supplied category_id explicitly changes the relationship. PostgreSQL constraints remain the final integrity boundary.
- Mutation responses use consistent JSON shapes. Statuses are 201 for creation, 200 for updates/deletes, 400 for invalid input, 401 for unauthenticated writes, 404 for missing records, 409 for duplicate category names or categories in use, 503 for recognized database connectivity failures, and 500 for unexpected failures. Errors include stable `code` and human-readable `error` fields.
- PostgreSQL mutations use a transaction per operation. Category create/update serialize name checks with a transaction advisory lock; delete checks attached products; product create/update verifies category references inside the transaction. This removes whole-catalog lost updates. It does not prevent concurrent edits to the same record (last update wins).
- Runtime schema creation is non-destructive `CREATE TABLE IF NOT EXISTS`, but it does not reconcile an existing table definition, add missing constraints/indexes, or verify column types. The legacy `src/services/supabaseSchema.ts` uses UUID IDs and nullable/defaulted text columns, while runtime DDL uses text IDs and non-null text columns. UUID-shaped IDs generated by browsers are compatible with UUID columns, but the actual live schema and nullable values were not checked during this audit. **Live schema compatibility: NOT TESTED.** Do not run the legacy SQL blindly.
- PostgreSQL `NUMERIC` normally arrives from `pg` as a string. `src/server/menuRepository.ts` converts each product price to a finite JavaScript number; invalid values produce a controlled error rather than violating the frontend number contract.
- Repository operations catch transaction failures, attempt rollback only after `BEGIN`, and release the client in `finally`. Recognized connectivity failures map to 503; unknown database failures map to a redacted 500 response.

### Image handling and request limits

- New product image files are sent as raw bytes to authenticated `POST /api/images`; the server allows JPEG, PNG, WebP, and GIF only, checks their file signatures, and enforces a 5 MiB limit independent of JSON_BODY_LIMIT. The admin forms use blob URLs only for local previews; successful saves put the returned public URL in `products.image_url`.
- Supabase Storage is the chosen provider because the project already uses Supabase. The app does not create the bucket. It uses the server-only Storage service role key and a bucket configured as public for customer rendering. No bucket, credentials, or live Storage upload has been verified.
- `PUT /api/products/:id` updates the row before attempting cleanup of a replaced owned Storage image. Product deletion removes the row before best-effort cleanup. Cleanup is limited to URLs from this project/bucket under the generated `products/` key pattern and checks that no product still references the URL. Legacy `data:` URLs and arbitrary external URLs are never deleted. Failed cleanup leaves an orphaned Storage object, not a broken database reference.
- Existing base64 values remain readable and may be retained unchanged when editing legacy products. New product creates and changed image values cannot add new data URLs; they must use a URL or the image upload endpoint. No existing rows or images were migrated or modified. The migration must be copy-first: back up the database, upload copies and verify URLs/checksums, then perform a reviewed cutover only after backup/rollback preparation. Do not delete source base64 values as part of the copy phase.
- `JSON_BODY_LIMIT` still bounds JSON API requests. Raw file uploads have their separate fixed 5 MiB cap. Supabase bucket-level max size and MIME allowlist should match or be stricter than the app. Vercel request-size and execution constraints still need verification if that host is selected.
- Supabase's official docs describe the public object URL format and public bucket behavior, recommend unique paths instead of overwrite to avoid stale CDN content, and support bucket-level file size/content-type restrictions. See [Standard Uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads), [Serving assets](https://supabase.com/docs/guides/storage/serving/downloads), and [Bucket fundamentals](https://supabase.com/docs/guides/storage/buckets/fundamentals). The implementation follows the documented Storage REST object upload/delete endpoints and has only been tested with a mocked Storage response.

### Cross-device consistency and data integrity

- Menu refresh runs on initial mount, browser focus, and a 15-second interval. Read requests bypass browser cache. **Implementation evidence only:** cross-device visibility should occur on the next successful refresh, but no two-device test was performed.
- The former whole-snapshot lost-update problem is removed for separate record changes. Concurrent updates to the same category/product remain last-write-wins; optimistic record versions are not implemented.
- Category IDs/product IDs and category references are checked by database constraints where present. No production rows were changed or deleted in this audit.

### Errors and UI behavior

- The public menu and admin layout expose `loadError`; failed loads do not silently fall back to local browser storage. The UI may retain previous in-memory data after a later refresh fails, while displaying the error banner.
- Menu route errors return stable error codes and redacted messages, with recognized database connection failures mapped to 503. Login network failures are not caught in `AuthContext.login`, so a rejected fetch may leave the login form without its normal error message.
- The custom History API router covers known menu/admin pages and falls back to the customer menu for unknown paths. Express production fallback serves `index.html` for UI routes. Direct URL navigation on the current Express host is supported by implementation; it was not browser-tested here.

### Environment configuration

`server.ts` reads these runtime variables. `vite.config.ts` additionally reads `DISABLE_HMR` for development tooling.

Workspace verification on 10 October 2026 found one Git-ignored `.env`; `.env.local` and `.env.production` are absent. `DATABASE_URL` uses the supplied Supabase Session Pooler host/username with a non-empty password, and `DATABASE_SSL=true`. A read-only local PostgreSQL count query through this URI succeeded (1 category, 1 product); this verifies local reachability, not Render connectivity. Production owner email/password/session secret are empty. All three optional image-storage settings are now present, but the bucket/upload has not been tested. Values were not printed.

| Variable | Required/use | Production configuration and validation |
| --- | --- | --- |
| `NODE_ENV` | Controls production mode | Set `production`; no explicit value validation. |
| `PORT` | Optional; defaults to 3000 | If supplied, must be a positive integer from 1 through 65535. |
| `DATABASE_URL` | Required in production | Valid PostgreSQL URI with host, username and database; placeholders and known Supabase direct host are rejected. Never expose to Vite/client. |
| `DATABASE_SSL` | Optional, defaults true | If supplied, must be `true` or `false`; true uses TLS with `rejectUnauthorized: false`. |
| `DATABASE_CONNECTION_TIMEOUT_MS` | Optional; defaults 10000 | If supplied, must be a positive safe integer. |
| `DATABASE_IDLE_TIMEOUT_MS` | Optional; defaults 30000 | If supplied, must be a positive safe integer. |
| `DATABASE_POOL_MAX` | Optional; defaults 3 | If supplied, must be a positive safe integer. |
| `OWNER_EMAIL` | Required in production | Must be a valid email shape up to 254 characters; normalized to lowercase; server-only. |
| `OWNER_PASSWORD` | Required in production | Must be non-empty and not whitespace-only; server-only. |
| `OWNER_NAME` | Optional | Defaults to `Shop Owner`. |
| `SESSION_SECRET` | Required in production | Must contain at least 32 non-whitespace characters; server-only and never echoed in validation errors. |
| `SUPABASE_URL` | Optional; enables product image storage | Must be an HTTPS project URL and supplied together with the service role key and bucket. |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional storage secret | Server-only; supplied with the URL and bucket, never use a `VITE_` prefix. |
| `SUPABASE_STORAGE_BUCKET` | Optional; must already exist | The app does not create the bucket; configure it for public reads and compatible file restrictions. |
| `JSON_BODY_LIMIT` | Optional; defaults `100mb` | If supplied, must be a positive byte size (`b`, `kb`, `mb`, `gb`, or raw bytes). |

The server loads only `.env` in every mode; host-level environment variables take precedence. `.env` is ignored by Git, while `.env.example` is the safe template. Production hosting dashboards still require their own variables; a local env file is not uploaded automatically.

### Backup, recovery, and rollback

- No application backup, export, restore, or migration tooling is present. Database backup frequency/retention depends on the Supabase plan and dashboard configuration, not this repository; it was not inspected.
- Code deployment rollback does not revert database contents. Restore requires a valid database backup or a manually prepared export. Confirm backup retention and perform a restore drill before production use.
- Schema startup DDL is currently additive `CREATE TABLE IF NOT EXISTS`; there is no versioned migration or rollback plan. Avoid destructive schema changes and test any future migration against a copy first.

## Fixed defects and changes in this continuation

- `src/server/menuRepository.ts`: normalize PostgreSQL numeric product prices at the API boundary and reject non-finite results.
- `src/server/menuRepository.ts`: contain transaction failures, roll back after started transactions, and release clients in finally.
- `src/server/config.ts`: validate required production database/owner/session settings and validate optional port, SSL, pool timeout/size and request-body settings. Errors name the variable/rule but never echo values. Development retains its optional database and owner/session fallbacks.
- `src/server/menuRepository.ts` and `src/server/menuRoutes.ts`: replace whole-menu writes with individually authenticated, validated category/product operations backed by one transaction per database mutation.
- `src/server/config.ts`, `.env.example`, `src/server/menuRepository.ts`, `src/services/database.ts`, and `src/context/MenuContext.tsx`: cap the default per-process PostgreSQL pool at 3, make menu-list SQL sequential, fetch one shared menu snapshot per refresh, derive dashboard counts in the browser, and coalesce overlapping refreshes. Transactions release checked-out clients from `finally`.
- `src/services/database.ts` and `src/context/MenuContext.tsx`: route existing UI CRUD/status/reset actions through the new API contract; the existing reset control remains a separate authenticated transaction.
- `tests/config.test.ts`, `tests/menuApi.test.ts`, and `package.json`: add built-in Node tests and a `npm test` script for configuration, success paths, invalid input, missing records, unauthorized operations, and database connectivity error responses.
- `src/server/imageStorage.ts`, `src/server/menuRoutes.ts`, `server.ts`, and `.env.example`: add optional Supabase Storage wiring with server-only credentials, owner-protected raw uploads, 5 MiB size/MIME/signature validation, generated unique paths, public URL responses, and guarded cleanup.
- `src/pages/admin/AdminProductAddPage.tsx`, `src/pages/admin/AdminProductEditPage.tsx`, and `src/services/database.ts`: upload selected files as bytes, keep local blob previews, and persist Storage URLs. Existing URLs/data URLs remain renderable and accepted for backward compatibility.
- `tests/imageStorage.test.ts`: cover signature checks, upload URL generation, protected upload rejection, missing storage setup, and safe deletion scoping.
- No schema changes, credential-file changes, production writes, or data migrations were performed. The live database remains unverified.

Previous connection-focused changes already present in the worktree: env-file precedence, TLS setting validation, placeholder/URI checks, pool timeout/configuration, and clearer production startup diagnostics.

## Supabase Session Pooler exhaustion follow-up

- **Confirmed root cause in request pattern:** the application already creates one module-level `pg.Pool` per server process. However, each `MenuContext` refresh previously made three identical `GET /api/menu` calls in parallel (for categories, products, and counts); each API request then ran its categories and products SQL queries concurrently. A single browser refresh could therefore trigger six concurrent pool queries, with overlapping focus/timer refreshes adding more demand. Multiple Render processes during scaling or deployment overlap can multiply the per-process pool total.
- **Code changes:** default `DATABASE_POOL_MAX` is now 3; `.env.example` documents 3. `MenuContext` requests one snapshot per refresh and derives counts locally, and coalesces overlapping refreshes in a browser tab. PostgreSQL menu listing now executes the two reads sequentially. Existing server construction remains the sole `new Pool(...)` site per process, using the configured max. Transaction clients are released in `finally`, including when connect/transaction work throws after checkout.
- **Startup:** source inspection found one schema initialization query during startup and no per-request pool construction. The existing single startup DDL query remains unchanged; no schema/data changes were made.
- **Deployment setting:** if Render explicitly defines `DATABASE_POOL_MAX`, set that variable to `3` there; the code default only applies when the variable is absent. Keep the existing Session Pooler URI unchanged. A max of 3 is per server process, so keep the service to one instance unless the aggregate pool budget is recalculated.
- **Verification:** TypeScript check PASS; `npm test` PASS (15 tests); direct Vite production build PASS. The `npm run build` wrapper fails in this Windows workspace because the path contains `&`; the equivalent direct Vite build succeeded. `git diff --check` PASS. No Render changes, live database reads/writes, schema changes, or data changes were made in this follow-up.

## Remaining defects and readiness blockers

1. **BLOCKER â€” production DB URI/host setup and live connection are unverified.** Enter the exact Session Pooler URI in the selected host and test startup plus `/api/menu`.
2. **MEDIUM â€” concurrent edits to the same record are last-write-wins.** Add per-record revision checks if simultaneous owner edits become likely.
3. **HIGH — existing images remain base64 blobs until separately migrated.** New uploads use Storage only after the bucket and credentials are configured. No current records were migrated; the app has no automated historical-image copy/cutover tool. A separate backup and verified copy-first migration remains required.
4. **MEDIUM â€” login throttling is process-local.** Use shared/distributed login throttling if multiple instances/serverless functions are used.
5. **MEDIUM â€” schema drift is not detected.** Verify live columns, types, defaults, indexes, constraints, nullability, and row counts with read-only queries. Adopt explicit versioned migrations before changing schema.
6. **LOW â€” database error classification covers common connectivity codes; other provider-specific connection errors may map to 500.** Extend mapping from observed redacted production errors if needed.
7. **MEDIUM â€” no CSRF origin/token defense beyond SameSite and JSON/CORS defaults.** Add same-origin checks on state-changing routes as a defense-in-depth measure.
8. **MEDIUM â€” tests cover configuration and isolated menu API behavior, but not the signed production cookie flow, live PostgreSQL SQL, or concurrent updates.** Add isolated database integration tests before release.
9. **LOW â€” `GET /api/admin/session` duplicates `/api/auth/session`.** Remove or document one endpoint once clients are confirmed.
10. **NOT TESTED â€” production owner login, cookie behavior behind the actual proxy/domain, direct-route UI rendering, two-device refresh, and image upload at configured limits.**

## Vercel compatibility and required changes

Vercel currently documents Express deployment as supported, but this repository is not a drop-in deployment as-is:

1. Separate Express app construction from startup side effects. Export an Express app/function entrypoint; do not call `app.listen()` inside a Vercel Function.
2. Keep Vite middleware and local dev startup in a local-only entrypoint. The current `else` branch starts Vite for every non-production environment.
3. Configure static asset output and SPA fallback. Vercel's Express guidance says Express `express.static()` is ignored there; publish Vite build assets through Vercel's static output/`public` and route UI paths to `index.html`, while routing `/api/*` to the function.
4. Refactor production schema bootstrap away from every function cold start; use an explicit, safe migration step or one-time administrative migration and validate schema separately.
5. Set Vercel environment variables for Production, Preview, and Development intentionally: `DATABASE_URL`, `DATABASE_SSL=true`, `OWNER_EMAIL`, `OWNER_PASSWORD`, `OWNER_NAME`, `SESSION_SECRET`, and any non-default pool options. If using image uploads, also set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_STORAGE_BUCKET`. Preview must not accidentally use production credentials/data.
6. Place the function near Supabase and use the correct IPv4-compatible Supabase pooler URI if the function's network requires IPv4. Review per-instance pool size, concurrency, idle connections, and database limits; Vercel documents pooling guidance for functions.
7. Configure Supabase Storage and test the new raw upload endpoint on a preview deployment. Historical base64 image migration remains a separate copy-first operation; also test Vercel's request limits against the 5 MiB file cap.
8. Test preview deployment end-to-end before attaching the production domain. Verify API response, login, cookies, direct SPA routes, read/write authorization, and actual database connectivity.

These are specific changes needed for Vercel readiness, not changes implemented in this audit. Vercel's official guidance describes Express as deployable in a function, notes that Express static serving is not used for Vercel static assets, and recommends reviewing connection pooling for database-backed functions. [Express on Vercel](https://vercel.com/kb/guide/ship-a-express-app-on-vercel), [Vercel database connection pooling](https://vercel.com/kb/guide/connection-pooling-with-functions), [Vercel rewrites](https://vercel.com/docs/routing/rewrites).

## Test results

| Check | Result | Notes |
| --- | --- | --- |
| TypeScript (`node .\\node_modules\\typescript\\bin\\tsc --noEmit`) | PASS | Run after the current pool/menu-loading changes. |
| `npm test` | PASS | 15 tests passed, including one-request menu loading, sequential PostgreSQL menu queries, and client release after transaction failure. Database and Storage behavior use mocks/in-memory repositories. |
| `npm run build` | FAIL | Windows npm command shim split the workspace path at `&`. |
| Direct Vite production build (`node .\\node_modules\\vite\\bin\\vite.js build`) | PASS | Equivalent build completed successfully after the source changes. |
| `git diff --check` | PASS | No whitespace errors in reviewed changes. |
| Local app listener/UI | PASS | Existing project process is active on port 3000; `/` returned HTTP 200. A second `npm run dev` could not bind because that same app already occupied ports 3000/24678. |
| Local Supabase Session Pooler read-only query | PASS | PostgreSQL count query succeeded with 1 category and 1 product; no data was changed. This does not verify Render. |
| Protected category/product mutations | PASS | Isolated API tests verify unauthenticated 401 and owner-authorized mutation behavior through injected test middleware. |
| Production owner cookie/auth end-to-end | NOT TESTED | Configuration and route tests do not exercise the signed production cookie flow. |
| Render-to-Supabase connectivity | NOT TESTED | Local connection succeeds; Render environment has not been configured or tested. Full schema compatibility audit remains incomplete. |
| Authenticated category/product CRUD against isolated DB | NOT TESTED | No test database configured. |
| Production hosting/deployed routes | NOT TESTED | No deployment performed. |
| Live Supabase Storage bucket/upload/delete | NOT TESTED | Storage config values are present locally, but bucket existence, access, and upload/delete behavior are unverified. |

## Recommendation and exact remaining manual steps

**Recommendation: continue with the existing persistent Express architecture rather than migrate to Vercel now.** Render is the lowest-change fit if the service can be used again and the current account/service limits allow it. If Render remains unavailable due exhausted usage, choose another persistent Node host that can run `npm start`, accept the required server environment variables, and reach Supabase. Vercel is viable after the listed serverless/static-output refactor, but it adds work without addressing the underlying need to configure and verify the Supabase connection.

Before a production launch:

1. In Supabase, open **Connect â†’ Session pooler**, copy the complete URI, replace only the password placeholder, and percent-encode reserved password characters. Do not guess the hostname.
2. The repository now loads one ignored `.env` file locally in both modes; it was created from the prior `.env.local`, and the split `.env.local`/`.env.production` files were removed. The local `DATABASE_URL` uses the supplied Supabase Session Pooler endpoint. Production hosting still needs the same URI entered in Render's Environment settings. Configure `NODE_ENV=production`, `DATABASE_URL`, `DATABASE_SSL=true`, `OWNER_EMAIL`, `OWNER_PASSWORD`, `OWNER_NAME`, and a unique `SESSION_SECRET` with at least 32 characters. Set pool variables only if needed. Do not prefix secrets with `VITE_`.
3. Confirm production build/start commands and verify the hostâ€™s real environment settings without copying secrets into chat or Git.
4. Deploy, inspect startup logs, and request `/api/menu`; require HTTP 200 with the expected existing menu data. This is the first evidence that the production connection works.
5. Verify owner login, cookie flags in browser devtools, unauthenticated write rejection, authorized category/product CRUD, image/body-limit behavior, direct page routes, and phone/laptop refresh. Use a controlled non-production dataset for mutation tests.
6. Read the live schema with non-destructive catalog queries and compare it to runtime expectations. Do not run the legacy schema SQL or destructive SQL.
7. Confirm Supabase backup/retention settings and perform a restore drill against a separate test project/database.
8. In Supabase Dashboard → Storage, create a bucket. Set it public because customers load images directly from `image_url`; configure a 5 MiB maximum and allow only `image/jpeg`, `image/png`, `image/webp`, and `image/gif`. The app does not create a bucket or bucket policies.
9. In Supabase Dashboard → Project Settings → API, obtain the project URL and a server-side service-role key. In the hosting service, set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_STORAGE_BUCKET` together. Keep the key in server environment settings only, never in Vite variables or source control. Redeploy and test owner upload, customer public read, replacement, and product deletion.
10. Existing inline images are untouched and there is no historical-image migration utility in this repository. Before migrating them, take a database backup and export product IDs plus original image values to a protected manifest. A copy-only migration tool must upload each original to a unique Storage path and verify its bytes/checksum and public URL. Review the mapping and prove rollback from the backup before changing any database `image_url`; keep the original manifest/backup until restore is proven. Do not cut over or delete old data until that tooling and restore plan exist.
11. Add optimistic per-record revisions if concurrent edits to the same product/category need conflict detection.
12. If Vercel is selected later, implement the function/static split above and verify it on a preview deployment before switching the QR/public domain.

**Final status: NOT READY.** A passing local build and an unauthenticated-write check do not establish database connectivity, production authentication, backup recoverability, or production deployment readiness.

