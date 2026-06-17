import { describe, expect, it } from "vitest";

import { createId } from "./ids.js";

describe("createId", () => {
  it("generates a UUID-shaped id", () => {
    const id = createId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("adds the provided prefix", () => {
    const id = createId("task");

    expect(id).toMatch(/^task_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("generates distinct ids", () => {
    expect(createId()).not.toEqual(createId());
  });
});
