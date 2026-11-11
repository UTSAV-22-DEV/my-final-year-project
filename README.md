# AI-Assisted Final Year Project Management System

**Current implementation: Phase 4 AI-assisted assessment.** See [Phase 4 configuration and verification](docs/phase-4.md), [Phase 3 workflows](docs/phase-3.md) and [Phase 2 credentials and authentication](docs/phase-2.md). Real Grok verification requires `XAI_API_KEY` and `XAI_MODEL`; neither is configured yet. The Phase 1 description below is retained as historical foundation documentation.

A shared academic workspace for students, teachers and administrators. **Phase 1 provides the application foundation only.** Academic workflows, sign-in and AI evaluation are deliberately reserved for later phases.

The functional specification is [the supplied research paper](docs/research-paper.docx). Implementation decisions and the remaining specification gaps are recorded in [docs/phase-1.md](docs/phase-1.md).

## Requirements

- Node.js **24.13.0 or a newer 24.x release**, npm 11+
- MongoDB Community Server or a MongoDB Atlas connection URI for persistent data
- Chromium for optional browser tests (`npx playwright install chromium`)

Tested package versions are locked in `package-lock.json`. The stack uses React 19, Vite 8, Tailwind CSS 4 with its Vite plugin, Express 5 and Mongoose 9. The backend also includes bcrypt, JWT, Multer and Socket.IO. No xAI API calls are made in this phase.

## Run locally

From PowerShell:

```powershell
Set-Location D:\my-final-year-project
npm ci
npm run dev
```

Open **http://localhost:5173**. Express runs at **http://localhost:4000**. `npm run dev` starts both processes and stops the other process if either exits. Press Ctrl+C to stop both.

Local `.env` files were prepared during initial setup and are ignored by Git. On a fresh checkout, prepare them first:

