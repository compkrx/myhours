import { useState } from "react";
import Markdown from "react-markdown";
import {
  BookOpen,
  Bookmark,
  Check,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import {
  lessons,
  resources,
  type Lesson,
} from "../../supabase/functions/_shared/curriculum";
import { todayKey, addDay } from "../domain/time";
import type { ChatCompletionMessageParam } from "@mlc-ai/web-llm";
import {
  localAI,
  localModels,
  type LocalModelId,
} from "../integrations/local-ai";
import { useApp } from "./context";
import { Button, Section, SourceLink } from "./components";

export default function Lessons() {
  const { records, p, edit, repo, notify } = useApp();
  const [view, setView] = useState<"lessons" | "resources">("lessons");
  const [subject, setSubject] = useState("all");
  const [search, setSearch] = useState("");
  const [lessonId, setLessonId] = useState(lessons[0].id);
  const selected =
    lessons.find((lesson) => lesson.id === lessonId) ?? lessons[0];
  const filtered = lessons.filter(
    (lesson) =>
      (subject === "all" || lesson.subject === subject) &&
      `${lesson.title} ${lesson.objective}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const reviewed = records.filter(
    (record) =>
      record.kind === "lessonProgress" && record.data.status === "reviewed",
  );

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">LEARN / GUIDED PRACTICE</div>
          <h1>Understand it. Try it.</h1>
          <p>
            Original in-app lessons, worked examples, feedback and a source
            library.
          </p>
        </div>
        <span className="status-pill">
          {reviewed.length} lesson(s) reviewed · no mastery score
        </span>
      </div>
      <div className="tabs">
        <button
          className={view === "lessons" ? "active" : ""}
          onClick={() => setView("lessons")}
        >
          In-app lessons
        </button>
        <button
          className={view === "resources" ? "active" : ""}
          onClick={() => setView("resources")}
        >
          Learning services · {resources.length}
        </button>
      </div>
      <div className="list-toolbar">
        <label className="search-input">
          <Search size={17} />
          <input
            aria-label="Search learning library"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Find a topic or resource…"
          />
        </label>
        {view === "lessons" ? (
          <select
            aria-label="Lesson subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          >
            <option value="all">All subjects</option>
            {[...new Set(lessons.map((lesson) => lesson.subject))].map(
              (value) => (
                <option key={value}>{value}</option>
              ),
            )}
          </select>
        ) : null}
      </div>

      {view === "lessons" ? (
        <div className="lesson-layout">
          <nav className="lesson-index" aria-label="Lesson selection">
            {filtered.map((lesson) => (
              <button
                key={lesson.id}
                className={lesson.id === lessonId ? "active" : ""}
                onClick={() => setLessonId(lesson.id)}
              >
                <span>
                  {lesson.subject}{" "}
                  {reviewed.some(
                    (record) => record.data.lessonId === lesson.id,
                  ) ? (
                    <Check size={12} />
                  ) : null}
                </span>
                <strong>{lesson.title}</strong>
                <small>{lesson.minutes} min suggested · optional</small>
              </button>
            ))}
            {!filtered.length ? (
              <p className="muted">No matching lessons.</p>
            ) : null}
          </nav>
          <LessonReader key={selected.id} lesson={selected} />
        </div>
      ) : (
        <>
          <p className="hint">
            These links open official services. Their courses, sign-ins and
            progress do not automatically sync with MyHours. In-app lesson text
            is original; external courses are not copied or unlocked by this
            app.
          </p>
          <div className="resource-grid">
            {resources
              .filter((resource) =>
                `${resource.name} ${resource.description} ${resource.category}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((resource) => (
                <article className="resource-card" key={resource.id}>
                  <span className="eyebrow">{resource.category}</span>
                  <h2>{resource.name}</h2>
                  <p>{resource.description}</p>
                  <p className="hint">{resource.access}</p>
                  <div className="button-group">
                    <SourceLink href={resource.url}>
                      Open official resource
                    </SourceLink>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        edit("note", undefined, {
                          title: `Study notes · ${resource.name}`,
                          notebook: "Life",
                          body: `Source: ${resource.url}\n\n## What I am learning\n\n## My explanation\n\n## Questions\n`,
                          private: true,
                        })
                      }
                    >
                      <Plus size={13} /> Study notes
                    </Button>
                  </div>
                </article>
              ))}
          </div>
          <Section title="Use a resource in your plan">
            <p className="muted">
              Choose one bounded topic, take your own notes, make a flashcard or
              practice attempt, then check your understanding.
            </p>
            <Button
              variant="secondary"
              onClick={() =>
                edit("task", undefined, {
                  title: "Study one selected topic",
                  minutes: 20,
                  area: "Learning",
                })
              }
            >
              Draft a study task
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                try {
                  await repo.save("study", {
                    title: "Resource exploration",
                    date: todayKey(p.timezone),
                    notes:
                      "I explored a learning resource. Add actual results and feedback.",
                  });
                  notify(
                    "Study record saved. Add your observations in Learning.",
                  );
                } catch (error) {
                  notify(String(error));
                }
              }}
            >
              Log an exploration
            </Button>
          </Section>
        </>
      )}
      {!p.lastExport && records.length > 3 ? (
        <p className="hint">
          <Bookmark size={14} /> Your learning records are local. Export a
          backup from Settings when you want to keep a portable copy.
        </p>
      ) : null}
    </>
  );
}

