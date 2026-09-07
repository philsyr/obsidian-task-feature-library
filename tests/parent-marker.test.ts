import { describe, expect, it } from "vitest";

import {
  LEGACY_PARENT_TASK_MARKER,
  removeLegacyParentTaskMarkers,
} from "../src/core/parent-marker";

describe("legacy parent marker cleanup", () => {
  it("removes a marker left by an older plugin release", () => {
    expect(
      removeLegacyParentTaskMarkers(
        `- [ ] Parent ${LEGACY_PARENT_TASK_MARKER}`,
      ),
    ).toBe("- [ ] Parent");
  });

  it("preserves text, tags, and Obsidian block IDs around the marker", () => {
    expect(
      removeLegacyParentTaskMarkers(
        `- [ ] Parent ${LEGACY_PARENT_TASK_MARKER} #work ^release-plan`,
      ),
    ).toBe("- [ ] Parent #work ^release-plan");
  });

  it("preserves trailing spaces used as a Markdown hard break", () => {
    expect(
      removeLegacyParentTaskMarkers(
        `- [ ] Parent ${LEGACY_PARENT_TASK_MARKER}  `,
      ),
    ).toBe("- [ ] Parent  ");
  });

  it("does not remove a marker shown as an inline-code example", () => {
    const source = `- [ ] Show \`${LEGACY_PARENT_TASK_MARKER}\``;
    expect(removeLegacyParentTaskMarkers(source)).toBe(source);

    const doubleBackticks = `- [ ] Show \`\`${LEGACY_PARENT_TASK_MARKER}\`\``;
    expect(removeLegacyParentTaskMarkers(doubleBackticks)).toBe(
      doubleBackticks,
    );
  });

  it("conservatively preserves text after an unmatched code delimiter", () => {
    const source = `- [ ] Open code \`${LEGACY_PARENT_TASK_MARKER}`;
    expect(removeLegacyParentTaskMarkers(source)).toBe(source);
  });

  it("removes duplicate legacy markers and is idempotent", () => {
    const source = `- [ ] Parent ${LEGACY_PARENT_TASK_MARKER} text ${LEGACY_PARENT_TASK_MARKER}`;
    const cleaned = removeLegacyParentTaskMarkers(source);

    expect(cleaned).toBe("- [ ] Parent text");
    expect(removeLegacyParentTaskMarkers(cleaned)).toBe(cleaned);
  });
});
