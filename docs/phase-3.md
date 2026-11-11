# Phase 3 project workflows

This phase extends the existing eight models, JWT/cookie middleware, scoped query services, Multer configuration, Socket.IO initialization and shared interface. No AI evaluation is enabled in this checkpoint.

## Functionality

- Administrators create groups, choose a name and project title, add/remove existing students and assign active supervisors. Project is also the group record; no duplicate Group model was added.
- A unique partial multikey index on active Project members prevents concurrent assignment of a student to multiple active groups. Request validation rejects duplicate/invalid members. Completed groups release the active membership constraint. Removing the lead transfers project ownership to a remaining member; proposal creator records are preserved. Groups retain at least one member and membership locks after final submission.
- Students create complete proposals, save drafts, edit drafts/revision requests, submit/resubmit and see review comments. The creator alone may edit. Teachers review assigned projects; admins can also review. Approval, rejection and revision decisions are recorded with reviewer, comment and timestamp in an audit trail. A unique partial index prevents multiple open proposals for one project.
- PDF and DOCX reports upload into private UUID-based storage. Resubmission creates a separate Submission revision and retains the earlier file. This is retained report history, not a full version-control system.
- Assigned teachers review submissions, add/update their own categorized feedback and mark a report approved, reviewed or requiring revision. Students see the author, associated report and timestamp.
- Teachers share PDF/DOCX resources with their assigned groups; only authorized participants can download them.
- Group changes, proposal submissions/decisions, document submissions, feedback and resource availability create persisted notifications and emit events to authenticated user rooms.
- Functional pages include group management, proposal forms/reviews/history, private documents/details/downloads, feedback forms, resources and all role dashboards.

## APIs added or completed

| Method | Path | Access |
| --- | --- | --- |
| GET | `/api/groups` | Own/assigned groups; admins all |
| POST | `/api/admin/projects` | Admin creates group/project |
| PATCH | `/api/admin/projects/:id/group` | Admin updates members/details |
| PATCH | `/api/admin/projects/:id/supervisor` | Admin assigns active teacher |
| GET | `/api/teachers` | Authenticated supervisor preferences |
| POST | `/api/proposals` | Student creates draft or submits |
| PATCH | `/api/proposals/:id` | Student creator edits permitted state |
| POST | `/api/proposals/:id/submit` | Student creator submits/resubmits |
| PATCH | `/api/proposals/:id/review` | Assigned teacher or admin |
| POST | `/api/projects/:id/submissions` | Group student uploads report |
| POST | `/api/submissions/:id/replace` | Group student adds a retained revision |
| GET | `/api/submissions/:id/download` | Authorized project participant |
| POST | `/api/feedback` | Assigned teacher |
| PATCH | `/api/feedback/:id` | Author, while still assigned |
| GET | `/api/resources` | Authorized resources |
| POST | `/api/projects/:id/resources` | Assigned teacher uploads resource |
| GET | `/api/resources/:id/download` | Authorized academic/group audience |

Existing project, proposal, submission, feedback and evaluation read APIs remain scoped. Lists use page/limit metadata where applicable; default page size 20, maximum 100. Mutations retain the Phase 2 CSRF header/origin checks.

## Files and security

- Authentication and project ownership are checked before Multer writes files.
- Default upload limit is 10 MB, configurable through `MAX_FILE_SIZE_MB`.
- Extension and declared MIME must agree. PDF bytes must start with a PDF signature. DOCX ZIP containers must include Word document and content-type parts, with limits on entry count and expanded sizes.
- Full PDF parsing/text extraction is Phase 4; signature validation alone does not establish that every PDF is readable or safe.
- Opaque storage keys are checked against a narrow filename format, resolved inside the configured storage directory, and never accepted as arbitrary client paths.
- Invalid/new failed uploads are cleaned up. Earlier successful report revisions are retained.
- No public static upload directory exists. Downloads require a session and project access and use private/no-store responses.
- Hidden private storage directories are supported only after canonical path validation; this fixed an issue found by the integration tests.
- Database-dependent integration tests use unique test databases. Browser workflows use uniquely marked temporary accounts/groups and clean only their own IDs, files and associated notifications.

## Verification

`npm run check` passed: lint, 39 backend tests, 6 frontend tests, syntax checks and production build. `npm run test:e2e` passed all 10 desktop/mobile checks. The suite retains Phase 1/2 coverage and adds live database tests for groups, membership conflicts, proposal audit/revision/approval, unauthorized reviewers, valid/invalid/oversized uploads, authorized downloads, retained revisions, categorized feedback, resources and persisted real socket delivery. Desktop/mobile browser tests perform the actual group/proposal/report/feedback/resource forms and downloads.

## Startup

```powershell
Set-Location D:\my-final-year-project
npm ci
npm run seed
npm run dev
```

The supplied MongoDB URI is verified and remains in the ignored `server/.env`. Demo credentials are documented in `phase-2.md`. No secrets are committed. The later provider instruction selected Groq. Its configuration and successful live verification are documented in `phase-4.md`.