function LessonReader({ lesson }: { lesson: Lesson }) {
  const { records, repo, p, edit, notify } = useApp();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState("");
  const [status, setStatus] = useState("");
  const [includeLessonContext, setIncludeLessonContext] = useState(true);
  const progress = records.find(
    (record) =>
      record.kind === "lessonProgress" && record.data.lessonId === lesson.id,
  );
  const attempts = records.filter(
    (record) =>
      record.kind === "lessonAttempt" && record.data.lessonId === lesson.id,
  );
  const model = p.aiModel as LocalModelId;
  const modelName =
    localModels.find((entry) => entry.id === model)?.name ?? "Gemma 3 · 1B";

  async function saveProgress() {
    setBusy(true);
    try {
      await repo.save(
        "lessonProgress",
        {
          title: lesson.title,
          lessonId: lesson.id,
          status: "reviewed",
          nextReview: addDay(todayKey(p.timezone), 3),
        },
        progress,
      );
      notify("Marked reviewed. This records your review, not a mastery claim.");
    } catch (error) {
      notify(String(error));
    } finally {
      setBusy(false);
    }
  }

  async function askTutor() {
    const prompt = question.trim();
    if (!prompt || busy) return;
    setBusy(true);
    setResponse("");
    setStatus("Starting the local model…");
    const lessonContext = includeLessonContext
      ? `\n\nLesson: ${lesson.title}\nObjective: ${lesson.objective}\nWorked example: ${lesson.worked}\nLesson text: ${lesson.body.slice(0, 4000)}`
      : "";
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          "You are a clear, patient tutor. Help the student understand the reasoning instead of only giving an answer. Give a worked next step when useful. Do not claim to change or save anything. Be direct and calm.",
      },
      { role: "user", content: `${prompt}${lessonContext}` },
    ];
    let answer = "";
    try {
      for await (const chunk of localAI.reply(model, messages, (report) =>
        setStatus(report.text || "Loading model…"),
      )) {
        answer += chunk;
        setResponse(answer);
        setStatus("Writing a reply…");
      }
      setStatus(
        answer
          ? ""
          : "The model returned an empty reply. Try a shorter question.",
      );
    } catch (error) {
      setResponse(
        `I couldn’t start the model. ${error instanceof Error ? error.message : String(error)}`,
      );
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="lesson-reader">
      <div className="eyebrow">
        <BookOpen size={14} /> {lesson.subject} / ORIGINAL MYHOURS LESSON
      </div>
      <h2>{lesson.title}</h2>
      <p className="lesson-objective">{lesson.objective}</p>
      {lesson.prerequisites.length ? (
        <p className="hint">
          Useful preparation:{" "}
          {lesson.prerequisites
            .map((id) => lessons.find((entry) => entry.id === id)?.title)
            .join(", ")}
          . This is a guide, not a placement decision.
        </p>
      ) : null}
      <div className="lesson-body">
        <Markdown>{lesson.body}</Markdown>
      </div>
      <section className="worked-example">
        <h3>Worked example</h3>
        <p>{lesson.worked}</p>
      </section>
      <section className="lesson-practice">
        <h3>Try it before checking</h3>
        {lesson.questions.map((item) => {
          const last = attempts
            .filter((record) => record.data.questionId === item.id)
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
          return (
            <fieldset key={item.id}>
              <legend>{item.prompt}</legend>
              {item.choices.map((choice, index) => (
                <label className="check-label" key={index}>
                  <input
                    type="radio"
                    name={`question-${item.id}`}
                    checked={answers[item.id] === index}
                    onChange={() =>
                      setAnswers((current) => ({
                        ...current,
                        [item.id]: index,
                      }))
                    }
                  />
                  {choice}
                </label>
              ))}
              <Button
                variant="secondary"
                disabled={answers[item.id] === undefined || busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await repo.save("lessonAttempt", {
                      title: `${lesson.title} · ${item.id}`,
                      lessonId: lesson.id,
                      questionId: item.id,
                      answer: answers[item.id],
                      correct: answers[item.id] === item.answer,
                      checkedAt: new Date().toISOString(),
                    });
                  } catch (error) {
                    notify(String(error));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Check answer
              </Button>
              {last ? (
                <div role="status" className="answer-feedback">
                  <strong>
                    {last.data.correct
                      ? "Matches the answer key."
                      : "Review the reasoning, then try again."}
                  </strong>
                  <p>{item.explanation}</p>
                </div>
              ) : null}
              <Button
                variant="ghost"
                onClick={() =>
                  edit("flashcard", undefined, {
                    title: item.prompt,
                    front: item.prompt,
                    back: `${item.choices[item.answer]}\n\n${item.explanation}`,
                    deck: lesson.subject,
                  })
                }
              >
                Draft a flashcard
              </Button>
            </fieldset>
          );
        })}
      </section>
      <div className="lesson-tools">
        <Button onClick={saveProgress} disabled={busy}>
          {progress?.data.status === "reviewed"
            ? "Review recorded"
            : "Mark lesson reviewed"}
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            edit("note", undefined, {
              title: `My explanation · ${lesson.title}`,
              body: `## What I can explain\n\n## What I tried\n\n## Questions\n\nLesson: ${lesson.id}`,
              private: true,
              notebook: lesson.subject === "Math" ? "Math" : "Life",
            })
          }
        >
          Write my explanation
        </Button>
        <Button
          variant="ghost"
          onClick={() =>
            edit("mistake", undefined, {
              title: `Correction · ${lesson.title}`,
              topic: lesson.title,
            })
          }
        >
          Record a mistake
        </Button>
      </div>
      <Section
        title="Ask about this lesson"
        subtitle={`${modelName} · free, on this device`}
      >
        <label className="settings-form">
          Your question
          <textarea
            aria-label="Lesson tutor question"
            rows={3}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={3000}
            placeholder="Which step is confusing? Show what you tried."
          />
        </label>
        <details className="lesson-ai-context">
          <summary>
            {includeLessonContext
              ? "Lesson context included"
              : "Add lesson context"}
          </summary>
          <label className="check-label">
            <input
              type="checkbox"
              checked={includeLessonContext}
              onChange={(event) =>
                setIncludeLessonContext(event.target.checked)
              }
            />
            Include this lesson and its worked example
          </label>
          <p className="hint">
            The tutor runs in your browser. No app records or prompts are sent
            to a server.
          </p>
        </details>
        <Button
          disabled={busy || !question.trim()}
          onClick={() => void askTutor()}
        >
          <Sparkles size={16} />
          {busy ? "Thinking…" : "Ask the tutor"}
        </Button>
        {status ? (
          <p role="status" className="hint">
            {status}
          </p>
        ) : null}
        {response ? (
          <div className="answer-feedback markdown-preview" role="status">
            <Markdown>{response}</Markdown>
          </div>
        ) : null}
      </Section>
      <div className="lesson-sources">
        <h3>Continue with official resources</h3>
        {lesson.resourceIds.map((id) => {
          const resource = resources.find((entry) => entry.id === id)!;
          return (
            <SourceLink key={id} href={resource.url}>
              {resource.name}
            </SourceLink>
          );
        })}
        <p className="hint">
          This lesson and its examples were written for MyHours. It is not an
          official lesson from the linked providers and does not imply their
          endorsement.
        </p>
      </div>
    </article>
  );
}
