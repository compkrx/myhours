import type { Kind } from "../domain/model";
export interface Field {
  key: string;
  label: string;
  type?:
    | "text"
    | "textarea"
    | "number"
    | "date"
    | "datetime"
    | "checkbox"
    | "select"
    | "multi";
  options?: string[];
  ref?: Kind;
  required?: boolean;
  hint?: string;
  default?: string | number | boolean;
}
const f = (
  key: string,
  label: string,
  type: Field["type"] = "text",
  extra: Partial<Field> = {},
): Field => ({ key, label, type, ...extra });
const notes = f("notes", "Notes", "textarea");
const taskFields: Field[] = [
  f("status", "Status", "select", {
    options: ["open", "in-progress", "submitted", "done", "excused"],
    default: "open",
  }),
  f("due", "Due date", "date"),
  f("hard", "Hard deadline", "checkbox"),
  f("importance", "Importance (1–3)", "number", { default: 2 }),
  f("minutes", "Estimated minutes", "number", { default: 30 }),
  f("priorityOrder", "Today priority (0 = none, 1–3)", "number", {
    default: 0,
  }),
  f("dependencies", "Waiting for", "multi", { ref: "task" }),
  f("recurrence", "Repeat after completion", "select", {
    options: ["none", "daily", "weekly"],
    default: "none",
  }),
  notes,
];
export const configs: Record<
  Kind,
  { singular: string; plural: string; fields: Field[]; empty: string }
