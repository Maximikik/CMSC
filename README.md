# Sitewright

A no-code website builder you host yourself. Build multi-page sites visually, make buttons do things by picking actions from a list (no code), and publish with one click.

- **Backend:** ASP.NET Core (.NET 10), EF Core, ASP.NET Identity + JWT
- **Frontend:** Angular 22 (standalone components, signals, zoneless)
- **Database:** PostgreSQL 17 (site documents are stored as `jsonb`)
- **Serving:** nginx serves the editor and the published sites
- **Packaging:** Docker Compose

## Run it

```bash
cp .env.example .env      # then fill in POSTGRES_PASSWORD and JWT_KEY
docker compose up -d --build
```

Open <http://localhost:8080>. The first account you create becomes the administrator.
Published sites are served at `http://localhost:8081/<site-address>/`.

For production, put both ports behind HTTPS on two different domains (for example `app.example.com` and `sites.example.com`), and set `PUBLIC_SITES_URL=https://sites.example.com` in `.env`.
Keeping published sites on a different origin than the editor is deliberate: a published page can contain custom HTML and script, and it must never share storage with the editor.

## What you can do

- Users and sites: administrators create accounts; each site has owners and editors; admins can open every site.
- Pages and elements: multiple pages per site; navigation bar, hero, text and image, heading, paragraph, button, image, cards, questions list, form, popup, footer, spacer, divider, custom HTML. Drag, reorder, duplicate, undo and redo.
- Actions on any clickable element (no code): go to a page, open an address, scroll to an element, show/hide/toggle an element, open/close a popup, show a message, copy text, change an element's text, count up a number, switch light/dark mode, scroll to top, go back, wait. Triggered by click, hover, double-click or "the page opens", and chained in order.
- Images: upload to the site (PNG, JPEG, GIF, WebP; SVG is refused on purpose), reuse from the image library.
- Draft and live: edits save automatically as a draft. **Publish** writes the live copy and records a version you can restore. Unpublish takes it down.
- Two people editing the same site: saves are checked with a version number. If someone else saved first you get a clear message and a Reload button instead of silently overwriting their work.
- Export: download the whole website as one `index.html`, or the project as `.json`; import a project file back.
- Templates: studio portfolio, product launch, blank.

## Layout

```
api/        ASP.NET Core API
  Data/       EF Core entities, DbContext, migrations
  Endpoints/  auth, users, sites (drafts, publish, versions, members), assets
  Services/   document validation, safe disk access
web/        Angular app
  src/app/builder/   element types, HTML renderer, site CSS, published-site runtime, editor store, canvas, inspector
  src/app/pages/     sign in, sites list, users, editor
  docker/            nginx config template
scripts/smoke.sh     API checks (52)
e2e/e2e.js           browser checks against a running stack (41)
```

How publishing works: the editor generates the finished page (`exportHTML`), the API checks the draft is the version it was made from, stores a snapshot in `SiteVersions`, and writes `published/<slug>/index.html` atomically. The published page is one static file (all pages inside, switched with `#page-address`), so nginx serves it with no moving parts.

## API documentation

An interactive reference where you can try every endpoint is built in:

- With Docker: <http://localhost:8080/api/docs> (switch off with `ENABLE_API_DOCS=false` in `.env`)
- With `dotnet run`: <http://localhost:5080/api/docs>
- The raw OpenAPI document: `/api/openapi/v1.json` (import it into Postman, Insomnia or a client generator)

To call protected endpoints, run `POST /api/auth/login` in the page, copy the `token` from the response, and paste it under **Authentication > Bearer Token**.

## Develop without Docker

```bash
# 1. PostgreSQL running locally. The API's Development settings expect
#    Host=localhost, user postgres, password postgres; override with
#    ConnectionStrings__Default if yours differ. The database is created for you.
cd api
dotnet run                      # http://localhost:5080, docs at /api/docs, applies migrations on start

# 2. In another terminal:
cd web && npm install && npm start     # http://localhost:4200, forwards /api to http://localhost:5080
```

If the sign-in page ever shows "The API did not answer", the API is not running on port 5080 or the dev proxy (`web/proxy.conf.json`) points elsewhere.

Add a migration after changing entities: `dotnet ef migrations add <Name> -o Data/Migrations` (install the tool with `dotnet tool install --global dotnet-ef`).
Run the API checks against an empty database with `scripts/smoke.sh`. The browser checks need Playwright and a running stack: `node e2e/e2e.js`.

## Good to know

- **Forms do not send data anywhere yet.** A published site is static, so a form shows its thank-you message and runs its actions, but entries are not stored or emailed. A form-submission endpoint is the natural next backend feature.
- **Editors are trusted with the published page.** The Custom HTML block puts whatever an editor wrote into the live site. The editor itself never runs it (the canvas shows a placeholder and Preview runs in a sandboxed iframe), and published sites live on their own origin.
- **Sign-up is closed by default.** Only the first account can self-register. Set `ALLOW_REGISTRATION=true` only on a private network.
- **Login tokens last 8 hours** and are re-checked against the database on every request, so deleting a user or removing admin rights applies immediately. There is no email-based password reset; administrators reset passwords on the Users page.
- **The API creates its database on first start** if it does not exist (the database role needs the `CREATEDB` permission; the Compose Postgres user has it). Migrations are applied automatically after that.
- **Back up two volumes:** `pgdata` (database) and `sitedata` (published sites and uploads). The `keys` volume holds the data-protection keys.

## Analytics later (ClickHouse)

ClickHouse is a poor fit for the main database (frequent small edits, transactions, relations) but a good fit for visitor analytics: page views, button clicks, form submissions. The plan is to keep PostgreSQL as the source of truth and add ClickHouse as a second, append-only store fed by a small tracking snippet in published sites.
