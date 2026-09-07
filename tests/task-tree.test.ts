import { describe, expect, it } from "vitest";

import {
  applyParentTaskChanges,
  getParentTaskChanges,
  parseTaskTree,
  updateParentTasks,
} from "../src/core/task-tree";
import { LEGACY_PARENT_TASK_MARKER } from "../src/core/parent-marker";

describe("parseTaskTree", () => {
  it("builds a hierarchy from indentation", () => {
    const markdown = [
      "- [ ] Parent",
      "  - [x] Finished leaf",
      "  - [ ] Nested parent",
      "    - [X] Uppercase leaf",
      "    - [ ] Open leaf",
      "- [X] Standalone",
    ].join("\n");

    const tree = parseTaskTree(markdown);
    const parent = tree.roots[0]!;
    const nestedParent = parent.children[1]!;
    const standalone = tree.roots[1]!;

    expect(tree.tasks).toHaveLength(6);
    expect(tree.roots).toHaveLength(2);
    expect(tree.parents.map((task) => task.line)).toEqual([0, 2]);
    expect(parent.children.map((task) => task.line)).toEqual([1, 2]);
    expect(nestedParent.children.map((task) => task.line)).toEqual([3, 4]);
    expect(nestedParent.parentLine).toBe(0);
    expect(nestedParent.depth).toBe(1);
    expect(parent).toMatchObject({
      line: 0,
      from: 0,
      to: "- [ ] Parent".length,
      markerFrom: 3,
      markerTo: 4,
      isParent: true,
      checked: false,
      computedChecked: false,
      completedLeaves: 2,
      totalLeaves: 3,
    });
    expect(nestedParent).toMatchObject({
      completedLeaves: 1,
      totalLeaves: 2,
      computedChecked: false,
    });
    expect(standalone).toMatchObject({
      marker: "X",
      checked: true,
      isParent: false,
      completedLeaves: 1,
      totalLeaves: 1,
    });
  });

  it("treats equal indents as siblings and any greater indent as a child", () => {
    const markdown = [
      "- [ ] Parent",
      " - [ ] One-space child",
      " - [ ] Sibling child",
      "\t- [x] Tab-indented grandchild",
      "- [ ] Next root",
    ].join("\n");

    const tree = parseTaskTree(markdown);

    expect(tree.roots.map((task) => task.line)).toEqual([0, 4]);
    expect(tree.roots[0]?.children.map((task) => task.line)).toEqual([1, 2]);
    expect(tree.tasks[2]?.children.map((task) => task.line)).toEqual([3]);
  });

  it("accepts standard list markers but rejects custom checkbox statuses", () => {
    const markdown = [
      "* [X] Star",
      "  1. [x] Ordered child",
      "+ [ ] Plus",
      "- [o] Custom status",
      "text [ ] not a task",
      "- [x]no separating whitespace",
    ].join("\n");

    const tree = parseTaskTree(markdown);

    expect(tree.tasks.map((task) => task.content)).toEqual([
      "Star",
      "Ordered child",
      "Plus",
    ]);
    expect(tree.roots).toHaveLength(2);
    expect(tree.roots[0]?.children).toHaveLength(1);
  });

  it("does not treat fenced examples as tasks", () => {
    const markdown = [
      "- [ ] Parent",
      "  ```md",
      "  - [ ] Example only",
      "  ```",
      "  - [x] Real child",
    ].join("\n");

    const tree = parseTaskTree(markdown);

    expect(tree.tasks.map((task) => task.content)).toEqual([
      "Parent",
      "Real child",
    ]);
    expect(tree.roots[0]?.children).toHaveLength(1);
    expect(tree.roots[0]).toMatchObject({
      completedLeaves: 1,
      totalLeaves: 1,
      computedChecked: true,
    });
  });

  it("breaks task ancestry at a non-indented Markdown boundary", () => {
    const markdown = [
      "- [ ] First task",
      "A new paragraph",
      "  - [x] Visually indented but unrelated",
    ].join("\n");

    const tree = parseTaskTree(markdown);

    expect(tree.roots).toHaveLength(2);
    expect(tree.roots[0]?.isParent).toBe(false);
    expect(tree.roots[1]?.parentLine).toBeNull();
  });
});

