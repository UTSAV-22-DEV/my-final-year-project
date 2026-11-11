# AI-Assisted Final Year Project Management System

A presentation-ready MERN application for students, teachers and administrators. Phases 1–5 are implemented: authentication, academic workflows, private documents, AI-assisted assessment, teacher grading and real-time notifications.

The functional reference is [the research paper](docs/research-paper.docx). The AI provider is **Groq**, following the updated project instruction. It uses the documented `openai/gpt-oss-20b` model and actual backend API requests. There is no simulated application evaluator.

## Start the application

Node.js 24.x and npm 11+ are required. MongoDB and Groq credentials are already configured in the ignored local `server/.env` on this machine.

```powershell
Set-Location D:\my-final-year-project
npm ci
npm run seed
npm run dev
```

Open **http://localhost:5173**. The API and Socket.IO run at **http://localhost:4000**. On the current installation dependencies and demo data are already prepared, so `npm run dev` is sufficient. Ctrl+C stops both services.

For a fresh checkout, copy the examples first and supply your own credentials:

```powershell
Copy-Item server/.env.example server/.env
Copy-Item client/.env.example client/.env
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Put the generated value in `JWT_SECRET`. Set `MONGODB_URI` to an accessible database URI and `GROQ_API_KEY` to your [Groq API key](https://console.groq.com/keys). Restart the backend after changing its environment. No secrets belong in `VITE_*` variables or Git.

## Demo credentials

| Role | Email | Development password |
| --- | --- | --- |
| Student | `student@fyp.demo` | `FypDemo2026!` |
| Teacher | `teacher@fyp.demo` | `FypDemo2026!` |
| Admin | `admin@fyp.demo` | `FypDemo2026!` |

The seed creates missing accounts, a student project/group and a pending proposal. It preserves existing passwords, roles, reviews and records. `DEMO_PASSWORD` overrides the default for newly created accounts. Seeding refuses production mode and never clears collections. Demo passwords are not included in frontend application source.

## Demonstrate the workflows

1. Use an admin session to create student/teacher accounts, create a group, add members and assign a supervisor. A student can belong to one active group.
2. In a student session, open Proposals to save a draft or submit a full proposal. In a separate teacher session, approve it or request revisions. The student sees the persisted decision and a live notification.
3. Upload a PDF or DOCX from Documents. The teacher downloads it, adds categorized feedback and chooses a review status. Resubmissions retain earlier report revisions.
4. Share a teacher resource and download it from the student's Resources page.
5. Open AI Evaluation, choose the project and a report, then request Groq feedback. Each project has two successful attempts. Failed requests and invalid documents consume none.
6. Submit the final report. The assigned teacher opens Evaluation Review, adjusts the ten marks, adds comments and finalizes the grade. Original AI scores remain available.
7. Keep the student dashboard open in the other session: feedback and grade notifications arrive without refreshing. Open the bell to read them; refresh to confirm persistence.

Use separate browser profiles, private windows or different browsers for student and teacher sessions. Tabs within one browser profile share the same account cookie. Logout revokes all existing sessions for that account.

## Groq configuration and limits

| Variable | Default / purpose |
| --- | --- |
| `GROQ_API_KEY` | Required private server credential |
| `GROQ_MODEL` | `openai/gpt-oss-20b` |
| `AI_MAX_TEXT_CHARS` | `16000`, a conservative input budget for the free tier; configurable from 1,000 to 200,000 |
| `MAX_FILE_SIZE_MB` | `10`, configurable from 1–50 MB for uploads |

AI extraction accepts at most 10 MB, 200 PDF pages and the configured character budget. Reports above the input budget are rejected clearly; content is never silently truncated. Scanned PDFs require OCR, which is not implemented. Free-tier quota and model access are governed by the Groq account; rate-limit failures do not consume attempts. No paid-plan upgrade is performed.

The [central demonstration rubric](server/src/config/rubric.js) contains ten criteria totaling 100 marks. These weights were supplied for the demonstration and are not claimed as the research paper's original institutional rubric. Each evaluation stores its rubric snapshot and model. AI marks are preliminary; the teacher controls final grades.

A real provider smoke call and a complete uploaded-PDF → Groq → MongoDB → teacher grading → Socket.IO workflow have passed using synthetic reports. No personal academic report was used for those checks.

## Environment

| Server variable | Purpose |
| --- | --- |
| `NODE_ENV` | `development`; production cookies require HTTPS |
| `PORT` | API/socket port, default `4000` |
| `CLIENT_ORIGIN` | Exact frontend origin, default `http://localhost:5173`; development also accepts its 127.0.0.1 alias |
| `MONGODB_URI` | MongoDB connection URI, including a database name |
| `JWT_SECRET` | Signing secret, at least 32 characters |
| `UPLOAD_DIR` | Private storage, default `server/uploads` |
| `DEMO_PASSWORD` | Optional development seed password override |

