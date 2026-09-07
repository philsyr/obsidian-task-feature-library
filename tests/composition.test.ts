import { describe, expect, it } from "vitest";

import { updateParentTasks } from "../src/core/task-tree";
import { findTimedTasks } from "../src/features/timed-tasks/time";

describe("feature composition", () => {
  it("keeps a timed parent recognizable after its checkbox is derived", () => {
    const markdown = [
      "- [ ] 09:30 Prepare the meeting",
      "  - [x] Gather the materials",
      "  - [x] Send the agenda",
    ].join("\n");

    const updated = updateParentTasks(markdown).markdown;
    const timedTasks = findTimedTasks(updated);

    expect(updated.startsWith("- [x] 09:30")).toBe(true);
    expect(timedTasks).toHaveLength(1);
    expect(timedTasks[0]).toMatchObject({
      line: 0,
      time: "09:30",
      checkboxStatus: "x",
      taskText: "Prepare the meeting",
    });
  });
});
