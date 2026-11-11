# Final pre-presentation engineering audit

**Audit date:** 11 November 2026 (Asia/Kolkata).

**Baseline:** `167b15d` — `feat: add live notifications and Groq evaluation`.

**Scope:** implemented Phases 1–5, local demonstration, existing architecture.

**Overall result:** **PASS WITH DOCUMENTED LIMITATIONS for the local presentation.** Two reproducible defects were fixed and regression-tested. No unresolved Critical or High finding was identified within the reviewed scope. This is not a production certification or a destructive penetration test.

## 1. Scope, preservation and audit checkpoint

The initial working tree was clean. Package scripts were inspected before execution. The installed runtime is Node.js `24.13.0` and npm `11.17.0`, matching the repository engines. The stack remains React/Vite/Tailwind, Express, Mongoose/MongoDB, cookie JWT authentication and Socket.IO. Groq is the current AI provider.

No UI redesign, new application feature, architectural change, dependency change, schema migration, application-database reset, credential edit or deletion of pre-existing documents was performed. Existing tests were retained.

Backend integration tests and the one live AI smoke test use UUID-named `fyp_test_*` databases and temporary upload directories. Their seed functions operate only inside those isolated test databases. **The application's seed command was not run against the existing demo database.** Browser workflow tests create uniquely marked accounts/projects/documents in the demo database and remove only their own fixtures.

A read-only fingerprint comparison before and after the browser tests confirmed:

- No pre-existing project, proposal, submission, evaluation, feedback, resource or notification record changed or disappeared.
- Existing account identity, password hashes, roles and activation status remained unchanged. Normal logout tests advance session revocation counters and account timestamps; previous sessions may need to sign in again.
- No pre-existing upload file changed or disappeared; no test upload remained.
- No new browser-test records remained in any of the eight application collections.
- Existing `server/.env` and any existing `client/.env` remained byte-for-byte unchanged.

The database contained three active demo accounts, one project and one proposal; no submissions, evaluations, feedback, resources or notifications were present before or after fixture cleanup. This describes the existing demo state, not missing implementation.

The fixes, regression coverage and this report are recorded in the separate audit checkpoint after `167b15d`. Obtain its ID with `git log -1 --oneline -- docs/final-audit.md`.

## 2. Commands, tests and honest failure history

| Command/check | Result |
| --- | --- |
| `npm run check` at the baseline | Passed: lint, 75 backend tests, 6 frontend tests, backend syntax and production build |
| `npm test` at the baseline | Passed: 75 backend and 6 frontend tests |
| `npm run test` at the baseline | Passed: 75 backend and 6 frontend tests; this aliases the same test script |
| Focused assessment regression tests before fixes | Failed as intended, demonstrating null-criterion errors and late proposal mutation; see findings below |
| Focused assessment regression tests after fixes | 25 passed, zero failed/skipped |
| Final `npm run check` | **Passed: 79 backend tests, 6 frontend tests, lint, syntax and production build; zero failed/skipped/cancelled backend tests** |
| First `npm run test:e2e` | **10 passed, 2 failed**; desktop notification and login checks encountered backend restarts and HTTP 502 responses |
| Second `npm run test:e2e`, with source edits paused | **12 passed**, desktop and mobile; final-grade notification refresh assertion included |
| `npm run test:ai:workflow` | **Passed once**, using a real uploaded PDF and a real Groq request; not repeated |
| Separate browser navigation/console sweep | 30 destinations passed across all roles; zero console errors, uncaught page exceptions, failed non-aborted requests or HTTP 5xx responses |
| Local security probes | Passed: login rate limit, missing CSRF header, disallowed origin, malformed JSON, anonymous project access and absence of public upload downloads |
| Fresh backend startup on temporary port 4100 | Passed; MongoDB connected and readiness returned HTTP 200; temporary process stopped |
| Production cookie configuration probe | `HttpOnly=true`, `Secure=true`, `SameSite=lax`, path `/` |
| `npm audit --omit=dev --json` | Zero reported production dependency vulnerabilities; development dependencies were not covered by this advisory check |
| `npm ls --depth=0` | Passed; installed dependency tree valid |
| `git diff --check` | Passed |

Failure details are retained here rather than replaced by the final passing results:

1. A first proposal-lock regression payload omitted required proposal fields and returned 400. The fixture was corrected to contain complete valid content. The subsequent reproduction returned **200 and changed the final project's status to `proposed`**, confirming a real state defect.
2. The null teacher criterion reproduction returned **500 instead of 400**. Direct AI-result validation raised `TypeError` for a null criterion. Both validation paths now return structured errors.
3. The first browser traces show `/api/auth/me` and `/api/health` returning 502 around **21:12:07 IST**, and `/api/auth/login` returning 502 around **21:12:18 IST**. The existing development server log shows watch-mode restarts and matching proxy connection errors. No timeout was increased and no assertion removed to obtain the second run's 12 passes. Initial traces remain locally under `.local/final-audit-first-e2e/` (ignored).
4. The added DOCX byte-integrity assertion initially failed because Supertest does not automatically parse the DOCX MIME type into a Buffer. An explicit binary response parser fixed the audit test. The application's download implementation was unchanged. The final complete gate then passed.
5. A health probe briefly encountered `ECONNREFUSED` during watch-mode restarts. An attempted second `npm run dev` exited because port 5173 was already occupied; it did not establish a second service stack. Subsequent health checks and an independent fresh backend startup succeeded.

Some backend logs intentionally contain safe 502/503 messages from injected provider/persistence failures; those are passing error-path tests, not hidden suite failures. No final suite tests were skipped. `test:ai:smoke` was deliberately not also run because the single full live workflow already exercised Groq. No second live Groq evaluation was requested; attempt two and attempt three rejection were tested with a mocked provider boundary and real persistence.

Local audit scripts/results are under `.local/final-audit-*`, which is Git-ignored. The final full gate output is `.local/final-audit-check.log`; the final browser status is `test-results/.last-run.json`. Playwright traces can contain test-session cookies; these artifacts must remain private and uncommitted.

## 3. Complete workflow verification (A–T)

Evidence references:

- **W:** [workflow integration tests](../server/test/workflows.integration.test.js), real HTTP handlers, MongoDB and files.
- **A:** [assessment integration tests](../server/test/assessment.integration.test.js), real extraction, state transitions and MongoDB; provider responses injected only at the external API boundary.
- **N:** [notification integration tests](../server/test/notifications.integration.test.js), real authenticated Socket.IO and MongoDB.
- **B:** [workflow browser tests](../tests/e2e/workflows.spec.js) and [two-session notification browser tests](../tests/e2e/notifications.spec.js), desktop/mobile. Temporary evaluation records are explicitly labelled browser fixtures, not actual provider output.
- **L:** [live workflow smoke script](../server/scripts/live-workflow-smoke.js), one actual Groq request in an isolated database.

| Step | Result and evidence |
| --- | --- |
| A. Admin creates group, adds students, assigns teacher | PASS — W verifies creation, membership updates, active supervisor and duplicate active-group rejection; B exercises admin creation through the UI. |
| B. Student submits proposal | PASS — W/B persist the form and pending review state. |
| C. Teacher requests proposal revision | PASS — W verifies assigned-teacher authorization, decision, comment and audit trail. |
| D. Student resubmits proposal | PASS — W verifies creator edit/resubmit and updated methodology. |
| E. Teacher approves proposal | PASS — W/B verify approval and active project state. |
| F. Student uploads PDF/DOCX | PASS — W verifies both report formats; B verifies PDF upload and DOCX resource sharing. Extraction tests separately parse actual PDF and DOCX text. |
| G. Teacher downloads authorized submission | PASS — W verifies PDF and DOCX downloads, including DOCX byte equality; unrelated users receive 404. B verifies browser download. |
| H. Student requests AI evaluation | PASS — A exercises the endpoint; L exercises actual uploaded-PDF extraction and Groq. The browser evaluation-request button's real provider call was not separately automated. |
| I. Ten scores and total persist | PASS — A/L verify completed Evaluation records, rubric/document snapshots, total and project attempt count. |
| J. Second evaluation attempt | PASS — A verifies persisted attempt two with an injected provider response. |
| K. Third attempt rejected | PASS — A receives 409 `ATTEMPT_LIMIT` and verifies the evaluator is not called. |
| L. Extraction/provider failures preserve attempts | PASS — A covers corrupt PDFs, provider errors and invalid scores. Unit tests cover empty/unreadable reports, oversized text, missing configuration, rate limits and timeouts. |
| M. Student submits final report | PASS — A/B/L verify final submission and retained evaluation history. |
| N. Evaluation prevented after final submission | PASS — A verifies evaluation/upload rejection and stale-lease handling. New regressions prevent late proposal actions from reopening submitted/completed projects. |
| O. Teacher reviews AI scores | PASS — A verifies assigned access; B displays preliminary assessment and the teacher editor. |
| P. Teacher modifies criterion marks | PASS — A/B/L verify changes and validation; out-of-range/null entries are rejected. |
| Q. Teacher finalizes grade | PASS — A/B/L verify finalized status, server total, reviewer/time and repeat-finalization rejection. |
| R. Original AI marks preserved | PASS — A verifies original total and criterion marks; L verifies the original total remains unchanged. No API edits completed Evaluation records. |
| S. Student receives final-grade notification | PASS — N/B/L verify persisted private delivery; B keeps a separate student browser session open. |
| T. Notification persists after refresh | PASS — B now reloads the student page after grade delivery, verifies the unread badge, then opens the retained grade notification and final result. |