`client/.env` uses `VITE_API_BASE_URL=/api`. Vite proxies `/api` and `/socket.io` to port 4000. If you change the backend port, update `client/vite.config.js`. Separate-origin hosting must configure CORS, credentialed requests and compatible same-site cookies; production deployment is outside this local demonstration.

## Development and verification commands

| Command | Action |
| --- | --- |
| `npm run dev` | Start both services |
| `npm run dev:client` | Start Vite only |
| `npm run dev:server` | Start Express with watch mode |
| `npm start --workspace server` | Start Express without watch mode |
| `npm run seed` | Repeatable non-destructive demo seed |
| `npm run check` | Lint, all backend/frontend tests, syntax and production build |
| `npm run test:e2e` | Desktop/mobile browser regression and two-session checks |
| `npx playwright install chromium` | Install the browser for end-to-end checks |
| `npm run test:ai:smoke` | One real provider call using synthetic text; no database writes |
| `npm run test:ai:workflow` | Full real provider, temporary database, grading and socket smoke test |
| `npm audit --omit=dev` | Runtime dependency audit |

Unit/integration tests mock the external AI boundary. Database tests use unique `fyp_test_<UUID>` databases and remove only their own data. Browser tests create uniquely marked test users/groups and clean their exact records and files. The two explicit live AI commands use actual Groq requests and account quota.

Health endpoints: `GET /health`, `GET /api/health`, `GET /api/health/ready`. Liveness returns 200 while Express runs; readiness requires MongoDB and returns 503 when disconnected.

## Security and persistence behavior

- bcrypt password hashing; eight-hour JWT sessions in HttpOnly, SameSite cookies; Secure cookies in production. Tokens are not kept in browser localStorage.
- Role and account status are checked on the backend. Group membership and supervisor assignment constrain private records and downloads.
- Mutations require `X-FYP-Request: 1` and an allowed browser Origin. Authentication failures are rate-limited.
- PDF/DOCX extension, MIME, signature/container and size checks; UUID filenames; private canonical storage paths; authenticated downloads. DOCX expansion is bounded.
- Successful AI records are the attempt ledger, protected by an atomic project lease and a unique attempt index. Final submission locks further uploads/evaluations. Teacher marks are stored separately and finalization is conditional and immutable through the API.
- Socket identity is verified from the same session. Only server-selected user rooms receive events. Records are persisted before emission, and unique recipient/event keys prevent duplicate notifications.
- A database failure while saving a notification returns an explicit partial-operation error. An already-saved report is retained. Transport failures preserve the notification for recovery from MongoDB; no fabricated success or timer-generated event is used.

## Structure and implementation reports

```text
client/src/
  components/     Shared layout, forms, cards, notification bell and pagination
  context/        Authentication, health and real-time notification state
  lib/            API client, routing metadata and data hooks
  pages/          Role dashboards and complete academic workflows
server/
  src/
    config/ controllers/ middleware/ models/ routes/ services/ utils/
  scripts/        Seed, syntax checks and real AI smoke commands
  test/           Infrastructure, authentication, workflow, AI and socket tests
  uploads/        Private ignored academic files
docs/
  research-paper.docx
  phase-1.md      Original foundation decisions
  phase-2.md      Authentication and role dashboards
  phase-3.md      Groups, proposals, documents, feedback and resources
  phase-4.md      Assessment, rubric, attempts and teacher grading
  phase-5.md      Notification architecture, APIs and verification
  requests/      Supplied phase specifications
tests/
  e2e/ fixtures/
```

All eight original models and the established React/Express architecture are reused. No tutorial application source was imported. Phase 1's historical verification is retained in `docs/verification.md`; current phase reports describe the later implementation. No further implementation phase was started after Phase 5.
