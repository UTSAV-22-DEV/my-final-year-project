# Phase 5 real-time notifications

The existing Notification model, Socket.IO initialization, authenticated sessions and academic workflow controllers were extended in place. No additional implementation phase was started.

## Architecture and authentication

Express and Socket.IO share the HTTP server. Socket connections verify the same HttpOnly session cookie used by HTTP requests; bearer tokens remain supported for API clients. Identity, account status and token version are verified against MongoDB. Anonymous connections are rejected.

The server assigns `user:<authenticated ID>` rooms. Clients have no join/subscribe handler and cannot choose arbitrary user IDs. Multiple sessions can share the same user's room. Sockets disconnect when their JWT expires, on account deactivation and when logout revokes account sessions. Browser clients reconnect after transport interruptions and refetch persisted notifications and unread counts.

The centralized `notify` service derives recipients from actual project relationships. It stores each notification before attempting private emission. A unique `(recipient, eventKey)` index and deterministic business-event keys prevent duplicate records and duplicate live events on retries. Transport failure retains the record for recovery. A database write failure raises an explicit error; it never emits a fabricated success. Already-saved document files are retained if a later notification write fails.

Notification messages contain concise workflow metadata, not private report contents or AI prompts. Resource references are typed IDs. The browser verifies current project access before navigating from a notification, and resource APIs enforce ownership again. Historical notifications do not populate unauthorized current project details.

## Real business events

| Operation | Recipients |
| --- | --- |
| Proposal submission/resubmission | Assigned teacher |
| Proposal approval/rejection/revision request | Current group members |
| Document upload/resubmission | Assigned teacher |
| Feedback/revision notice | Current group members |
| Resource upload | Relevant group members |
| Group/student assignment | Newly assigned members and supervisor |
| Supervisor assignment | Supervisor, group members and administrative activity recipients |
| Successful AI evaluation | Group members |
| Final report submission | Assigned teacher |
| Teacher-finalized grade | Group members |
| Account creation/status change | Administrators |

Events are produced only after the corresponding operation is saved. No public notification-generation endpoint, frontend event simulator or timer-generated academic update exists.

## Notification APIs

All routes require authentication; mutations retain CSRF/origin validation.

| Method | Endpoint | Behavior |
| --- | --- | --- |
| GET | `/api/notifications` | Owner-scoped history; `page`, `limit`, `unread=true` |
| GET | `/api/notifications/unread-count` | Actual unread record count |
| PATCH | `/api/notifications/:id/read` | Mark own record read |
| PATCH | `/api/notifications/read-all` | Mark own unread records read |
| DELETE | `/api/notifications/:id` | Delete own record |

Default page size is 20 and maximum is 100. Other users' record IDs return 404. Read/delete updates notify other active sessions of the same user so they can reconcile from MongoDB.

## Frontend

- Authentication starts/stops the socket lifecycle.
- The header bell shows an immediate unread badge, latest records, mark-read controls, connection state and a full-history link.
- The notification page supports read/unread distinction, timestamps, event types, navigation, mark-one/all, delete, filtering, pagination, loading and error states.
- Incoming record IDs are deduplicated. Session changes abort stale requests and clear prior-account data. Request sequence guards prevent older refreshes from replacing newer state.
- Reconnection/session restoration fetches persisted data; MongoDB is authoritative. Dashboard activity previews refresh after actual notification events.
- No server key or browser localStorage token is used by the notification client.

## Verification

`npm run check` passed with **75 backend tests**, **6 frontend tests**, lint, backend syntax checks and the production build. `npm run test:e2e` passed **all 12 browser tests**, including retained authentication, project/document/assessment cases and separate student/teacher live-session checks on desktop and mobile.

New backend tests verify private rooms, anonymous rejection, multiple sessions, persistence before delivery, concurrent duplicate prevention, isolation, unread counts, filters, pagination, read/delete ownership, mark-all, reconnection recovery, proposal/document/feedback/AI/final-grade events, database failure handling, file retention, JWT expiry and logout disconnection.

The two-session browser test keeps the student dashboard open while a teacher reviews a proposal, provides feedback and finalizes a grade. It verifies immediate unread changes without refreshing, persisted state after reload, mark-read/delete and navigation to the final assessment. Only temporary AI results in automated browser fixtures are mocked; grading APIs, MongoDB and Socket.IO delivery are real.

Real Groq verification also passed through `npm run test:ai:workflow`: uploaded PDF extraction → actual `openai/gpt-oss-20b` response → persisted evaluation → final submission → teacher-adjusted grade → private AI-completion and grade notifications. Synthetic documents and an isolated database were used; temporary records/files were removed. No simulated evaluator is present in the application.

## Run and demonstrate

```powershell
Set-Location D:\my-final-year-project
npm run dev
```

Open http://localhost:5173 in separate browser sessions: `student@fyp.demo` and `teacher@fyp.demo`, password `FypDemo2026!` unless the development seed override was used. The admin account is `admin@fyp.demo` with the same default. Full setup and current limits are in the root README.

There are no remaining external credential blockers. Groq free-tier quotas and the configured 16,000-character AI input budget apply. OCR and production hosting are outside the implemented scope. The rubric remains a demonstration rubric and AI scores remain preliminary.
