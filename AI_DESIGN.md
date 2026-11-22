# MyHours AI

The built-in screen is first-party application code. It is not an iframe or an embedded ChatGPT site. Core data access, schedules, priority explanations, grade calculations and read-only summaries work without a hosted model. The UI explicitly labels those tools as local and rule-based.

Local validated tool names: `getUpcomingTasks`, `getCourseSnapshot`, `getAvailableTime`, `retrieveNotes`, `draftSchedule`, `analyzeGradeScenario`, `suggestProjectNextStep`, `summarizeWeek`, `buildShareableSnapshot`. They return structured values and do not mutate data. Grade scenarios use only provided assessment points and category weights; open-ended grade optimization is not implemented.

The hosted path accepts a bounded question and approved record IDs/kinds, never an identity supplied by the caller. The edge function verifies the session with Auth, fetches those exact records under RLS, rejects incomplete/unsynced context, trims note bodies and reserves a rate-limited quota atomically. It calls an administrator-configured HTTPS provider using a server-side key. Provider output must satisfy a schema, and all claim and draft references must belong to approved records. The client validates again.

Claims are displayed with openable record references. Introductory prose should contain no personal-data claims; concrete claims belong in the cited claim array. Schema and ID validation cannot establish full semantic accuracy. Review model answers against the underlying records. A fabricated fact with an otherwise valid citation remains a model risk.

Write authority is absent from the model endpoint. Suggested tasks open an editable preview and require an explicit Save. Calendar drafts require a separate confirmation and fresh overlap checks. Natural capture resolves ISO dates, today and tomorrow; named weekdays remain ambiguous and require an exact date in the review form. The model cannot delete, email, share, purchase, contact anyone or edit an external calendar.

Privacy controls are per request. Full note contents are available only when the note category is selected and consent is given; no category is silently added. The first 40 selected records are visibly listed. Retrieval is bounded lexical/structured lookup, not a hidden vector index. Session history is not retained by default. The function logs no prompts or record bodies.

Cost controls: 20 reserved calls/user/UTC day, 10-second spacing, 16 KB request envelope, 40 IDs, 45,000 context characters, 1,800 maximum output tokens, 25-second provider timeout and output size/schema limits. These bound request usage; they do not calculate a dollar cost. Configure a provider-level hard spending limit and monitor that dashboard. The UI reports unknown monetary cost honestly.

Source and local grounding tests are implemented. A hosted model, production quotas, live authorization, prompt-injection red-team evaluation and actual tutoring quality need credentials and have not been verified. Optional on-device model inference is not included.
