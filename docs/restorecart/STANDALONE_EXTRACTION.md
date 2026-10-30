# Standalone extraction — 30 October 2026

Extracted RestoreCart source from `miko-keng/scrapdrop` commit `7ee04e3` into the independent `miko-keng/restorecart` repository. The original checkout and repository remain intact.

Included: RestoreCart React views/styles, Express/SQLite backend, shared PayPal sandbox client, AI instructions/configuration, scripts, examples, tests, evidence, license and documentation. Paths inside `server/restorecart` and `src/restorecart` are retained to preserve internal references. Earlier evidence files are historical; they do not establish a new hosted payment test.

Removed from this standalone application: TaskSlice/ScrapDrop entry points, manufacturing logic, Three.js scenes, AG Studio, Bryntum and their dependencies. No private .env, local account database, merchant order history or API keys are committed. A new lockfile contains only RestoreCart dependencies.

Deployment fixes: `npm start` starts RestoreCart directly; HTML branding and favicon are RestoreCart; root redirects to `/restorecart`; `/healthz` is a public non-sensitive liveness check. `.node-version`, `render.yaml`, `DEPLOY_RENDER.md` and GitHub Actions checks support deployment and verification. Free-tier SQLite durability limitations are explicit in the deployment guide.

Verification in the new project:

- `npm test`: 78 passed, zero failed/skipped.
- `npm run build`: passed; standalone JS bundle approximately 442 kB before gzip.
- Production `npm start` with isolated temporary database: health check, root redirect, RestoreCart branding and session API passed. No AI or PayPal calls made.
- Dependency installation audit: zero reported vulnerabilities at extraction time.
- File scan against configured local private credentials: no matches in files prepared for commit.
- Local synthetic demo accounts/prepared shop created with the seed command; `.data` remains ignored and is not deployed.

No Render service was created or deployed during extraction. Configure the new service origin and secrets in Render; register a webhook for that new origin. Hosted account/order data is separate from this source repository.