This is combined integration, browser and one live-provider proof. It does not claim that every step was performed in one uninterrupted browser session against Groq twice.

## 4. Security findings by severity

### Critical

**None identified within the reviewed scope.** No destructive attack, external target probing or credential extraction was performed.

### High

**SEC-H1 — Final-submission state could be reopened by a late proposal action — FIXED.**

Before the fix, `submitProposal` and `reviewProposal` could set Project status to `proposed`/`active` after the report had been finally submitted. Upload and evaluation locks depend on that status. A group member with a still-open proposal could therefore undermine finalization; an existing final grade could remain attached to a regressed project state.

Reproduction: in an isolated project with valid proposal content and final project state, late proposal submission returned 200 and persisted `status: proposed`. The fix adds final-state guards for editing/submitting/reviewing and conditional project status writes that exclude `submitted` and `completed`. It neither changes documents/grades nor introduces a new workflow. See [proposal controller](../server/src/controllers/proposalController.js), particularly `assertProjectOpen` and all proposal-to-project status updates. Regression coverage checks draft, revision-requested and pending proposals against both final states.

**No unresolved High finding remains from this audit.**

### Medium

**SEC-M1 — Business operation and notification persistence are not transactional — ACCEPTED LIMITATION.**

The business record is saved before recipient notification writes. A database failure or process exit between those writes can leave a saved operation without all notifications. An evaluation can have succeeded and consumed an attempt even when its HTTP response is 503 because notification persistence failed. See section 6 for consequences. No outbox/worker/transaction architecture was introduced.

**SEC-M2 — Authenticated resource usage lacks aggregate ceilings — OPEN, production hardening.**

Individual file, JSON, DOCX expansion and AI text limits exist, but no per-user storage quota, aggregate upload count limit or general AI-request rate limiter exists. A group member can repeatedly upload allowed-size reports; repeated provider failures do not consume successful attempts and can still consume account quota. The project evaluation lease serializes work for that project but is not an account-wide abuse limit. No load/denial-of-service experiment was performed. This is not a blocker for the controlled local presentation; quotas and operational monitoring should precede wider exposure.

### Low

**SEC-L1 — Null criterion entries caused unstructured server errors — FIXED.**

Accessing `entry.name` before verifying entry shape caused teacher grade requests to return 500 and direct AI-result validation to throw `TypeError`. Both paths now reject null, scalar and array entries before accessing properties. Teacher input returns 400 `VALIDATION_ERROR`; malformed upstream content returns 502 `INVALID_AI_RESPONSE`. Tests also confirm rejection does not save a grade. See [evaluation controller](../server/src/controllers/evaluationController.js) and [Groq service](../server/src/services/groqService.js).

**SEC-L2 — Login limiter is process-local — OPEN, deployment limitation.**

The 30-failed-request/15-minute limiter is effective in a single instance and was exercised locally. Counters reset on restart and are not shared across instances. Reverse-proxy trust configuration also needs deliberate deployment setup. No new limiter architecture was added.

### Security control inspection

