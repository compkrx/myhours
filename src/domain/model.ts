import { z } from "zod";

export const kinds = [
  "task",
  "course",
  "assignment",
  "assessment",
  "event",
  "note",
  "project",
  "study",
  "mistake",
  "reading",
  "writing",
  "focus",
  "practice",
  "evidence",
  "routine",
  "routineCheck",
  "checkin",
  "transaction",
  "goal",
  "career",
  "opportunity",
  "review",
  "challenge",
  "checkpoint",
  "daylog",
  "aiSession",
  "exportLog",
  "schoolSource",
  "importLog",
  "flashcard",
  "lessonProgress",
  "lessonAttempt",
  "musicSource",
] as const;
export type Kind = (typeof kinds)[number];
export type Value = string | number | boolean | string[];
export type Fields = Record<string, Value>;
export const provenance = [
  "manual",
  "imported",
  "verified",
  "inferred",
  "AI-suggested",
] as const;
const optionalText = z.string().max(30000).optional();
const text = z.string().trim().min(1, "A title is required.").max(240);
const optionalNumber = z.number().finite().nonnegative().optional();
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Invalid date",
  );
const instant = z.iso.datetime({ offset: true });
const due = z.union([date, instant]).optional();
const status = z.enum(["open", "in-progress", "submitted", "done", "excused"]);
const sharedTask = {
  title: text,
  status: status.default("open"),
  due,
  hard: z.boolean().default(false),
  importance: z.number().int().min(1).max(3).default(2),
  minutes: z.number().int().min(5).max(1440).default(30),
  dependencies: z.array(z.uuid()).default([]),
  notes: optionalText,
  priorityOrder: z.number().int().min(0).max(3).default(0),
  recurrence: z.enum(["none", "daily", "weekly"]).default("none"),
  repeatOf: z.uuid().optional(),
  externalId: optionalText,
};
export const dataSchemas = {
  task: z.object({
    ...sharedTask,
    area: optionalText,
    projectId: optionalText,
    labels: optionalText,
  }),
  course: z.object({
    externalId: optionalText,
    title: text,
    teacher: optionalText,
    period: optionalText,
    notes: optionalText,
    policy: optionalText,
    weaknesses: optionalText,
    reportedGrade: z.number().min(0).max(100).optional(),
    gradeAsOf: date.optional(),
    gradeSource: optionalText,
    gradeVerified: z.boolean().default(false),
  }),
  assignment: z.object({
    ...sharedTask,
    courseId: z.uuid(),
    verifiedAt: due,
    impact: optionalNumber,
    links: optionalText,
  }),
  assessment: z
    .object({
      externalId: optionalText,
      title: text,
      courseId: z.uuid(),
      category: text,
      status: z.enum(["graded", "ungraded", "missing"]),
      earned: optionalNumber,
      possible: z.number().positive().optional(),
      weight: z.number().min(0).max(100).optional(),
      notes: optionalText,
    })
    .refine(
      (d) =>
        d.status !== "graded" ||
        (d.earned !== undefined && d.possible !== undefined),
      "Graded items need earned and possible points.",
    ),
  event: z
    .object({
      title: text,
      start: instant,
      end: instant,
      timezone: text,
      busy: z.boolean().default(true),
      buffer: z.number().int().min(0).max(180).default(0),
      recurrence: z
        .enum(["none", "daily", "weekdays", "weekly"])
        .default("none"),
      source: z.enum(["manual", "ics", "google", "planner"]).default("manual"),
      externalId: optionalText,
      taskId: optionalText,
      notes: optionalText,
    })
    .refine(
      (d) => new Date(d.end) > new Date(d.start),
      "End must be after start.",
    ),
  note: z.object({
    title: text,
    body: z.string().max(100000).default(""),
    notebook: z.string().default("Life"),
    tags: optionalText,
    relatedIds: z.array(z.uuid()).default([]),
    private: z.boolean().default(true),
    pinned: z.boolean().default(false),
  }),
  project: z.object({
    title: text,
    purpose: optionalText,
    status: z
      .enum([
        "active",
        "queued",
        "exploring",
        "on-hold",
        "completed",
        "archived",
      ])
      .default("queued"),
    nextAction: optionalText,
    milestones: optionalText,
    budget: optionalNumber,
    blockers: optionalText,
    evidence: optionalText,
    notes: optionalText,
  }),
  study: z.object({
    title: text,
    courseId: optionalText,
    date,
    minutes: optionalNumber,
    plannedMinutes: optionalNumber,
    practiceType: optionalText,
    confidence: z
      .enum(["unknown", "needs-help", "developing", "comfortable"])
      .default("unknown"),
    errors: optionalText,
    nextReview: date.optional(),
    notes: optionalText,
  }),
  mistake: z.object({
    title: text,
    topic: optionalText,
    error: optionalText,
    correction: optionalText,
    nextReview: date.optional(),
    notes: optionalText,
  }),
  reading: z.object({
    title: text,
    author: optionalText,
    status: z.enum(["to-read", "reading", "finished"]).default("to-read"),
    notes: optionalText,
  }),
  writing: z.object({
    title: text,
    body: optionalText,
    feedback: optionalText,
    revision: optionalText,
    notes: optionalText,
  }),
  focus: z.object({
    title: text,
    role: z.enum(["primary", "exploration"]).default("exploration"),
    why: optionalText,
    baseline: optionalText,
    feedback: optionalText,
    milestone: optionalText,
    prerequisites: optionalText,
    resources: optionalText,
    weeklyMinutes: optionalNumber,
    startDate: date,
    reviewDate: date.optional(),
    notes: optionalText,
  }),
  practice: z.object({
    title: text,
    focusId: z.uuid(),
    date,
    minutes: optionalNumber,
    attempt: optionalText,
    result: optionalText,
    mistakes: optionalText,
    feedback: optionalText,
    correction: optionalText,
    artifact: optionalText,
    notes: optionalText,
  }),
  evidence: z.object({
    title: text,
    focusId: z.uuid(),
    date,
    before: optionalText,
    after: optionalText,
    artifact: optionalText,
    notes: optionalText,
  }),
  routine: z.object({
    title: text,
    day: z
      .enum([
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ])
      .optional(),
    frequency: optionalText,
    plan: optionalText,
    notes: optionalText,
  }),
  routineCheck: z.object({
    title: text,
    date,
    day: z.enum([
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ]),
    stepId: text,
    step: text,
    completed: z.literal(true),
  }),
  checkin: z.object({
    title: text,
    date,
    energy: z.enum(["low", "steady", "high", "unknown"]).default("unknown"),
    sleepHours: z.number().min(0).max(24).optional(),
    movement: optionalText,
    recovery: optionalText,
    freeTime: optionalText,
    notes: optionalText,
  }),
  transaction: z.object({
    title: text,
    date,
    amount: z.number().positive(),
    direction: z.enum(["income", "expense"]),
    category: text,
    notes: optionalText,
  }),
  goal: z.object({
    title: text,
    target: z.number().positive(),
    saved: optionalNumber,
    date: date.optional(),
    notes: optionalText,
  }),
  career: z.object({
    title: text,
    why: optionalText,
    requirements: optionalText,
    source: optionalText,
    reviewDate: date.optional(),
    location: optionalText,
    nextAction: optionalText,
    notes: optionalText,
  }),
  opportunity: z
    .object({
      title: text,
      category: optionalText,
      eligibility: z
        .enum(["unknown", "verified", "not-eligible"])
        .default("unknown"),
      source: optionalText,
      opens: date.optional(),
      closes: date.optional(),
      cost: optionalNumber,
      ageLimits: optionalText,
      transportation: optionalText,
      status: z
        .enum(["saved", "researching", "applying", "submitted", "closed"])
        .default("saved"),
      notes: optionalText,
    })
    .refine(
      (d) => d.eligibility !== "verified" || Boolean(d.source),
      "Verified eligibility needs a source.",
    ),
  review: z.object({
    title: text,
    date,
    wins: optionalText,
    unmet: optionalText,
    freeTime: optionalText,
    changes: optionalText,
    priorities: optionalText,
    blockers: optionalText,
    explain: optionalText,
    tested: optionalText,
    feedback: optionalText,
    budget: optionalText,
  }),
  challenge: z.object({
    title: text,
    area: optionalText,
    date: date.optional(),
    reflection: optionalText,
    status: z
      .enum(["optional", "trying", "completed", "parked"])
      .default("optional"),
    notes: optionalText,
  }),
  checkpoint: z.object({
    title: text,
    period: z.string().regex(/^\d{4}-\d{2}$/),
    domain: z
      .enum(["school", "learning", "project", "career", "life"])
      .default("school"),
    status: z
      .enum(["proposed", "planned", "completed", "deferred"])
      .default("proposed"),
    main: optionalText,
    extra: optionalText,
    source: optionalText,
    verified: z.boolean().default(false),
    notes: optionalText,
  }),
  daylog: z.object({
    title: text,
    date,
    dueToday: optionalText,
    academicAction: optionalText,
    fixedActivities: optionalText,
    result: optionalText,
    nextAction: optionalText,
    notes: optionalText,
  }),
  musicSource: z.object({
    title: text,
    url: z
      .url()
      .refine((v) => v.startsWith("https://"), "Use an HTTPS music URL."),
    notes: optionalText,
  }),
  flashcard: z.object({
    title: text,
    front: z.string().min(1).max(10000),
    back: z.string().min(1).max(20000),
    deck: z.string().default("General"),
    courseId: optionalText,
    nextReview: date.optional(),
    notes: optionalText,
  }),
  lessonProgress: z.object({
    title: text,
    lessonId: text,
    status: z.enum(["in-progress", "reviewed"]),
    reflection: optionalText,
    nextReview: date.optional(),
  }),
  lessonAttempt: z.object({
    title: text,
    lessonId: text,
    questionId: text,
    answer: z.number().int().nonnegative(),
    correct: z.boolean(),
    checkedAt: instant,
    notes: optionalText,
  }),
  schoolSource: z.object({
    title: text,
    url: z
      .url()
      .refine((v) => v.startsWith("https://"), "Use an HTTPS portal URL."),
    method: z.literal("manual-files").default("manual-files"),
    notes: optionalText,
  }),
  importLog: z.object({
    title: text,
    date: instant,
    count: z.number().int().nonnegative(),
    source: text,
    notes: optionalText,
  }),
  aiSession: z.object({
    title: text,
    scope: z.array(z.string()),
    references: z.array(z.uuid()),
    state: z.enum(["draft", "approved", "dismissed"]),
    notes: optionalText,
  }),
  exportLog: z.object({
    title: text,
    date: instant,
    count: z.number().int().nonnegative(),
    destination: text,
    notes: optionalText,
  }),
} satisfies Record<Kind, z.ZodType>;