describe("automatic parent recalculation", () => {
  it("checks nested parents recursively from the bottom up", () => {
    const markdown = [
      "- [ ] Outer",
      "  - [ ] Inner",
      "    - [x] First",
      "    - [X] Second",
      "  - [x] Third",
    ].join("\n");

    const changes = getParentTaskChanges(markdown);
    const update = updateParentTasks(markdown);

    expect(changes.map((change) => change.line)).toEqual([1, 0]);
    expect(changes.map((change) => change.next)).toEqual(["x", "x"]);
    expect(update.markdown).toBe(
      [
        "- [x] Outer",
        "  - [x] Inner",
        "    - [x] First",
        "    - [X] Second",
        "  - [x] Third",
      ].join("\n"),
    );
    expect(update.tree.parents.map((task) => task.checked)).toEqual([
      true,
      true,
    ]);
  });

  it("opens every ancestor when a leaf is open", () => {
    const markdown = [
      "- [x] Outer",
      "  - [X] Inner",
      "    - [x] Finished",
      "    - [ ] Reopened",
      "  - [x] Other",
    ].join("\n");

    const update = updateParentTasks(markdown);

    expect(update.changes.map((change) => change.line)).toEqual([1, 0]);
    expect(update.changes.map((change) => change.previous)).toEqual(["X", "x"]);
    expect(update.markdown).toBe(
      [
        "- [ ] Outer",
        "  - [ ] Inner",
        "    - [x] Finished",
        "    - [ ] Reopened",
        "  - [x] Other",
      ].join("\n"),
    );
  });

  it("never rewrites standalone leaf tasks", () => {
    const markdown = ["- [ ] Open leaf", "- [X] Finished leaf"].join("\n");
    const update = updateParentTasks(markdown);

    expect(update.changes).toEqual([]);
    expect(update.markdown).toBe(markdown);
  });

  it("automatically derives an ordinary parent without opt-in metadata", () => {
    const markdown = ["- [x] Parent", "  - [ ] Open child"].join("\n");

    expect(updateParentTasks(markdown).markdown).toBe(
      ["- [ ] Parent", "  - [ ] Open child"].join("\n"),
    );
  });

  it("preserves CRLF line endings and exposes minimal checkbox offsets", () => {
    const markdown = "- [ ] Parent\r\n  - [x] Child\r\n";
    const update = updateParentTasks(markdown);

    expect(update.markdown).toBe("- [x] Parent\r\n  - [x] Child\r\n");
    expect(update.changes).toEqual([
      {
        line: 0,
        from: 3,
        to: 4,
        previous: " ",
        next: "x",
      },
    ]);
  });

  it("rejects stale edits instead of corrupting text", () => {
    const markdown = ["- [ ] Parent", "  - [x] Child"].join("\n");
    const changes = getParentTaskChanges(markdown);

    expect(() =>
      applyParentTaskChanges(markdown.replace("[ ]", "[X]"), changes),
    ).toThrow(/Stale parent task change/);
  });

  it("removes old opt-in spans while deriving the checkbox", () => {
    const markdown = [
      `- [ ] Parent ${LEGACY_PARENT_TASK_MARKER} #work`,
      "  - [x] Child",
      `  - [x] Finished leaf ${LEGACY_PARENT_TASK_MARKER}`,
    ].join("\n");

    const update = updateParentTasks(markdown);

    expect(update.markdown).toBe(
      ["- [x] Parent #work", "  - [x] Child", "  - [x] Finished leaf"].join(
        "\n",
      ),
    );
    expect(update.markdown).not.toContain(LEGACY_PARENT_TASK_MARKER);
  });

  it("preserves a hard break while removing a legacy marker", () => {
    const markdown = [
      `- [ ] Parent ${LEGACY_PARENT_TASK_MARKER}  `,
      "  - [x] Child",
    ].join("\n");

    expect(updateParentTasks(markdown).markdown).toBe(
      ["- [x] Parent  ", "  - [x] Child"].join("\n"),
    );
  });

  it("preserves an old marker shown inside inline code", () => {
    const markdown = [
      `- [x] Document \`${LEGACY_PARENT_TASK_MARKER}\``,
      "  - [ ] Example child",
    ].join("\n");

    expect(updateParentTasks(markdown).markdown).toBe(
      [
        `- [ ] Document \`${LEGACY_PARENT_TASK_MARKER}\``,
        "  - [ ] Example child",
      ].join("\n"),
    );
  });

  it("does not parse or migrate examples in frontmatter or root code", () => {
    const markdown = [
      "---",
      "example: |",
      `  - [ ] YAML parent ${LEGACY_PARENT_TASK_MARKER}`,
      "    - [x] YAML child",
      "---",
      `    - [ ] Code parent ${LEGACY_PARENT_TASK_MARKER}`,
      "      - [x] Code child",
    ].join("\n");

    expect(parseTaskTree(markdown).tasks).toEqual([]);
    expect(updateParentTasks(markdown).markdown).toBe(markdown);
  });
});
