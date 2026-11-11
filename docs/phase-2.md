# Phase 2 authentication and role dashboards

Verified on 11 November 2026. Phase 1 models, layout, API client, middleware and infrastructure were extended in place.

## Run

```powershell
Set-Location D:\my-final-year-project
npm ci
npm run seed
npm run dev
```

Open http://localhost:5173. `MONGODB_URI` must be configured in the ignored `server/.env`. The user-supplied MongoDB connection was verified successfully. The seed was run twice and preserved existing data.

## Development-only demo credentials

| Role | Email | Password |
| --- | --- | --- |
| Student | student@fyp.demo | FypDemo2026! |
| Teacher | teacher@fyp.demo | FypDemo2026! |
| Admin | admin@fyp.demo | FypDemo2026! |

`DEMO_PASSWORD` overrides the default when creating missing demo users. Reruns never reset existing passwords, account status, roles or reviews. Production seeding is refused. Passwords are absent from frontend application source. Demo records include a student group/project, its supervisor, and a persisted pending proposal.

## Authentication

- Public registration creates students only. Admin creates student/teacher accounts; administrator provisioning is through the development seed.
- bcrypt hashes passwords. JWT sessions expire after eight hours and travel in HttpOnly, SameSite=Lax cookies. Secure is enabled for production (requires HTTPS).
- Browser API requests include credentials and a custom CSRF header. Mutations validate any supplied Origin against the configured frontend origin; development also permits its 127.0.0.1 alias.
- Local-storage tokens from the Phase 1 foundation are removed. API bearer verification remains supported, but login does not return a JS-readable token.
- Current user and roles are read from MongoDB on every protected request. Inactive accounts are rejected.
- Logout increments an account token version, revoking all existing sessions for that account and disconnecting its sockets. Deactivation/reactivation also invalidates old tokens.
- Sign-in failures are rate-limited; unknown email and incorrect password produce the same message. No password hashes or token versions are returned.
- Group membership and assigned supervision constrain queries for projects, proposals, submissions, feedback and evaluations. Unowned record URLs return 404. Cross-role endpoints return 403.
- Project assignment remains authoritative on Project; User exposes an assignedProjects virtual and the profile endpoint returns current project summaries.

## APIs

- `POST /api/auth/register`, `/api/auth/login`, `/api/auth/logout`; `GET /api/auth/me`.
- `GET /api/student/dashboard`, `/api/teacher/dashboard`, `/api/admin/dashboard`.
- `GET /api/projects`, `/api/projects/:id`.
- `GET /api/proposals`, `/api/proposals/:id`; `POST /api/proposals`; `PATCH /api/proposals/:id/review`.
- `GET /api/submissions`, `/api/submissions/:id`, `/api/feedback`, `/api/feedback/:id`, `/api/evaluations`, `/api/evaluations/:id`; `POST /api/feedback`.
- `GET /api/teacher/students`.
- `GET /api/admin/users`, `POST /api/admin/users`, `PATCH /api/admin/users/:id/status`.
- `GET /api/admin/projects`, `PATCH /api/admin/projects/:id/supervisor`.
- `GET /api/notifications`, `PATCH /api/notifications/:id/read`.

Mutating requests require `X-FYP-Request: 1`. Frontend forms manage that header automatically. The inherited health/readiness endpoints and private Multer configuration remain available. Phase 3 will extend project/group forms and document exchange. No AI requests are enabled.

## Verification

- `npm run check`: lint passed; 25 backend tests and 6 frontend tests passed; backend syntax and frontend production build passed.
- `npm run test:e2e`: 8 desktop/mobile tests passed, including all three actual demo logins, session restoration, HttpOnly cookies, backend role restrictions, mobile navigation and logout.
- Database integration tests create a uniquely named `fyp_test_<random UUID>` database and remove only that test-created database. Application records are never cleared.
- Integration tests cover login failures, duplicate registration, privileged registration prevention, JWT verification, inactive accounts, CSRF, private-record access, administrative access, database-derived counts and seed repeatability.
- A Mongoose initialization race discovered during seeding was fixed by creating indexes after the database connection is established.

No live database blocker remains for Phase 2. Institutional production deployment and hardening are outside this local demonstration scope.
