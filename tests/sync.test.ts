import { describe, expect, it } from "vitest";
import { stableHash, syncDecision } from "../src/domain/sync";
import { type LifeRecord } from "../src/domain/model";
const local: LifeRecord = {
  id: crypto.randomUUID(),
  kind: "task",
  data: { title: "Original", status: "open" },
  createdAt: "2026-11-21T00:00:00Z",
  updatedAt: "2026-11-21T00:00:00Z",
  revision: 1,
  sortOrder: 1,
  provenance: "manual",
};
describe("sync reconciliation", () => {
  it("handles JSONB key order without false conflicts", () => {
    const remote = { ...local, data: { status: "open", title: "Original" } };
    expect(stableHash(remote)).toBe(stableHash(local));
    expect(syncDecision(local, { record: remote, version: 1 }, undefined)).toBe(
      "same",
    );
  });
  it("uploads offline edits when the cloud base has not changed", () => {
    const edited = {
      ...local,
      data: { ...local.data, title: "Offline edit" },
      revision: 2,
    };
    expect(
      syncDecision(
        edited,
        { record: local, version: 1 },
        { revision: 1, hash: stableHash(local) },
      ),
    ).toBe("push");
  });
  it("pulls remote-only edits and previews concurrent device edits", () => {
    const remote = {
      record: {
        ...local,
        data: { ...local.data, title: "Other device" },
        revision: 2,
      },
      version: 2,
    };
    const base = { revision: 1, hash: stableHash(local) };
    expect(syncDecision(local, remote, base)).toBe("pull");
    expect(
      syncDecision(
        { ...local, data: { ...local.data, title: "This device" } },
        remote,
        base,
      ),
    ).toBe("conflict");
  });
  it("retains deletion tombstones and treats new ID collisions as conflicts", () => {
    const deleted = {
      ...local,
      deletedAt: "2026-11-21T01:00:00Z",
      revision: 2,
    };
    expect(
      syncDecision(
        deleted,
        { record: local, version: 1 },
        { revision: 1, hash: stableHash(local) },
      ),
    ).toBe("push");
    expect(
      syncDecision(
        local,
        { record: { ...local, data: { title: "Collision" } }, version: 1 },
        undefined,
      ),
    ).toBe("conflict");
  });
});
