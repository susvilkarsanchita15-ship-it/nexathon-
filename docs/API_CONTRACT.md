# INKLOOM AI - API Contract Specification

Base Path: `/api`
Authentication: `Authorization: Bearer <JWT/Token>` with claims `sub, org, role`.

## Endpoints

| Method | Path | Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/register-organisation` | public | Creates organisation + first admin user |
| `POST` | `/auth/login` | public | Returns token and user profile |
| `GET` | `/auth/me` | any | Current user, role, org, onboarding checklist |
| `GET` | `/users` | admin | Lists users in current organisation |
| `POST` | `/users` | admin | Invites/creates a user with assigned role |
| `PATCH` | `/users/:id` | admin | Updates role/status (last-admin protection enforced) |
| `GET` | `/brand-profiles` | read all | Lists profiles with guideline/fact/term/asset counts |
| `PATCH` | `/brand-profiles/:id` | admin | Updates voice notes, palette, external AI flag |
| `GET` | `/brand-profiles/:id/guidelines` | read all | Lists active guidelines |
| `POST` | `/brand-profiles/:id/guidelines` | admin | Creates a new guideline |
| `PATCH` | `/guidelines/:id` | admin | Versioned update (deactivates old, creates version+1) |
| `POST` | `/brand-profiles/:id/guidelines/import` | admin | Paste-and-split style guide parser with category inference |
| `GET` | `/brand-profiles/:id/facts` | read all | Lists facts (expired facts flagged) |
| `POST` | `/brand-profiles/:id/facts` | admin | Creates an approved fact |
| `GET` | `/brand-profiles/:id/terms` | read all | Lists brand terminology |
| `POST` | `/brand-profiles/:id/terms` | admin | Creates a terminology item |
| `GET` | `/brand-profiles/:id/assets` | read all | Lists brand assets |
| `POST` | `/brand-profiles/:id/assets` | admin | Registers asset with mandatory alt text |
| `POST` | `/submissions/extract-text` | creator | Extracts text from .txt/.docx (PDF returns 415) |
| `POST` | `/submissions` | creator | Creates submission and initial version 1 |
| `GET` | `/submissions` | by role | Lists submissions with filtering and pagination |
| `GET` | `/submissions/:id` | by role | Returns submission with latest version and report |
| `POST` | `/submissions/:id/analyse` | creator | Runs reference-grounded pipeline and returns report |
| `PATCH` | `/suggestions/:id` | creator | Accepts, edits, or dismisses a suggestion (reason required for high severity) |
| `POST` | `/submissions/:id/versions` | creator | Stores new version with auto-analysis run |
| `POST` | `/submissions/:id/send-for-review` | creator | Validates all high findings resolved; sets in_review |
| `GET` | `/review-queue` | reviewer, admin | Lists pending submissions sorted by severity then age |
| `POST` | `/versions/:id/decision` | reviewer, admin | Records approval or change request (self-approval forbidden) |
| `GET` | `/versions/:id/diff` | roles with access | Returns word-level diff between two versions |
| `POST` | `/versions/:id/visual-check` | reviewer, admin | Runs pixel-level brand check (CIE ΔE 2000, 64x64 IoU, 15MB body, concurrency guard) |
| `GET` | `/versions/:id/visual-check` | any authenticated | Retrieves latest visual report (supports `?history=1`) |
| `GET` | `/visual-checks/:reportId/status` | any authenticated | Polls real-time analysis pipeline stage & progress percentage |
| `GET` | `/brand-profiles/:id/visual-references` | any authenticated | Retrieves approved logos, color palette, active visual guidelines, readiness |
| `PATCH` | `/visual-issues/:id` | reviewer, admin | Updates review status (`confirmed`, `false_positive`, `needs_correction`); author blocked (403) |
| `POST` | `/visual-issues/:id/comments` | reviewer, admin | Adds reviewer comment/note to a visual issue |
| `GET` | `/analytics/summary` | admin, viewer, reviewer | Returns aggregate metrics and "may be unclear" rules |
| `GET` | `/audit-logs` | admin, viewer | Returns append-only audit trail |
| `POST` | `/eval` | public | Runs labelled test set benchmark (TS-01 to TS-08) |
| `GET` | `/health` | public | Returns health status and active AI provider |