```powershell
Copy-Item server/.env.example server/.env
Copy-Item client/.env.example client/.env
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Put the generated value in `JWT_SECRET` in `server/.env`. Set `MONGODB_URI` to your actual database URI. Examples:

```dotenv
# Local MongoDB, if installed and running:
MONGODB_URI=mongodb://127.0.0.1:27017/fyp_management
# Or use your Atlas URI with a named application database.
```

Restart the backend after editing `server/.env`. The backend loads this file relative to the server directory regardless of the shell working directory.

**Without MongoDB:** the interface, API liveness and infrastructure preview run normally. Readiness returns HTTP 503, and the interface states that MongoDB is not connected. Academic persistence and database-backed authentication cannot work until a connection is configured. Initial connection failure is logged safely; after correcting it, restart the server. No database connection success is inferred from schema tests.

## Environment

| File / variable | Default | Purpose |
| --- | --- | --- |
| `server/.env`: `NODE_ENV` | `development` | Environment; demo seeding refuses production |
| `PORT` | `4000` | Express and Socket.IO port |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Exact frontend origin, without a trailing slash |
| `MONGODB_URI` | Empty | Actual MongoDB connection, with database name |
| `JWT_SECRET` | Empty in example | At least 32 characters; generated locally during initial setup |
| `UPLOAD_DIR` | `uploads` | Private storage, resolved from the server directory |
| `MAX_FILE_SIZE_MB` | `10` | Per-file limit, 1–50 MB |
| `DEMO_PASSWORD` | Empty | Required only for the demo seed; at least 12 characters, at most 72 UTF-8 bytes |
| `XAI_API_KEY`, `XAI_MODEL` | Empty | Reserved for later AI integration |
| `client/.env`: `VITE_API_BASE_URL` | `/api` | API path; a full API URL may be used for a split-origin deployment |

The Vite development proxy forwards `/api` and `/socket.io` to port 4000. If you change `PORT`, update `client/vite.config.js` too. Never put database credentials, JWT secrets or AI keys in a `VITE_*` variable; these values are public browser code. Build output is a static frontend; production hosting and deployment are outside Phase 1. A future static host must provide SPA fallback to `index.html` and a same-origin API proxy, or set `VITE_API_BASE_URL` when building.

## Commands

| Command | Result |
| --- | --- |
| `npm run dev` | Start both services |
| `npm run dev:client` | Frontend only |
| `npm run dev:server` | Backend with Node watch mode |
| `npm start --workspace server` | Backend without watch mode |
| `npm run lint` | ESLint across frontend, backend and tests |
| `npm test` | Backend infrastructure/model tests, then frontend tests |
| `npm run build` | Backend syntax checks and Vite production build |
| `npm run check` | Lint, tests and build |
| `npx playwright install chromium` | Install the browser used for end-to-end checks |
| `npm run test:e2e` | Desktop/mobile browser checks; starts services if needed |
| `npm run preview --workspace client` | Preview the static production frontend; start Express separately |
| `npm run seed` | Insert missing demo users without clearing existing data |

Tests do not require MongoDB credentials. Backend HTTP tests open temporary local ports. Restricted execution environments must permit loopback connections. Browser tests reuse development services on the expected ports, or start and stop their own services.

## Health endpoints

| Endpoint | Meaning |
| --- | --- |
| `GET /health` | Liveness alias |
| `GET /api/health` | HTTP 200 when the API is running; reports actual database and Socket.IO initialization state |
| `GET /api/health/ready` | HTTP 200 with MongoDB connected; otherwise HTTP 503 |
| `GET /api/auth/me` | JWT-protected current user; requires configured JWT secret, MongoDB and an active user |

```powershell
Invoke-RestMethod http://localhost:4000/api/health
curl.exe -i http://localhost:4000/api/health/ready
```

Socket initialization indicates that the Socket.IO server is attached; it does **not** claim notification delivery has been implemented. Anonymous socket connections are rejected. Future authenticated connections join only a server-selected user room.

## Demo seed

After configuring MongoDB, set `DEMO_PASSWORD` in the ignored `server/.env`, then run:

```powershell
npm run seed
npm run seed
```

Both runs are safe. The seed uses email-based upserts with `$setOnInsert`; it creates only missing accounts and preserves existing passwords, roles and records. It never deletes collections. Use a development database.

| Role | Account |
| --- | --- |
| Student | `student.demo@fyp.local` |
| Teacher | `teacher.demo@fyp.local` |
| Admin | `admin.demo@fyp.local` |

These are later-phase demo accounts. There is no sign-in endpoint or sign-in form in Phase 1. The seed cannot run without `MONGODB_URI` and `DEMO_PASSWORD`.

## Structure

```text
client/
  public/                    Favicon
  src/
    components/              Layout, navigation, loading/error components
    context/                 Authentication and health state
    lib/                     API client and navigation definitions
    pages/                   Overview, system status, module previews, 404
    test/                    Frontend tests
    App.jsx
    main.jsx
    styles.css
  .env.example
  vite.config.js
server/
  src/
    config/                  Environment, MongoDB and Multer
    controllers/             Health and current-user responses
    middleware/              JWT, role checks, validation, errors
    models/                  Eight Mongoose models and shared field types
    routes/                  API routing
    services/                Password hashing and Socket.IO setup
    utils/                   Application error type
    app.js
    index.js
  scripts/                   Repeatable seed and syntax check
  test/                      Infrastructure and schema tests
  uploads/                   Private, ignored document storage
  .env.example
docs/
  research-paper.docx         Supplied functional specification
  phase-1.md                 Scope, data relationships and open decisions
  verification.md            Recorded verification results
tests/e2e/                   Desktop and mobile browser checks
eslint.config.js
playwright.config.js
package.json
package-lock.json
.gitignore
```

## Boundaries for the next phase

- JWT verification, role middleware and frontend session context exist; sign-in, registration and account management do not.
- Schemas express ownership; later controllers must enforce group membership, teacher assignments and role permissions. Mongoose references alone do not authorize access.
- Multer has private UUID-based storage, size limits and PDF/DOCX MIME/extension checks. There is no upload route or public static file serving. Before exposing uploads, inspect file contents and implement authorized downloads.
- Project counters and a unique evaluation attempt index prepare the two-attempt rule. The evaluation service must reserve attempts atomically and define retry/failure policy. There is no live AI attempt workflow yet.
- AI criteria are stored as a rubric snapshot and validated against ten criteria totaling 100. No rubric names, weights or Grok model were invented. Teacher final grades are stored separately from AI results.
- The frontend follows the paper's local-storage token approach for the session foundation; assess production token protection before institutional deployment.
- No tutorial/template application source was imported. Dependencies retain their own licenses. This repository is a local development foundation, not a production deployment.