> = {
  musicSource:{singular:'music source',plural:'Music sources',fields:[f('url','Spotify or YouTube URL','text',{required:true}),notes],empty:'Save a playlist or track link.'},
  routineCheck:{singular:'completed routine step',plural:'Routine checks',fields:[f('date','Date','date',{required:true}),f('day','Day'),f('stepId','Step key','text',{required:true}),f('step','Routine step','textarea',{required:true}),f('completed','Completed','checkbox',{default:true})],empty:'Completed steps from a day template appear here.'},
  flashcard:{singular:'flashcard',plural:'Flashcards',fields:[f('front','Question / front','textarea',{required:true}),f('back','Answer / back','textarea',{required:true}),f('deck','Deck','text',{default:'General'}),f('courseId','Course','select',{ref:'course'}),f('nextReview','Next review','date'),notes],empty:'Create a card with a question you can try to recall.'},
  lessonProgress:{singular:'lesson reflection',plural:'Lesson reflections',fields:[f('lessonId','Lesson ID','text',{required:true}),f('status','Status','select',{options:['in-progress','reviewed'],default:'in-progress'}),f('reflection','Reflection','textarea'),f('nextReview','Next review','date')],empty:'No lesson reflections yet.'},
  lessonAttempt:{singular:'practice response',plural:'Practice responses',fields:[f('lessonId','Lesson ID','text',{required:true}),f('questionId','Question ID','text',{required:true}),f('answer','Answer index','number',{required:true}),f('correct','Matches answer key','checkbox'),f('checkedAt','Checked at','datetime',{required:true}),notes],empty:'No checked responses yet.'},
  schoolSource: {
    singular: "school portal",
    plural: "School portals",
    fields: [f("url", "Portal URL", "text", { required: true }), notes],
    empty: "Save the portal link. File imports stay local.",
  },
  importLog: {
    singular: "import log",
    plural: "Import history",
    fields: [],
    empty: "No imports recorded.",
  },
  task: {
    singular: "task",
    plural: "Tasks",
    fields: [
      ...taskFields,
      f("area", "Life area"),
      f("projectId", "Project", "select", { ref: "project" }),
      f("labels", "Labels"),
    ],
    empty: "A clear inbox starts with one real next step.",
  },
  course: {
    singular: "course",
    plural: "Courses",
    fields: [
      f("teacher", "Teacher (optional)"),
      f("period", "Period"),
      f("reportedGrade", "Reported grade snapshot (%)", "number"),
      f("gradeAsOf", "Snapshot date", "date"),
      f("gradeSource", "Snapshot source"),
      f(
        "gradeVerified",
        "I verified this snapshot against the gradebook",
        "checkbox",
      ),
      f("policy", "Grading policy", "textarea"),
      f("weaknesses", "Concepts to revisit", "textarea"),
      notes,
    ],
    empty:
      "Add your classes when you’re ready. Grades stay unknown until you enter them.",
  },
  assignment: {
    singular: "assignment",
    plural: "Assignments",
    fields: [
      f("courseId", "Course", "select", { ref: "course", required: true }),
      ...taskFields,
      f("verifiedAt", "Date last verified", "date"),
      f("impact", "Known grade impact (%)", "number"),
      f("links", "Attachment links (no uploads)"),
    ],
    empty: "Keep actual assignments and deadlines together.",
  },
  assessment: {
    singular: "assessment",
    plural: "Gradebook",
    fields: [
      f("courseId", "Course", "select", { ref: "course", required: true }),
      f("category", "Grade category", "text", { required: true }),
      f("status", "Grade status", "select", {
        options: ["graded", "ungraded", "missing"],
        default: "ungraded",
      }),
      f("earned", "Points earned", "number"),
      f("possible", "Points possible", "number"),
      f("weight", "Category weight (%)", "number", {
        hint: "Use the actual syllabus weight. Leave unknown weights blank.",
      }),
      notes,
    ],
    empty: "No grades entered. Unknown is a useful, honest starting point.",
  },
  event: {
    singular: "event",
    plural: "Events",
    fields: [
      f("start", "Starts", "datetime", { required: true }),
      f("end", "Ends", "datetime", { required: true }),
      f("timezone", "Event timezone", "text", { required: true }),
      f("busy", "Blocks time", "checkbox", { default: true }),
      f("buffer", "Buffer before and after (min)", "number", { default: 0 }),
      f("recurrence", "Repeats", "select", {
        options: ["none", "daily", "weekdays", "weekly"],
        default: "none",
      }),
      f("source", "Source", "select", {
        options: ["manual", "ics", "google", "planner"],
        default: "manual",
      }),
      notes,
    ],
    empty: "Your real commitments go here. Open space can stay open.",
  },
  note: {
    singular: "note",
    plural: "Notes",
    fields: [
      f("notebook", "Notebook", "select", {
        options: [
          "Math",
          "English",
          "Science",
          "Aviation",
          "Coding",
          "Projects",
          "Business",
          "Life",
          "Other",
        ],
        default: "Life",
      }),
      f("body", "Markdown", "textarea"),
      f("tags", "Tags"),
      f("relatedIds", "Related records", "multi"),
      f("private", "Exclude from shared snapshots by default", "checkbox", {
        default: true,
      }),
      f("pinned", "Pin note", "checkbox"),
    ],
    empty: "An idea, a question, a little clarity. Give it a home.",
  },
  project: {
    singular: "project",
    plural: "Projects",
    fields: [
      f("purpose", "Why this matters", "textarea"),
      f("status", "Status", "select", {
        options: [
          "active",
          "queued",
          "exploring",
          "on-hold",
          "completed",
          "archived",
        ],
        default: "queued",
      }),
      f("nextAction", "Next concrete action"),
      f("milestones", "Milestones", "textarea"),
      f("budget", "Optional budget", "number"),
      f("blockers", "Blockers", "textarea"),
      f("evidence", "Result / evidence", "textarea"),
      notes,
    ],
    empty: "Choose one meaningful build. Park the other good ideas for later.",
  },
  study: {
    singular: "study session",
    plural: "Study sessions",
    fields: [
      f("courseId", "Course", "select", { ref: "course" }),
      f("date", "Date", "date", { required: true }),
      f("practiceType", "Practice type"),
      f("minutes", "Actual minutes (optional)", "number"),
      f("plannedMinutes", "Planned minutes (optional)", "number"),
      f("confidence", "Confidence", "select", {
        options: ["unknown", "needs-help", "developing", "comfortable"],
        default: "unknown",
      }),
      f("errors", "What was difficult?", "textarea"),
      f("nextReview", "Review date", "date"),
      notes,
    ],
    empty: "Log what you tried, not a score for who you are.",
  },
  mistake: {
    singular: "mistake",
    plural: "Mistake log",
    fields: [
      f("topic", "Topic"),
      f("error", "What went wrong?", "textarea"),
      f("correction", "Corrected approach", "textarea"),
      f("nextReview", "Next practice", "date"),
      notes,
    ],
    empty: "An error is something specific you can learn from.",
  },
  reading: {
    singular: "reading entry",
    plural: "Reading",
    fields: [
      f("author", "Author"),
      f("status", "Status", "select", {
        options: ["to-read", "reading", "finished"],
        default: "to-read",
      }),
      notes,
    ],
    empty: "Make room for something worth reading.",
  },
  writing: {
    singular: "writing sample",
    plural: "Writing",
    fields: [
      f("body", "Original", "textarea"),
      f("feedback", "Feedback", "textarea"),
      f("revision", "Revision", "textarea"),
      notes,
    ],
    empty: "Keep the draft and the revision. That is evidence of progress.",
  },
  focus: {
    singular: "focus area",
    plural: "Focus areas",
    fields: [
      f("role", "Role", "select", {
        options: ["primary", "exploration"],
        default: "exploration",
      }),
      f("why", "Why it matters", "textarea"),
      f("baseline", "Baseline evidence / artifact link", "textarea"),
      f("feedback", "Teacher, coach or test feedback", "textarea"),
      f("milestone", "Next measurable milestone"),
      f("prerequisites", "Prerequisites", "textarea"),
      f("resources", "Resources", "textarea"),
      f("weeklyMinutes", "Weekly budget (optional minutes)", "number"),
      f("startDate", "Start date", "date", { required: true }),
      f("reviewDate", "Review date", "date"),
      notes,
    ],
    empty: "One primary skill. A bounded challenge. Evidence you can revisit.",
  },
  practice: {
    singular: "practice attempt",
    plural: "Practice log",
    fields: [
      f("focusId", "Focus area", "select", { ref: "focus", required: true }),
      f("date", "Date", "date", { required: true }),
      f("minutes", "Minutes (optional)", "number"),
      f("attempt", "Actual challenge attempted", "textarea"),
      f("result", "What happened?", "textarea"),
      f("mistakes", "Mistakes", "textarea"),
      f("feedback", "Feedback", "textarea"),
      f("correction", "What changed?", "textarea"),
      f("artifact", "Link to work"),
      notes,
    ],
    empty: "Attempt, get feedback, correct, rest, retest.",
  },
  evidence: {
    singular: "skill evidence",
    plural: "Evidence",
    fields: [
      f("focusId", "Focus area", "select", { ref: "focus", required: true }),
      f("date", "Date", "date", { required: true }),
      f("before", "Before", "textarea"),
      f("after", "After / result", "textarea"),
      f("artifact", "Artifact link"),
      notes,
    ],
    empty: "Save the work that shows what changed. Private by default.",
  },
  routine: {
    singular: "routine",
    plural: "Routines",
    fields: [
      f("day", "Day of week", "select", { options: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] }),
      f("frequency", "When / how often"),
      f("plan", "A realistic plan", "textarea"),
      notes,
    ],
    empty: "Supportive routines should give you more energy than they take.",
  },
  checkin: {
    singular: "check-in",
    plural: "Check-ins",
    fields: [
      f("date", "Date", "date", { required: true }),
      f("energy", "Energy", "select", {
        options: ["unknown", "low", "steady", "high"],
        default: "unknown",
      }),
      f("sleepHours", "Sleep opportunity (hours, optional)", "number"),
      f("movement", "Movement"),
      f("recovery", "Recovery"),
      f("freeTime", "Did you have room for fun?", "textarea"),
      notes,
    ],
    empty: "A quick reflection, whenever it is useful. No streak to maintain.",
  },
  transaction: {
    singular: "ledger entry",
    plural: "Ledger",
    fields: [
      f("date", "Date", "date", { required: true }),
      f("amount", "Amount", "number", { required: true }),
      f("direction", "Direction", "select", {
        options: ["expense", "income"],
        default: "expense",
      }),
      f("category", "Category", "text", { required: true }),
      notes,
    ],
    empty: "A simple, manual record of money in and money out.",
  },
  goal: {
    singular: "saving goal",
    plural: "Saving goals",
    fields: [
      f("target", "Target amount", "number", { required: true }),
      f("saved", "Amount set aside (if known)", "number"),
      f("date", "Target date (optional)", "date"),
      notes,
    ],
    empty: "Name something worth saving for. Unknown amounts can stay blank.",
  },
  career: {
    singular: "career pathway",
    plural: "Pathways",
    fields: [
      f("why", "Why I am curious", "textarea"),
      f("requirements", "Requirements to verify", "textarea"),
      f("source", "Source URL"),
      f("reviewDate", "Source review date", "date"),
      f("location", "Relevant region (optional)"),
      f("nextAction", "Next safe exploration step"),
      notes,
    ],
    empty:
      "Explore aviation, engineering, software, business—or something new. Keep the evidence.",
  },
  opportunity: {
    singular: "opportunity",
    plural: "Opportunities",
    fields: [
      f("category", "Category"),
      f("eligibility", "Eligibility", "select", {
        options: ["unknown", "verified", "not-eligible"],
        default: "unknown",
      }),
      f("source", "Actual source URL"),
      f("opens", "Opens", "date"),
      f("closes", "Closes", "date"),
      f("cost", "Known cost", "number"),
      f("ageLimits", "Age requirements to verify"),
      f("transportation", "Transportation needs"),
      f("status", "Application status", "select", {
        options: ["saved", "researching", "applying", "submitted", "closed"],
        default: "saved",
      }),
      notes,
    ],
    empty: "Save a real source. Check eligibility before making a plan.",
  },
  review: {
    singular: "weekly review",
    plural: "Weekly reviews",
    fields: [
      f("date", "Week of", "date", { required: true }),
      f("wins", "Wins", "textarea"),
      f("unmet", "Unmet obligations", "textarea"),
      f("freeTime", "Free-time satisfaction", "textarea"),
      f("changes", "What can be simplified or removed?", "textarea"),
      f("priorities", "Next-week priorities", "textarea"),
      f("blockers", "Current blockers", "textarea"),
      f(
        "explain",
        "What can I explain that I could not last week?",
        "textarea",
      ),
      f("tested", "What did I test?", "textarea"),
      f("feedback", "What feedback changed my approach?", "textarea"),
      f("budget", "Did the time budget remain realistic?", "textarea"),
    ],
    empty: "Take 15–20 minutes to notice, adjust and make room.",
  },
  challenge: {
    singular: "optional challenge",
    plural: "Personal development",
    fields: [
      f("area", "Communication, confidence, leadership, or other"),
      f("date", "Date (optional)", "date"),
      f("status", "Status", "select", {
        options: ["optional", "trying", "completed", "parked"],
        default: "optional",
      }),
      f("reflection", "Reflection", "textarea"),
      notes,
    ],
    empty: "A small, voluntary experiment. Skipping it is always okay.",
  },
  checkpoint: {
    singular: "checkpoint",
    plural: "Long-term checkpoints",
    fields: [
      f("period", "Month (YYYY-MM)", "text", { required: true }),
      f("domain", "Area", "select", {
        options: ["school", "learning", "project", "career", "life"],
        default: "school",
      }),
      f("status", "Status", "select", {
        options: ["proposed", "planned", "completed", "deferred"],
        default: "proposed",
      }),
      f("main", "Main focus", "textarea"),
      f("extra", "Only if time permits", "textarea"),
      f("source", "Source"),
      f("verified", "Dates and requirements verified", "checkbox"),
      notes,
    ],
    empty: "Add a monthly direction. Keep actual assignments in Tasks.",
  },
  daylog: {
    singular: "daily log",
    plural: "Daily logs",
    fields: [
      f("date", "Date", "date", { required: true }),
      f("dueToday", "What is genuinely due?", "textarea"),
      f("academicAction", "Top academic action", "textarea"),
      f("fixedActivities", "Actual fixed activities", "textarea"),
      f(
        "result",
        "Result: completed, partial, adjusted, or rested",
        "textarea",
      ),
      f("nextAction", "Next action", "textarea"),
      notes,
    ],
    empty: "A short, useful record of the day.",
  },
  aiSession: {
    singular: "AI session",
    plural: "AI activity",
    fields: [],
    empty: "AI conversation contents are not stored by default.",
  },
  exportLog: {
    singular: "export log",
    plural: "Export history",
    fields: [],
    empty: "No exports recorded yet.",
  },
};
export const routeKinds: Record<string, Kind[]> = {
  tasks: ["task"],
  school: ["course", "assignment", "assessment"],
  notes: ["note"],
  projects: ["project"],
  learning: [
    "flashcard",
    "focus",
    "practice",
    "evidence",
    "study",
    "mistake",
    "reading",
    "writing",
  ],
  life: ["event", "routine", "checkin", "challenge"],
  money: ["transaction", "goal"],
  explore: ["career", "opportunity"],
  review: ["review"],
};
