// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import { cleanupParentTasks } from "../src/features/parent-tasks/reading";
import {
  cleanupTimedTasks,
  decorateTimedTasks,
} from "../src/features/timed-tasks/reading";

describe("Reading View decorators", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("leaves vanilla parent tasks visually untouched", () => {
    document.body.innerHTML = `
      <ul>
        <li class="task-list-item foreign-class" data-task="">
          <input type="checkbox"> Parent
          <ul><li class="task-list-item" data-task="x"><input type="checkbox" checked> Child</li></ul>
        </li>
      </ul>`;

    cleanupParentTasks(document.body);

    const parent = document.querySelector<HTMLElement>("li.task-list-item");
    const checkbox = parent?.querySelector<HTMLInputElement>(
      ":scope > input[type='checkbox']",
    );
    expect(parent?.className).toBe("task-list-item foreign-class");
    expect(checkbox?.disabled).toBe(false);
    expect(parent?.dataset.taskFeatureLibraryParentState).toBeUndefined();
  });

  it("cleans every parent UI artifact left by an older release", () => {
    document.body.innerHTML = `
      <ul>
        <li class="task-list-item task-feature-library-parent-task task-feature-library-parent-task-partial"
            data-task=""
            data-task-feature-library-parent-state="partial"
            data-task-feature-library-progress="0/1">
          <input class="task-feature-library-parent-checkbox"
                 data-task-feature-library-original-disabled="false"
                 type="checkbox" disabled>
          Parent
          <span class="task-feature-library-parent-progress">0/1</span>
        </li>
      </ul>`;

    cleanupParentTasks(document.body);

    const parent = document.querySelector<HTMLElement>("li.task-list-item");
    const checkbox = parent?.querySelector<HTMLInputElement>(
      "input[type='checkbox']",
    );
    expect(parent?.className).toBe("task-list-item");
    expect(parent?.dataset.taskFeatureLibraryParentState).toBeUndefined();
    expect(parent?.dataset.taskFeatureLibraryProgress).toBeUndefined();
    expect(checkbox?.disabled).toBe(false);
    expect(
      checkbox?.classList.contains("task-feature-library-parent-checkbox"),
    ).toBe(false);
    expect(
      document.querySelector(".task-feature-library-parent-progress"),
    ).toBeNull();
  });

  it("uses the same timed-task style before and after completion", () => {
    document.body.innerHTML = `
      <ul>
        <li class="task-list-item" data-task=""><input type="checkbox"> 09:30 Open</li>
        <li class="task-list-item" data-task="x"><input type="checkbox" checked> 10:00 Done</li>
      </ul>`;

    decorateTimedTasks(document.body);

    const tasks = document.querySelectorAll<HTMLElement>("li.task-list-item");
    expect(Array.from(tasks).map((task) => task.className)).toEqual([
      "task-list-item",
      "task-list-item",
    ]);
    expect(
      document.querySelector(".task-feature-library-timed-task-complete"),
    ).toBeNull();
    expect(
      Array.from(
        document.querySelectorAll(".task-feature-library-time-token"),
      ).map((token) => token.textContent),
    ).toEqual(["09:30", "10:00"]);
  });

  it("does not treat a child time as the parent's start time", () => {
    document.body.innerHTML = `
      <ul>
        <li class="task-list-item" data-task="">
          <input type="checkbox"> Parent
          <ul><li class="task-list-item" data-task=""><input type="checkbox"> 11:45 Child</li></ul>
        </li>
      </ul>`;

    decorateTimedTasks(document.body);

    const tasks = document.querySelectorAll<HTMLElement>("li.task-list-item");
    const token = document.querySelector<HTMLElement>(
      ".task-feature-library-time-token",
    );
    expect(token?.closest("li.task-list-item")).toBe(tasks[1]);
  });

  it("supports the inline content wrapper used by rendered Tasks queries", () => {
    document.body.innerHTML = `
      <ul>
        <li class="task-list-item" data-task="">
          <input type="checkbox">
          <span class="tasks-list-text">11:20 Wrapped task</span>
        </li>
      </ul>`;

    decorateTimedTasks(document.body);

    expect(
      document.querySelector(".task-feature-library-time-token")?.textContent,
    ).toBe("11:20");
  });

  it("does not inherit a start time from quoted content", () => {
    document.body.innerHTML = `
      <ul>
        <li class="task-list-item" data-task="">
          <input type="checkbox"> Outer task
          <blockquote>12:30 Quoted text</blockquote>
        </li>
      </ul>`;

    decorateTimedTasks(document.body);

    expect(
      document.querySelector(".task-feature-library-time-token"),
    ).toBeNull();
  });

  it("restores original text when the timed feature is cleaned up", () => {
    document.body.innerHTML = `
      <ul><li class="task-list-item task-feature-library-timed-task task-feature-library-timed-task-complete"
              data-task=""
              data-task-feature-library-start-time="14:05"><input type="checkbox"> 14:05 Meeting</li></ul>`;

    decorateTimedTasks(document.body);
    cleanupTimedTasks(document.body);

    const task = document.querySelector<HTMLElement>("li.task-list-item");
    expect(task?.className).toBe("task-list-item");
    expect(task?.dataset.taskFeatureLibraryStartTime).toBeUndefined();
    expect(task?.textContent).toContain("14:05 Meeting");
    expect(
      document.querySelector(".task-feature-library-time-token"),
    ).toBeNull();
  });

  it("uses the root owner document instead of global DOM constructors", () => {
    const foreignDocument =
      document.implementation.createHTMLDocument("preview");
    foreignDocument.body.innerHTML = `
      <ul><li class="task-list-item" data-task=""><input type="checkbox"> 08:15 Meeting</li></ul>`;

    decorateTimedTasks(foreignDocument.body);

    expect(
      foreignDocument.querySelector(".task-feature-library-time-token")
        ?.textContent,
    ).toBe("08:15");
  });
});
