import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

describe("plugin styles", () => {
  it("does not style parent rows or checkboxes", () => {
    expect(styles).not.toContain("task-feature-library-parent-task");
    expect(styles).not.toContain("task-feature-library-parent-checkbox");
  });

  it("highlights only the time token without adding visual effects", () => {
    const timeRule =
      /\.task-feature-library-time-token\s*\{(?<body>[^}]*)\}/u.exec(styles)
        ?.groups?.body;

    expect(timeRule?.trim()).toBe("color: var(--text-accent);");
    expect(styles).not.toContain(".task-feature-library-timed-task");
  });
});