export const recordSchema = z
  .object({
    id: z.uuid(),
    kind: z.enum(kinds),
    data: z.record(
      z.string(),
      z.union([
        z.string(),
        z.number().finite(),
        z.boolean(),
        z.array(z.string()),
      ]),
    ),
    createdAt: instant,
    updatedAt: instant,
    revision: z.number().int().positive(),
    sortOrder: z.number().finite(),
    provenance: z.enum(provenance),
    deletedAt: instant.optional(),
  })
  .superRefine((r, ctx) => {
    const result = dataSchemas[r.kind].safeParse(r.data);
    if (!result.success)
      result.error.issues.forEach((i) =>
        ctx.addIssue({
          code: "custom",
          path: ["data", ...i.path],
          message: i.message,
        }),
      );
  });
export type LifeRecord = z.infer<typeof recordSchema>;
export type TypedRecord<K extends Kind> = Omit<LifeRecord, "kind" | "data"> & {
  kind: K;
  data: z.infer<(typeof dataSchemas)[K]>;
};
export const settingsSchema = z.object({
  id: z.literal("preferences").default("preferences"),
  timezone: z.string().refine((v) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }, "Use an IANA timezone such as America/Denver."),
  theme: z.enum(["dark", "light", "system"]).default("light"),
  wake: z
    .string()
    .regex(/^\d\d:\d\d$/)
    .default("07:00"),
  bed: z
    .string()
    .regex(/^\d\d:\d\d$/)
    .default("22:00"),
  reservedMinutes: z.number().int().min(0).max(600).default(150),
  onboarded: z.boolean().default(false),
  currency: z.string().length(3).default("USD"),
  retainAi: z.boolean().default(false),
  aiModel: z
    .enum([
      "gemma3-1b-it-q4f16_1-MLC",
      "gemma-2-2b-it-q4f16_1-MLC",
      "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    ])
    .default("gemma3-1b-it-q4f16_1-MLC"),
  saveAiChats: z.boolean().default(true),
  aiConsent: z.boolean().default(false),
  driveFolder: z.string().default(""),
  lastDriveSync: z.string().default(""),
  lastExport: z.string().default(""),
  petEnabled: z.boolean().default(false),
  petName: z.string().trim().min(1).max(30).default("Pip"),
  petWalking: z.boolean().default(true),
  uiStyle: z.enum(["studio", "terminal", "glass", "soft"]).default("studio"),
  density: z.enum(["comfortable", "compact"]).default("comfortable"),
  accent: z
    .union([z.literal(""), z.string().regex(/^#[0-9a-fA-F]{6}$/)])
    .default(""),
  backgroundImage: z
    .string()
    .max(4_200_000)
    .refine(
      (v) =>
        !v || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v),
      "Use a supported local image.",
    )
    .default(""),
  backgroundOpacity: z.number().min(0).max(1).default(0.3),
  backgroundBlur: z.number().min(0).max(24).default(6),
  effectsEnabled: z.boolean().default(false),
  weatherEffect: z.enum(["none", "rain", "snow"]).default("none"),
  effectIntensity: z.number().min(0.1).max(1).default(0.35),
  cursorTrail: z.enum(["off", "afterimage", "dots", "custom"]).default("off"),
  cursorImage: z
    .string()
    .max(4_200_000)
    .refine(
      (v) =>
        !v || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v),
    )
    .default(""),
  cursorSize: z.number().min(8).max(64).default(24),
  musicEnabled: z.boolean().default(true),
  hiddenRoutes: z.array(z.string().max(40)).max(30).default([]),
  pinnedRoutes: z
    .array(z.string().max(40))
    .max(8)
    .default(["today", "tasks", "calendar", "learn"]),
});
export type Preferences = z.infer<typeof settingsSchema>;
export const defaultPreferences = (): Preferences =>
  settingsSchema.parse({
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  });
export const titleOf = (r: LifeRecord) => String(r.data.title || "Untitled");
export const isOpen = (r: LifeRecord) =>
  ["task", "assignment"].includes(r.kind) &&
  !["done", "submitted", "excused"].includes(String(r.data.status));
export const str = (r: LifeRecord, key: string) => String(r.data[key] ?? "");
export const num = (r: LifeRecord, key: string, fallback = 0) =>
  typeof r.data[key] === "number" ? (r.data[key] as number) : fallback;