| Control | Finding/evidence |
| --- | --- |
| Authentication/cookies | bcrypt hashing; eight-hour HttpOnly cookie, SameSite=Lax; Secure enabled in production. No browser localStorage JWT. Production cookie flags probed. |
| JWT validation | HS256 allowlist, signature/expiry validation, valid subject and expiry required; user/account status and token version loaded from MongoDB. Tampered-token tests pass. |
| Session revocation | Logout revokes all account sessions and disconnects sockets. Account status changes invalidate old tokens. |
| Role authorization | Server route guards restrict administrative, teacher and student operations; public registration cannot elevate roles. Cross-role tests pass. |
| Student ownership | Project queries require current membership; changing URL IDs does not grant access; removed members lose record access. |
| Teacher assignment | Project access requires current supervisor assignment; final-grade atomic update also includes the supervisor ID. Unassigned teacher read/grade tests pass. |
| Document downloads | Authenticated project access required; uploads have no public static route. Browser/PDF/DOCX and unauthorized-download tests pass. |
| File validation | MIME/extension allowlist, PDF signature, DOCX required ZIP entries and expanded-size/entry ceilings, Multer limits; default file maximum 10 MB. Signature checks are not malware scanning. |
| Path traversal | UUID storage filenames; restrictive storage-key regex and resolved-parent check; no user-supplied filesystem path is accepted for downloads. Model/path tests pass. |
| Notification privacy | Recipient-scoped APIs, server-chosen rooms, no report text/prompt in messages. Other users' read/delete IDs return 404. |
| Socket authentication | Cookie/token validated against the same account state; origin restrictions, expiry disconnection and logout/deactivation disconnection. Anonymous/private-room tests pass. |
| Request validation | Explicit field/type/length/object-ID checks, bounded JSON, allowlisted statuses and numeric rubric ranges. Audit score-shape gaps fixed. This is not exhaustive fuzz testing. |
| Login rate limiting | Local probe: first 30 malformed login failures return 400; next returns 429 `RATE_LIMITED`. Existing demo-server limiter was not flooded. |
| CSRF/origin | Mutations require `X-FYP-Request: 1`; disallowed Origin rejected; credentialed CORS uses configured origins. Tests/probes pass. |
| Secret exposure | Configured URI/JWT/Groq secret values were scanned against tracked files and built frontend assets; zero matches. No private-key/Groq-key pattern found in tracked text; `.env` files absent from Git history. This is not an exhaustive historical entropy scan. |
| Logs/errors | Application logs omit URI/key/token/report/provider-response content and avoid stack traces in API responses. Injected errors log only safe names/status. Private browser traces can contain cookies and remain ignored. |
| AI key handling | `GROQ_API_KEY` is read only by server configuration and placed only in the outbound Authorization header. No key is returned by evaluation configuration or bundled into the client. |

## 5. AI evaluation audit

**Effective configuration:** provider Groq; model **`openai/gpt-oss-20b`**; endpoint `https://api.groq.com/openai/v1/chat/completions`; strict JSON-schema response format; `reasoning_effort: low`; `max_completion_tokens: 3000`. Runtime configuration and the live smoke result agree. Account billing/tier was not queried; free-tier rate/token budgets remain external constraints.

**Extraction:** submission storage metadata resolves through the private document path helper. `pdf-parse` extracts actual PDF page text; Mammoth extracts DOCX raw text after ZIP inspection. Missing, empty, corrupt, unsupported, encrypted/unreadable and textless documents fail safely. No OCR exists. Extraction does not silently replace the report with sample content or silently truncate it.

**Limits:** AI documents are at most the smaller of configured upload size and 10 MB; PDFs at most 200 pages; extracted text defaults to **16,000 characters**. `AI_MAX_TEXT_CHARS` can be configured from 1,000 to 200,000, but increasing it does not increase provider quota. DOCX ZIP inspection caps declared expanded data at 40 MB total, 10 MB per entry and 2,000 entries. Parsing is not a separately isolated resource sandbox and has no dedicated extraction timeout; the 90-second timer applies to the provider request.

**Rubric:** `demonstration-v1`, explicitly a demonstration rubric rather than the paper's unspecified institutional weights.

| Criterion | Maximum |
| --- | ---: |
| Abstract and Summary | 5 |
| Introduction and Background | 10 |
| Problem Statement | 10 |
| Objectives and Scope | 10 |
| Literature Review | 10 |
| Methodology and Design | 15 |
| Implementation and Technical Depth | 15 |
| Results and Evaluation | 10 |
| Conclusion and Future Scope | 5 |
| Formatting, References and Clarity | 10 |
| **Total** | **100** |

**Validation:** exactly ten distinct configured names, finite numeric marks within each weight, bounded nonempty explanations/suggestions and bounded feedback arrays. Marks are rounded to two decimal places. The server recomputes the total and ignores supplied totals. The Evaluation model independently checks criterion weight/total consistency and stores criterion/document snapshots, model, rubric version, submission, requester, attempt and completion time.

