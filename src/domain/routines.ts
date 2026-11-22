export const week = [
  { id: "monday", label: "Monday", short: "Mon" },
  { id: "tuesday", label: "Tuesday", short: "Tue" },
  { id: "wednesday", label: "Wednesday", short: "Wed" },
  { id: "thursday", label: "Thursday", short: "Thu" },
  { id: "friday", label: "Friday", short: "Fri" },
  { id: "saturday", label: "Saturday", short: "Sat" },
  { id: "sunday", label: "Sunday", short: "Sun" },
] as const;

export type Weekday = (typeof week)[number]["id"];

export const starterRoutines: Record<Weekday, string> = {
  monday: `Before school: wash up, get dressed, eat, check the actual schedule, and pack what you need.\nAfter school: have a snack and decompress before choosing one real assignment.\nIf math is due: work a few problems and write down the first question you cannot answer.\nEvening: check what is finished, set out tomorrow's materials, brush teeth, and wind down.`,
  tuesday: `Before school: finish getting ready, eat, and check for changes to today's classes or travel.\nAfter school: rest first. Open the school portal and verify one deadline before planning work.\nIf training or a club is actually on the calendar: leave time for travel, food, and recovery.\nEvening: finish a manageable school task, prepare tomorrow's things, and keep some free time.`,
  wednesday: `Before school: get ready, eat, and bring the books or materials listed for today.\nMidweek check: note anything confusing in class while the details are fresh.\nAfter school: take a real break, then ask for help or review one difficult concept.\nEvening: check tomorrow's schedule, tidy your work area, and start winding down on time.`,
  thursday: `Before school: wash up, get dressed, eat, and confirm the day's real commitments.\nAfter school: check upcoming work and choose what can reasonably be finished today.\nIf writing is due: revise one paragraph against the prompt and the feedback you actually received.\nEvening: save your work, pack what you need, and leave room for rest and something enjoyable.`,
  friday: `Before school: get ready, eat, and check whether anything is due before the weekend.\nAfter school: close the loop on submitted work and write down any next step that remains.\nChoose one small reset for Monday; do not turn the weekend into a catch-up penalty.\nMake space for friends, family, hobbies, and unplanned time.`,
  saturday: `Start at a comfortable time; there is no assumed wake-up hour.\nEat, wash up, and choose one useful thing only if it fits the day you actually have.\nA short practice session or project step is optional; stop when the agreed time is up.\nLeave open space for movement, people you care about, hobbies, and rest.`,
  sunday: `Keep the morning flexible and take care of food, hygiene, and any real family plans.\nCheck the school portal for actual deadlines, missing work, and schedule changes.\nPick up to three outcomes for the week and enter only confirmed commitments on the calendar.\nPrepare Monday's materials, then leave time for dinner, downtime, and sleep.`,
};

export function stepsFromPlan(plan: string) {
  return plan
    .split(/\r?\n/)
    .map((step) => step.trim())
    .filter(Boolean);
}

export function routineStepId(index: number, step: string) {
  return `${index}:${step}`;
}

export function weekdayForDate(date: string): Weekday {
  const day = new Date(`${date}T12:00:00.000Z`).getUTCDay();
  return week[(day + 6) % 7].id;
}
