# Phase 4 AI-assisted assessment

The application uses the existing private Submission files, eight models, project access checks and role dashboards. Real Groq requests are implemented on the backend, following the updated provider instruction. No simulated application mode exists.

## Configuration and live verification

Set `GROQ_API_KEY` in the ignored `server/.env`, then restart Express. `GROQ_MODEL` defaults to the documented `openai/gpt-oss-20b` model. The supplied key and this model were verified with real requests.

The service calls the official Groq endpoint `https://api.groq.com/openai/v1/chat/completions` with the configured model and a [structured JSON schema](https://console.groq.com/docs/structured-outputs). Only the server reads the API key. The model is listed in [Groq model documentation](https://console.groq.com/docs/models).

`npm run test:ai:smoke` passed with a real Groq response containing all ten criteria. `npm run test:ai:workflow` also passed: an actual uploaded PDF was extracted, evaluated by Groq, persisted in an isolated MongoDB database, finally submitted, teacher-adjusted and delivered through real private Socket.IO notifications. Original AI marks were preserved; temporary data was removed. Automated regression tests mock the external API boundary, and browser assessment fixtures are explicitly identified and cleaned up. No simulated application mode exists.

## Extraction and limits

- PDF text is parsed from the actual stored bytes with pdf-parse; DOCX paragraphs are extracted with Mammoth.
- Only authorized, backend-stored documents are eligible. No arbitrary paths or URLs are accepted.
- Maximum AI input: the smaller of the upload limit and 10 MB; 200 PDF pages; the configured extracted-text budget (default 16,000 characters, configurable up to 200,000).
- DOCX ZIP validation limits expanded content and entry count before extraction.
- Empty, corrupt, encrypted/unreadable and unsupported files return meaningful errors.
- OCR is not implemented. Scanned PDFs with no extractable text cannot be reliably evaluated and return an explicit OCR requirement.
- Document text is untrusted prompt data. The system message fixes the rubric, denies document instructions authority and permits no external tools. Responses are independently validated. Neither document text nor provider response bodies are logged.

## Central demonstration rubric

The user supplied these proposed weights. They are **not** claimed to be the research paper's unspecified original rubric. Change `server/src/config/rubric.js` to revise the configuration; evaluation logic reads it centrally and saved evaluations retain their criterion snapshot and rubric version.

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
| Total | 100 |

Each criterion includes marks, maximum marks, explanation, strengths, weaknesses and improvements. Exact names, distinct criteria, numeric ranges and feedback shape are validated. Total marks are calculated server-side; any provider-supplied total is ignored. Timeouts, rate limits, service errors and invalid JSON return safe errors.

## Attempts and final submission

- Limits are shared by a project/group and survive document uploads and retained revisions.
- An atomic MongoDB project lease allows one active evaluation. Simultaneous requests receive 409.
- Only successfully persisted evaluations consume attempts. Invalid documents, provider failures and invalid output consume none.
- The immutable successful Evaluation records are authoritative; the project counter is reconciled from them. A unique `(project, attempt)` index provides a second guard.
- A stale five-minute lease can be reclaimed after a crashed worker. The provider timeout is 90 seconds. Reconciliation handles a crash between saving a result and updating the counter.
- A student may submit the final report after at least one successful formative assessment. Final submission explicitly forfeits any remaining attempt and locks further uploads/evaluations. Two attempts are allowed, not compulsory.
- Earlier files and evaluation records remain available. An AI mark never becomes a final grade automatically.

## Teacher assessment

Only the assigned teacher can finalize a submitted project. The review page shows group details, the final report download, original AI feedback and ten editable teacher scores with a recalculated total. The server validates every adjusted score and calculates the final total again.

Teacher criteria, comments, identity, source evaluation/report and finalization time are stored separately under `Project.finalGrade`. An atomic conditional update allows finalization once. Original AI marks are unchanged. No correction/reopen workflow existed previously, so none was added without a defined policy.

## APIs

- `GET /api/evaluations/config`: configuration availability, model, rubric and limits; never returns the key.
- `POST /api/submissions/:id/evaluate`: authorized student evaluation.
- Existing `GET /api/evaluations` and `GET /api/evaluations/:id`: scoped history.
- `POST /api/projects/:id/final-submission`: final report selection and lock.
- `POST /api/projects/:id/final-grade`: assigned teacher finalization.

## Verification

`npm run check` passed with 61 backend tests, 6 frontend tests, lint, syntax checks and a production build. `npm run test:e2e` passed 10 desktop/mobile checks including actual final-submission and teacher-adjustment forms backed by temporary, explicitly identified assessment fixtures. Coverage includes extraction, invalid files, structured response validation, configured model use, failures without attempt consumption, first/second/third attempts, concurrent requests, ownership, final locks, teacher adjustment and immutable original AI scores.

Real Groq access and the complete assessment/notification path have been verified with synthetic documents. Free-tier rate limits still apply and may reject large or repeated requests; failures do not consume attempts. The application does not claim grading accuracy or equivalence to faculty assessment.
