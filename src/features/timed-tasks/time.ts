import { parseTaskTree } from "../../core/task-tree";

export interface TimedTaskLine {
  /** Zero-based line number. */
  line: number;
  /** Absolute UTF-16 offset of the start of the line. */
  from: number;
  /** Absolute UTF-16 offset of the end of the line, excluding its line break. */
  to: number;
  /** The complete source line, without its line break. */
  text: string;
  /** The single character stored inside the Markdown checkbox. */
  checkboxStatus: string;
  /** The matched HH:MM token. */
  time: string;
  /** Parsed hour in the range 0-23. */
  hour: number;
  /** Parsed minute in the range 0-59. */
  minute: number;
  /** Absolute UTF-16 offset of the start of the HH:MM token. */
  timeFrom: number;
  /** Absolute UTF-16 offset immediately after the HH:MM token. */
  timeTo: number;
  /** Task text after the time token and separating whitespace. */
  taskText: string;
}

export interface StartTime {
  time: string;
  hour: number;
  minute: number;
  /** Relative UTF-16 offset of the time token. */
  from: number;
  /** Relative UTF-16 offset immediately after the time token. */
  to: number;
  taskText: string;
}

const TASK_TIME_PATTERN =
  /^([\t ]*(?:[-+*]|\d+[.)])[\t ]+\[([ xX])\][\t ]+)((?:[01]\d|2[0-3]):[0-5]\d)(?=$|[\t ])/u;

const TIME_RANGE_AFTER_START_PATTERN =
  /^[\t ]*[\-\u2010-\u2015\u2212][\t ]*(?:[01]\d|2[0-3]):[0-5]\d(?=$|[\t ])/u;

const START_TIME_PATTERN = /^((?:[01]\d|2[0-3]):[0-5]\d)(?=$|[\t ])/u;

/** Parse `HH:MM text` without allowing a time range. */
export function parseStartTimeText(text: string): StartTime | null {
  const leadingWhitespaceLength = /^[\t \r\n]*/u.exec(text)?.[0].length ?? 0;
  const candidate = text.slice(leadingWhitespaceLength);
  const match = START_TIME_PATTERN.exec(candidate);
  const time = match?.[1];

  if (time === undefined) {
    return null;
  }

  const tokenFrom = leadingWhitespaceLength;
  const tokenTo = tokenFrom + time.length;
  const textAfterTime = text.slice(tokenTo);
  if (TIME_RANGE_AFTER_START_PATTERN.test(textAfterTime)) {
    return null;
  }
  const taskText = textAfterTime.replace(/^[\t \r\n]+/u, "");

  const [hourText, minuteText] = time.split(":");
  if (hourText === undefined || minuteText === undefined) {
    return null;
  }

  return {
    time,
    hour: Number(hourText),
    minute: Number(minuteText),
    from: tokenFrom,
    to: tokenTo,
    taskText,
  };
}

/**
 * Parse a single Markdown source line as a timed task.
 *
 * A timed task has a valid 24-hour HH:MM token at the very beginning of its
 * task text. Time ranges are deliberately excluded.
 */
export function parseTimedTaskLine(
  text: string,
  line = 0,
  from = 0,
): TimedTaskLine | null {
  const match = TASK_TIME_PATTERN.exec(text);
  if (match === null) {
    return null;
  }

  const prefix = match[1];
  const checkboxStatus = match[2];
  const time = match[3];
  if (
    prefix === undefined ||
    checkboxStatus === undefined ||
    time === undefined
  ) {
    return null;
  }

  const relativeTimeFrom = prefix.length;
  const relativeTimeTo = relativeTimeFrom + time.length;
  const parsedStartTime = parseStartTimeText(text.slice(relativeTimeFrom));
  if (parsedStartTime === null) {
    return null;
  }

  return {
    line,
    from,
    to: from + text.length,
    text,
    checkboxStatus,
    time,
    hour: parsedStartTime.hour,
    minute: parsedStartTime.minute,
    timeFrom: from + relativeTimeFrom,
    timeTo: from + relativeTimeTo,
    taskText: parsedStartTime.taskText,
  };
}

/** Find timed task lines in a Markdown document. */
export function findTimedTasks(markdown: string): TimedTaskLine[] {
  return parseTaskTree(markdown).tasks.flatMap((task) => {
    const startTime = parseStartTimeText(task.content);
    if (startTime === null) {
      return [];
    }

    return [
      {
        line: task.line,
        from: task.from,
        to: task.to,
        text: markdown.slice(task.from, task.to),
        checkboxStatus: task.marker,
        time: startTime.time,
        hour: startTime.hour,
        minute: startTime.minute,
        timeFrom: task.contentFrom + startTime.from,
        timeTo: task.contentFrom + startTime.to,
        taskText: startTime.taskText.replace(/[\t ]+$/u, ""),
      },
    ];
  });
}
