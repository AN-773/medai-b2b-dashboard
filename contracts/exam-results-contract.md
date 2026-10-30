# Exam Results Import Contract (Tests service)

A university's real exam outcomes, imported from a CSV on the cohort page. Served
by **medai-test-service** (`VITE_TEST_API_URL`), for accounts whose token has
`tenant_role` admin or owner; the backend re-checks that for the cohort's tenant.

Storage only: nothing reads these rows for a prediction.

## POST /cohorts/{identifier}/exam-results/import

`{identifier}` is the last path segment of the cohort `id`.

Query params: `dryRun` (`true` or `false`). `true` checks the file and saves nothing.

Request body (`application/json`):

```json
{ "csv": "<file text>", "source": "<file name>" }
```

### The CSV

Header row: `email`, `exam_name`, `exam_date`, `score`, `passed`, and optionally
`max_score`, in any order and any case. Other columns are ignored.

- `email` must belong to a learner in this cohort.
- `exam_date` is `YYYY-MM-DD`.
- `passed` is `true`/`false`, `pass`/`fail`, `yes`/`no` or `1`/`0`.
- The import is **all-or-nothing**: one row with an error saves nothing.
- A row with the same cohort, learner, exam name and date as a saved one updates
  it, so importing the same file again does not duplicate anything. The same
  learner, exam and date twice in one file is a row error.

### Response `200`

Also the body of a `422`, when a save (`dryRun=false`) has row errors.

```json
{
  "dryRun": true,
  "total": 2,
  "valid": 1,
  "saved": 0,
  "rows": [
    {
      "line": 2,
      "email": "learner@example.com",
      "learnerId": "/users/2h9X",
      "learnerName": "Sara Haddad",
      "examName": "Renal block final",
      "examDate": "2026-06-15",
      "score": 78,
      "maxScore": 100,
      "passed": true,
      "error": null
    },
    {
      "line": 3,
      "email": "unknown@example.com",
      "learnerId": "",
      "learnerName": "",
      "examName": "Renal block final",
      "examDate": "2026-06-15",
      "score": 61,
      "maxScore": null,
      "passed": false,
      "error": "this email is not a learner in this cohort"
    }
  ]
}
```

`line` is the row's line in the file, with the header as line 1. A dry run answers
`200` with its row errors. Fields that could not be read keep their zero value, so
the dashboard does not show the score of a row with an error. It renders every value
here as plain text, and never logs rows or emails.

### Refusals

Every refusal except the `422` has the body `{ "error": "..." }`. The dashboard shows
its own sentence for each status, not this text.

| Status | Meaning |
|---|---|
| `400` | The file can't be read at all: empty, a missing column, or no data rows. |
| `403` | The account is not an admin or owner of the cohort's tenant. |
| `404` | No such cohort for this tenant. |
| `413` | The file is over 5 MB or 20,000 rows. |
| `422` | A save with row errors, with the body above. Nothing was saved. |
| `500`, `503` | The check or the save failed. Nothing was saved. |

The dashboard checks the 5 MB limit itself before reading the file.