**Concurrency and attempts:** a conditional project update acquires a five-minute evaluation lease. Concurrent requests receive 409; a unique `(project, attempt)` index prevents duplicate attempt numbers. Persisted successful evaluations are authoritative, with the project counter reconciled while releasing the lease. A stale lease can be reclaimed. Provider failure, invalid response or extraction error before Evaluation creation consumes no successful attempt. A process crash or notification failure after Evaluation creation can leave a successful attempt despite an unsuccessful HTTP response; refresh history before retrying. No multi-instance soak/crash test was performed.

**Teacher override/final protection:** the assigned teacher submits ten bounded marks and a required comment. The server sums them and atomically changes a submitted, ungraded project to completed while recording the original evaluation reference, selected final submission, reviewer and time. Repeated finalization is rejected. AI records remain separate. Final submission closes unused attempts; the proposal-state bypass is now fixed. Grade reopening/correction is not implemented.

**Timeout/errors:** Groq fetch timeout is 90 seconds; the browser evaluation request allows 120 seconds. Rate limits, outages, missing configuration, oversized requests and invalid structured output return actionable, sanitized errors. No silent simulated evaluator exists. Tests inject a provider function through an internal app setting; there is no public endpoint to enable that setting.

**Live result:** exactly one provider workflow call passed during this audit: ten criteria, AI total 1, teacher-adjusted total 11, persisted successful-attempt count 1, AI-completion and grade notifications delivered, original AI total preserved and temporary data removed. These scores came from a short synthetic report and are **not accuracy evidence**.

The application labels results preliminary and states that teachers control final grades. It makes no measured accuracy/agreement claim. Prompt instructions treat report text as untrusted data, allow no tools and fix the rubric; output validation protects structure/ranges, not the academic correctness or complete prompt-injection resistance of the marks. Institutional rubric approval and grading-validity studies remain outside this implementation.

## 6. Notification audit and outbox implications

| Requirement | Result |
| --- | --- |
| Authenticated connections/private rooms | PASS — server joins only `user:<authenticated ID>`; no client-controlled room subscription handler. |
| Correct recipients | PASS in reviewed controllers/tests — proposal/upload/final-report updates go to supervisor; reviews/feedback/resources/AI/grades to project members; administrative account activity to admins; group assignments to relevant members/supervisor. |
| Database persistence | PASS — notification is stored before emission. Transport failure preserves it. |
| Duplicate prevention | PASS — deterministic event keys, per-recipient upserts and unique partial `(recipient, eventKey)` index; concurrent duplicate test passes. |
| Reconnection recovery | PASS — reconnect/session restoration refetch persisted records and unread counts. |
| Multiple sessions | PASS — all authenticated sessions in the user's room receive updates; read/delete actions trigger same-user refresh. |
| Unread counts | PASS — persisted `readAt` state, account-scoped counts, mark-one/all and filters/pagination tested. |
| Ownership validation | PASS — another recipient's IDs cannot be read/modified/deleted through these APIs. |
| Frontend recovery/privacy | PASS in tested paths — user-change request cancellation/sequence guards, record-ID deduplication and current project-access check before navigation. |

**There is no transactional outbox or durable retry worker.** Business writes and recipient notification writes occur separately and recipients are processed sequentially. A crash or database failure can leave zero/some notifications missing after a successful business operation. The service returns 503 `NOTIFICATION_PERSISTENCE_FAILED` when it detects persistence failure and tells the user to refresh before retrying. Saved document files are retained; no fabricated success notification is emitted.

Reconnection recovers notifications that already exist; it **cannot recreate a notification that was never persisted**. Deterministic event keys prevent duplicates for the same business event, but they do not make every business endpoint idempotent. Retrying a finalized grade may return 409 rather than repair the missing event; retrying an upload can create a new revision. For the presentation, verify the actual project/evaluation state after an error and avoid blindly repeating the action. Reliable atomic event delivery is a later architecture decision, explicitly not implemented in this audit.

## 7. Presentation readiness and blockers

**No current presentation blocker remains.** Final health checks returned HTTP 200 for frontend, API liveness and readiness; MongoDB was connected. MongoDB URI, JWT secret and Groq key/model are configured. Their values were neither displayed nor changed.

All three accounts are present, active and successfully exercised by browser login tests:

| Role | Account |
| --- | --- |
| Student | `student@fyp.demo` |
| Teacher | `teacher@fyp.demo` |
| Admin | `admin@fyp.demo` |

