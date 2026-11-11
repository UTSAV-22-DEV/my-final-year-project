# Phase 1 scope and data foundation

The supplied research paper, `docs/research-paper.docx`, defines the domain. Its statements about a fully implemented application are treated as target behavior; they do not imply these features already exist in this empty repository.

## Acceptance boundary

This phase delivers a runnable React/Vite/Tailwind interface, an Express/Mongoose backend, eight initial data models, health endpoints, middleware foundations, Socket.IO initialization, private Multer configuration, a demo seed, development scripts and automated verification. It stops before account workflows, proposal processing, file exchange, persisted notifications or Grok calls.

The interface displays real health-check results. Module pages explicitly identify planned workflows. No student counts, grades, projects or notifications are fabricated.

## Relationships

| Model | Relationships and purpose |
| --- | --- |
| User | Student, teacher or admin; normalized unique email, bcrypt hash, optional department/student ID |
| Project | Creator and unique student members, optional assigned supervisor, project status and academic year; AI attempt counter; separately recorded final grade with reviewer and timestamp |
| Proposal | Project, submitting user, preferred supervisors; review status, reviewer, date and comment |
| Submission | Project and submitting user; PDF/DOCX metadata, stage and revision number |
| Evaluation | Project, specific submission and requester; attempt 1 or 2, state, model, criterion scores and suggestions |
| Feedback | Project, optional submission and author; feedback text |
| Notification | Individual recipient, optional actor/project; event type and read timestamp |
| Resource | Uploader, optional project; authenticated academic or project audience, document metadata |

Project members must include the creator, and duplicate membership is rejected. Group identity lives on the project instead of adding a separate group model. Assigned supervisors are referenced through `Project.supervisor`. Later authorization must verify student membership, teacher role and assignment; references are not role checks or foreign-key enforcement.

The foundation records AI attempts against the project and enforces a unique `(project, attempt)` index, so replacing a document does not create fresh attempts. The paper does not resolve whether limits are shared by a group or individual students. Confirm that policy before implementing the evaluation service. Reserve attempts atomically, create actual indexes, and define failure/retry semantics in that phase.

Completed evaluations need exactly ten distinct criteria whose weights total 100, marks within each weight, a recorded model and a total equal to the sum. Criterion names and weightages remain configurable data because the paper does not supply them. Test criterion names are synthetic test inputs, not an academic rubric. AI scores and a project's teacher-finalized grade are separate fields.

File metadata stores an opaque storage key, original name, MIME type and byte size. Upload files remain private; no static download route is exposed. Submission revisions are metadata only; Phase 1 does not claim document version history or a replacement/retention policy.

## Backend behavior

- `/api/health` is a liveness response even without MongoDB. It reports database state explicitly.
- `/api/health/ready` requires a connected database. It returns 503 until then.
- Missing database configuration does not invent a working connection or prevent the interface preview from starting.
- `/api/auth/me` verifies an HS256 JWT subject, looks up the active user and returns a safe user projection. Roles come from MongoDB, not the token or client.
- Socket connections use the same token validation and join a user-specific room chosen on the server. Notification creation and emission remain future workflows.
- CORS uses one configured origin, Helmet supplies standard HTTP headers, and JSON bodies are size-limited. Validation and errors have reusable middleware.
- Demo seeding is non-destructive and refuses production. Credentials are supplied only through the server environment.

## Decisions still needed before their respective workflows

1. The exact ten rubric names and weights (sum 100).
2. The xAI model identifier, prompt, response contract and PDF/DOCX extraction process.
3. Whether teachers, administrators or both approve proposals.
4. Whether two attempts are shared by a group or scoped to an individual; treatment of API failures, concurrent requests and retries.
5. Institutional consent, document retention and third-party processing policy before sending student reports to xAI.

None of these gaps blocks verifying the Phase 1 foundation. They must be resolved before implementing the dependent behavior.
