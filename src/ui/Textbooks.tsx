import { useMemo, useState } from "react";
import { ArrowUpRight, BookOpen, Plus, Search } from "lucide-react";
import { resources } from "../../supabase/functions/_shared/curriculum";
import { Button, SourceLink } from "./components";
import { useApp } from "./context";

const shelfIds = new Set([
  "khan",
  "openlearn",
  "geogebra",
  "desmos",
  "phet",
  "ck12",
  "openstax",
  "bbc",
  "fcc",
  "cs50",
  "arts",
  "wikipedia",
  "earth",
  "history",
  "saylor",
  "mit",
  "stanford",
  "harvard",
  "coursera",
  "edx",
]);

const topics = ["All topics", "All subjects", "Math", "Science", "Languages", "Coding", "Humanities", "Business", "University"];

export default function Textbooks() {
  const { edit } = useApp();
  const [topic, setTopic] = useState("All topics");
  const [search, setSearch] = useState("");
  const items = useMemo(
    () =>
      resources
        .filter((item) => shelfIds.has(item.id))
        .filter((item) => topic === "All topics" || item.category === topic)
        .filter((item) =>
          `${item.name} ${item.category} ${item.description}`
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
        ),
    [topic, search],
  );

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">LIBRARY / OUTSIDE SOURCES</div>
          <h1>Books, courses, and tools.</h1>
          <p>
            Find a useful source, then bring your own notes and practice back
            into MyHours. Links open the provider&apos;s site.
          </p>
        </div>
        <BookOpen size={28} aria-hidden="true" />
      </div>

      <div className="textbook-toolbar">
        <label className="search-input">
          <Search size={17} aria-hidden="true" />
          <input
            aria-label="Search books and courses"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by subject or provider…"
          />
        </label>
        <label>
          <span className="sr-only">Filter by subject</span>
          <select
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
          >
            {topics.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>

      <p className="hint textbook-note">
        These are linked study services, not copied chapters. A provider may
        require its own account, charge for some features, or set age
        requirements. Check the source and the terms for the specific material.
      </p>

      <div className="textbook-grid">
        {items.map((item) => (
          <article className="textbook-entry" key={item.id}>
            <span className="eyebrow">{item.category}</span>
            <h2>{item.name}</h2>
            <p>{item.description}</p>
            <p className="hint">{item.access}</p>
            <div className="textbook-actions">
              <SourceLink href={item.url}>
                Open source <ArrowUpRight size={14} />
              </SourceLink>
              <Button
                variant="ghost"
                onClick={() =>
                  edit("note", undefined, {
                    title: `Reading notes · ${item.name}`,
                    notebook: "Learning",
                    private: true,
                    tags: "learning,source-notes",
                    body: `Source: ${item.url}\n\n## Chapter or topic\n\n## My explanation\n\n## Example or evidence\n\n## Question to bring to the AI tutor\n\n## Next practice step\n`,
                  })
                }
              >
                <Plus size={14} /> Add notes
              </Button>
            </div>
          </article>
        ))}
        {!items.length ? (
          <p className="muted">No sources match that search.</p>
        ) : null}
      </div>
    </>
  );
}
