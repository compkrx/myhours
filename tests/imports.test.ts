import { describe, it, expect } from "vitest";
import { parseCSV, previewCSV, suggestMapping } from "../src/domain/imports";
import { imageSignature, attachmentSchema } from "../src/domain/attachments";
import { LifeDB, Repository } from "../src/data/repository";
describe("school import boundary", () => {
  it("handles quoted and multiline CSV and rejects malformed quotes", () => {
    expect(
      parseCSV('title,period\r\n"Math, examples",1\r\n"Two\nlines",2')[1],
    ).toEqual(["Math, examples", "1"]);
    expect(() => parseCSV('title\n"unclosed')).toThrow("closing");
  });
  it("maps OneRoster classes and deduplicates repeat imports without overwriting edits", async () => {
    const rows = parseCSV(
      "sourcedId,title,classCode\nclass-1,Fictional Math,P1",
    );
    const mapping = suggestMapping(rows[0], "course");
    const first = await previewCSV(
      rows,
      "course",
      mapping,
      [],
      "UTC",
      "OneRoster",
    );
    expect(first[0].state).toBe("new");
    expect(first[0].data.period).toBe("P1");
    const db = new LifeDB("import-" + crypto.randomUUID());
    try {
      const repo = new Repository(db);
      await repo.save("course", first[0].data, undefined, "imported");
      const repeated = await previewCSV(
        rows,
        "course",
        mapping,
        await repo.list(),
        "UTC",
        "OneRoster",
      );
      expect(repeated[0].state).toBe("duplicate");
      const changed = await previewCSV(
        parseCSV(
          "sourcedId,title,classCode\nclass-1,Fictional Math Revised,P1",
        ),
        "course",
        mapping,
        await repo.list(),
        "UTC",
        "OneRoster",
      );
      expect(changed[0].state).toBe("changed");
      expect((await repo.list())[0].data.title).toBe("Fictional Math");
    } finally {
      await db.delete();
    }
  });
  it("requires known course links and exact dates instead of guessing", async () => {
    const rows = parseCSV(
      "title,course,due\nWorksheet,Unknown course,next Tuesday",
    );
    const result = await previewCSV(
      rows,
      "assignment",
      suggestMapping(rows[0], "assignment"),
      [],
      "UTC",
    );
    expect(result[0].state).toBe("invalid");
    const taskRows = parseCSV("title,due\nWorksheet,01/02/2030");
    expect(
      (
        await previewCSV(
          taskRows,
          "task",
          suggestMapping(taskRows[0], "task"),
          [],
          "UTC",
        )
      )[0].state,
    ).toBe("invalid");
  });
  it("preserves unknown grade weights in imported assessments", async () => {
    const id = crypto.randomUUID();
    const course = {
      id,
      kind: "course" as const,
      data: { title: "Fictional Math" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      revision: 1,
      sortOrder: 1,
      provenance: "manual" as const,
    };
    const rows = parseCSV(
      "title,course,category,earned,possible\nQuiz,Fictional Math,Quizzes,9,10",
    );
    const result = await previewCSV(
      rows,
      "assessment",
      suggestMapping(rows[0], "assessment"),
      [course],
      "UTC",
    );
    expect(result[0].state).toBe("new");
    expect(result[0].data.weight).toBeUndefined();
  });
});
describe("image attachment checks", () => {
  it("rejects SVG, MIME mismatches and arbitrary text disguised as PNG", () => {
    expect(
      imageSignature(new TextEncoder().encode("<svg/>"), "image/png"),
    ).toBe(false);
    expect(
      imageSignature(
        new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
        "image/png",
      ),
    ).toBe(true);
    expect(() =>
      attachmentSchema.parse({
        id: crypto.randomUUID(),
        name: "bad.svg",
        mime: "image/svg+xml",
        dataURL: "data:image/svg+xml;base64,AAAA",
      }),
    ).toThrow();
  });
});
