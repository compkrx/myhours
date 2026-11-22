import { useMemo, useState } from "react";
import { useApp } from "./context";
import { Empty } from "./components";
import { titleOf, str, type Kind } from "../domain/model";
export default function KnowledgeMap() {
  const { records, edit } = useApp();
  const [filter, setFilter] = useState("all");
  const { nodes, links } = useMemo(() => {
    const allowed: Kind[] = [
      "note",
      "course",
      "project",
      "focus",
      "task",
      "assignment",
      "practice",
      "evidence",
    ];
    const subset = records
      .filter(
        (r) =>
          allowed.includes(r.kind) && (filter === "all" || r.kind === filter),
      )
      .slice(0, 120);
    const nodes = subset.map((record, i) => {
      const group = [
        "note",
        "course",
        "project",
        "focus",
        "task",
        "assignment",
        "practice",
        "evidence",
      ].indexOf(record.kind);
      const angle = i * 2.399963 + group * 0.4;
      const radius = 70 + Math.sqrt(i + 1) * 20;
      return {
        record,
        x: 400 + Math.cos(angle) * radius,
        y: 260 + Math.sin(angle) * Math.min(radius, 190),
      };
    });
    const byId = new Map(nodes.map((n) => [n.record.id, n]));
    const links = nodes.flatMap((node) => {
      const r = node.record;
      const ids = [
        ...["courseId", "projectId", "focusId"].map((k) => str(r, k)),
        ...(Array.isArray(r.data.relatedIds) ? r.data.relatedIds : []),
        ...(Array.isArray(r.data.dependencies) ? r.data.dependencies : []),
      ];
      return ids.flatMap((id) => {
        const target = byId.get(id);
        return target ? [{ from: node, to: target }] : [];
      });
    });
    return { nodes, links };
  }, [records, filter]);
  return (
    <section className="knowledge-map-panel">
      <div className="list-toolbar">
        <span className="eyebrow">
          KNOWLEDGE MAP / {nodes.length} RECORDS / {links.length} LINKS
        </span>
        <select
          aria-label="Map record type"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All connected areas</option>
          {[
            "note",
            "course",
            "project",
            "focus",
            "task",
            "assignment",
            "practice",
            "evidence",
          ].map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      </div>
      <div className="knowledge-map">
        {nodes.length ? (
          <>
            <svg
              viewBox="0 0 800 520"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {links.map((link, i) => (
                <line
                  key={i}
                  x1={link.from.x}
                  y1={link.from.y}
                  x2={link.to.x}
                  y2={link.to.y}
                />
              ))}
            </svg>
            {nodes.map(({ record, x, y }) => (
              <button
                key={record.id}
                className={`map-node map-${record.kind}`}
                title={`${record.kind}: ${titleOf(record)}`}
                style={{ left: `${x / 8}%`, top: `${y / 5.2}%` }}
                onClick={() => edit(record.kind, record)}
              >
                <span className="map-node-dot" />
                <strong>{titleOf(record)}</strong>
                <small>{record.kind}</small>
              </button>
            ))}
          </>
        ) : (
          <Empty
            title="No records to map"
            description="Create notes, courses or projects, then link them in Note settings. Only actual links appear here."
          />
        )}
      </div>
      <p className="hint">
        Lines represent explicit relationships, not inferred similarities. Use
        Note settings to link records. Showing up to 120 records; every node can
        be opened with the keyboard.
      </p>
    </section>
  );
}