The documented development password `FypDemo2026!` (or an existing `DEMO_PASSWORD` override) is used by the tests. No account/password reset was performed. Use separate browser profiles/contexts for different roles: cookies are shared across ordinary tabs, and logout revokes all sessions of that account.

The independent navigation sweep covered all sidebar destinations for each role plus existing project detail pages, with zero console/page/network/server errors. The desktop/mobile workflow suites cover forms, downloads, feedback, grading and notification navigation. This is not an exhaustive cross-browser/accessibility audit; mobile tests emulate an iPhone viewport using Chromium, not native Safari.

Operational risks before presenting:

1. **Freeze source edits during the demo.** Watch-mode restarts caused the first browser failures. For presentation, the existing non-watch backend command below avoids those edit-triggered restarts. Do not start a second stack on occupied ports.
2. **Use an extractable, short PDF/DOCX.** Scanned PDFs and long full dissertations can fail the current OCR/text budget. This is a documented input ceiling, not a reason to alter credentials or limits immediately before presenting.
3. **Groq and MongoDB require working network access.** One current real call passed, but tomorrow's service availability/quota cannot be guaranteed. Avoid repeated rehearsal calls; only two successful attempts are available per project.
4. **Final submission/grade are intentionally locking operations.** Complete revisions/evaluations first; teacher finalization cannot be undone through the app. Do not finalize the only demo project prematurely.
5. **Existing demo history is empty.** Test fixtures were removed; they were not left behind as real assessments. The seed proposal is a minimal initial record, so fill all required content if demonstrating its edit/resubmission flow. No demo data was manufactured during the audit.

## 8. Recommended actions in priority order

| Priority | Action | Status |
| --- | --- | --- |
| P0 | Prevent proposal actions from reopening final project states | **Fixed and regression-tested** |
| P1 | Validate criterion objects before accessing fields | **Fixed and regression-tested** |
| P1 — presentation | Use a stable backend process, separate role sessions, suitable document and verify readiness before the demonstration | Operational preparation; no feature change required |
| P2 — reliability | Choose a transactional outbox/retry strategy and endpoint idempotency before promising guaranteed event delivery | Deferred; architecture change prohibited in this audit |
| P2 — wider exposure | Add aggregate storage/request budgets, deliberate proxy/rate-limit deployment configuration and monitoring | Deferred; no new features added |
| P2 — academic use | Approve the rubric institutionally and measure validity, teacher agreement and prompt-injection robustness | Not measured; no accuracy claim made |

Do not upgrade dependencies, reset the database, change credentials or redesign working screens immediately before the presentation solely for speculative improvement.

## 9. Known limitations

- Groq quotas, stochastic model output and external service availability apply. API success does not establish grading accuracy.
- No OCR, antivirus service, isolated document-processing sandbox or full-dissertation input guarantee.
- Per-document bounds exist; aggregate disk/account quotas and sustained-load testing do not.
- No transactional outbox; multi-document workflow writes can partially complete during database/process failures.
- Final selected report can differ from the earlier AI-evaluated revision. Source document references are retained; teachers must compare the final report with the relevant AI history.
- No grade correction/reopening workflow; finalization is intentionally one-time.
- Several UI selectors/history loads request at most 100 records; large institutional datasets were not tested.
- Local disk document storage, single-process limiter and local development hosting remain the current deployment model. HTTPS hosting, backups, disaster recovery and production operations were not certified.
- This audit did not perform exhaustive fuzzing, external penetration testing, denial-of-service tests, multi-instance crash tests or independent grading-validity studies.

## 10. Final run commands

The existing services may already be running. Check readiness first; do not launch duplicate services on the same ports.

```powershell
Set-Location D:\my-final-year-project
Invoke-RestMethod http://localhost:4000/api/health
Invoke-RestMethod http://localhost:4000/api/health/ready
```

For a presentation start, stop the existing development command in its terminal if it owns these ports, then use two terminals:

```powershell
# Terminal 1 — existing backend start script, without a file watcher
Set-Location D:\my-final-year-project
npm start --workspace server
```

```powershell
# Terminal 2 — frontend
Set-Location D:\my-final-year-project
npm run dev:client
```

Open **http://localhost:5173**. The usual combined development command remains:

```powershell
npm run dev
```

Verification, when required:

```powershell
npm run check
npm run test:e2e
```

`npm test` and `npm run test` are equivalent and already ran during this audit. Do not run `npm run seed` to repair an existing demo without reviewing its effect. `npm run test:ai:workflow` was run once and passed; it consumes Groq quota and is not a routine startup requirement.
