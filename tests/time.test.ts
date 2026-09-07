import { describe, expect, it } from "vitest";

import {
  findTimedTasks,
  parseStartTimeText,
  parseTimedTaskLine,
} from "../src/features/timed-tasks/time";

describe("parseStartTimeText", () => {
  it("parses one start time and preserves the following text", () => {
    expect(parseStartTimeText("  07:05 Breakfast")).toEqual({
      time: "07:05",
      hour: 7,
      minute: 5,
      from: 2,
      to: 7,
      taskText: "Breakfast",
    });
  });

  it("does not treat a time range as one start time", () => {
    expect(parseStartTimeText("09:30 - 10:00 Meeting")).toBeNull();
  });
});

describe("parseTimedTaskLine", () => {
  it("parses a valid time at the start of task text", () => {
    const source = "- [ ] 09:30 Team meeting";

    expect(parseTimedTaskLine(source)).toEqual({
      line: 0,
      from: 0,
      to: source.length,
      text: source,
      checkboxStatus: " ",
      time: "09:30",
      hour: 9,
      minute: 30,
      timeFrom: 6,
      timeTo: 11,
      taskText: "Team meeting",
    });
  });

  it("accepts the limits of the 24-hour clock and an empty task description", () => {
    expect(parseTimedTaskLine("- [x] 00:00 Start of day")?.time).toBe("00:00");
    expect(parseTimedTaskLine("- [X] 23:59")?.taskText).toBe("");
  });

  it("supports indentation and Markdown list markers", () => {
    expect(parseTimedTaskLine("  * [ ] 08:05 Stand-up")?.timeFrom).toBe(8);
    expect(parseTimedTaskLine("12. [ ] 17:45 Review")?.time).toBe("17:45");
  });

  it.each([
    "- [ ] 24:00 Invalid hour",
    "- [ ] 09:60 Invalid minute",
    "- [ ] 9:30 Missing leading zero",
    "- [ ] 09:30Meeting without separator",
    "- [ ] Meeting at 09:30",
    "09:30 Not a checkbox task",
  ])("rejects an invalid timed task: %s", (source) => {
    expect(parseTimedTaskLine(source)).toBeNull();
  });

  it.each([
    "- [ ] 09:30-10:30 Planning",
    "- [ ] 09:30 - 10:30 Planning",
    "- [ ] 09:30 – 10:30 Planning",
    "- [ ] 09:30 — 10:30 Planning",
  ])("rejects time ranges: %s", (source) => {
    expect(parseTimedTaskLine(source)).toBeNull();
  });

  it("allows punctuation after a single start time", () => {
    expect(parseTimedTaskLine("- [ ] 09:30 — Team call")?.taskText).toBe(
      "— Team call",
    );
  });

  it("returns absolute offsets supplied by the caller", () => {
    const source = "\t- [ ] 14:05 Call";
    const result = parseTimedTaskLine(source, 7, 100);

    expect(result).toMatchObject({
      line: 7,
      from: 100,
      to: 100 + source.length,
      timeFrom: 107,
      timeTo: 112,
    });
  });
});

describe("findTimedTasks", () => {
  it("returns metadata and absolute time ranges for all matching lines", () => {
    const markdown = [
      "# Schedule",
      "- [ ] 09:00 Stand-up",
      "- [ ] Untimed task",
      "  - [x] 13:45 Lunch",
    ].join("\n");

    const matches = findTimedTasks(markdown);

    expect(matches).toHaveLength(2);
    expect(matches[0]).toMatchObject({
      line: 1,
      from: 11,
      to: 31,
      time: "09:00",
      timeFrom: 17,
      timeTo: 22,
    });
    expect(matches[1]).toMatchObject({
      line: 3,
      time: "13:45",
      taskText: "Lunch",
    });
    expect(markdown.slice(matches[1]?.timeFrom, matches[1]?.timeTo)).toBe(
      "13:45",
    );
  });

  it("keeps correct offsets with CRLF line endings", () => {
    const markdown = "- [ ] 08:00 First\r\n- [ ] 10:15 Second";
    const matches = findTimedTasks(markdown);

    expect(
      matches.map(({ line, from, timeFrom }) => ({ line, from, timeFrom })),
    ).toEqual([
      { line: 0, from: 0, timeFrom: 6 },
      { line: 1, from: 19, timeFrom: 25 },
    ]);
  });

  it("ignores task-looking examples in frontmatter and fenced code", () => {
    const markdown = [
      "---",
      "sample: '- [ ] 08:00 Not a task'",
      "---",
      "```md",
      "- [ ] 09:00 Not a task",
      "```",
      "- [ ] 10:00 Real task",
    ].join("\n");

    expect(findTimedTasks(markdown).map((task) => task.time)).toEqual([
      "10:00",
    ]);
  });
});
