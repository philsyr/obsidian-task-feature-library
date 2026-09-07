import { removeLegacyParentTaskMarkers } from "./parent-marker";

export type TaskMarker = " " | "x" | "X";

export interface TaskNode {
  /** Zero-based source line. */
  line: number;
  /** Absolute UTF-16 range of the source line, excluding the line break. */
  from: number;
  to: number;
  /** Absolute UTF-16 range of the character inside `[ ]`, `[x]`, or `[X]`. */
  markerFrom: number;
  markerTo: number;
  /** Absolute offset of the first non-whitespace character in task text. */
  contentFrom: number;
  /** Visual indentation columns. Tabs advance to the next four-column stop. */
  indent: number;
  /** Nesting depth among checkbox tasks, with roots at zero. */
  depth: number;
  parentLine: number | null;
  marker: TaskMarker;
  checked: boolean;
  content: string;
  children: TaskNode[];
  isParent: boolean;
  /** Completion derived from leaves. For a leaf, this is the leaf's own state. */
  computedChecked: boolean;
  completedLeaves: number;
  totalLeaves: number;
}

export interface TaskTree {
  roots: TaskNode[];
  tasks: TaskNode[];
  parents: TaskNode[];
}

export interface ParentTaskChange {
  line: number;
  /** Absolute UTF-16 range to replace. */
  from: number;
  to: number;
  previous: string;
  next: string;
}

export interface ParentTaskUpdate {
  markdown: string;
  changes: ParentTaskChange[];
  tree: TaskTree;
}

interface SourceLine {
  line: number;
  from: number;
  to: number;
  text: string;
}

interface Fence {
  character: "`" | "~";
  length: number;
}

const TASK_PATTERN = /^([\t ]*)(?:[-+*]|\d+[.)])[\t ]+\[([ xX])\](?=$|[\t ])/;
const FENCE_PATTERN = /^([\t ]*)(`{3,}|~{3,})/;

/**
 * Parses Markdown checkbox tasks and builds their hierarchy from indentation.
 * Only standard unchecked/checked markers (`[ ]`, `[x]`, and `[X]`) are tasks.
 */
export function parseTaskTree(markdown: string): TaskTree {
  const roots: TaskNode[] = [];
  const tasks: TaskNode[] = [];
  const stack: TaskNode[] = [];
  let fence: Fence | null = null;
  let frontmatter = false;

  for (const sourceLine of splitLines(markdown)) {
    if (sourceLine.line === 0 && /^\uFEFF?---[\t ]*$/u.test(sourceLine.text)) {
      frontmatter = true;
      stack.length = 0;
      continue;
    }

    if (frontmatter) {
      if (/^(?:---|\.\.\.)[\t ]*$/u.test(sourceLine.text)) {
        frontmatter = false;
      }
      continue;
    }

    const fenceMatch = FENCE_PATTERN.exec(sourceLine.text);

    if (fence !== null) {
      if (isClosingFence(sourceLine.text, fence)) {
        fence = null;
      }
      continue;
    }

    if (fenceMatch !== null) {
      pruneStack(stack, indentationColumns(fenceMatch[1] ?? ""));
      const fenceToken = fenceMatch[2] ?? "";
      const character = fenceToken[0];
      if (character === "`" || character === "~") {
        fence = { character, length: fenceToken.length };
      }
      continue;
    }

    const match = TASK_PATTERN.exec(sourceLine.text);
    if (match === null) {
      if (sourceLine.text.trim().length > 0) {
        pruneStack(
          stack,
          indentationColumns(leadingWhitespace(sourceLine.text)),
        );
      }
      continue;
    }

    const indentation = match[1] ?? "";
    const marker = match[2] as TaskMarker;
    const indent = indentationColumns(indentation);
    const contentWhitespace =
      /^[\t ]*/u.exec(sourceLine.text.slice(match[0].length))?.[0] ?? "";

    // At the document root, four leading spaces are an indented code block,
    // not a rendered list. Nested lists still have an active task ancestor.
    if (indent >= 4 && stack.length === 0) {
      continue;
    }

    while (stack.length > 0 && stack[stack.length - 1]!.indent >= indent) {
      stack.pop();
    }

    const parent = stack.length > 0 ? stack[stack.length - 1]! : null;
    const markerOffset = match[0].length - 2;
    const node: TaskNode = {
      line: sourceLine.line,
      from: sourceLine.from,
      to: sourceLine.to,
      markerFrom: sourceLine.from + markerOffset,
      markerTo: sourceLine.from + markerOffset + 1,
      contentFrom: sourceLine.from + match[0].length + contentWhitespace.length,
      indent,
      depth: parent === null ? 0 : parent.depth + 1,
      parentLine: parent === null ? null : parent.line,
      marker,
      checked: marker === "x" || marker === "X",
      content: sourceLine.text.slice(match[0].length).replace(/^[\t ]+/, ""),
      children: [],
      isParent: false,
      computedChecked: false,
      completedLeaves: 0,
      totalLeaves: 0,
    };

    if (parent === null) {
      roots.push(node);
    } else {
      parent.children.push(node);
    }

    tasks.push(node);
    stack.push(node);
  }

  for (const root of roots) {
    populateProgress(root);
  }

  return {
    roots,
    tasks,
    parents: tasks.filter((task) => task.isParent),
  };
}

/**
 * Returns the edits needed to make every structural parent match its
 * recursively derived leaf completion and remove obsolete HTML opt-in markers.
 * Changes are ordered bottom-up.
 */
export function getParentTaskChanges(markdown: string): ParentTaskChange[] {
  const tree = parseTaskTree(markdown);
  const changes: ParentTaskChange[] = [];

  for (const root of tree.roots) {
    collectParentTaskChanges(root, markdown, changes);
  }

  return changes;
}

/** Applies verified, non-overlapping task changes without rewriting other text. */
export function applyParentTaskChanges(
  markdown: string,
  changes: readonly ParentTaskChange[],
): string {
  const ordered = Array.from(changes).sort(
    (left, right) => right.from - left.from,
  );
  let upperBound = markdown.length;
  let result = markdown;

  for (const change of ordered) {
    if (
      !Number.isInteger(change.from) ||
      !Number.isInteger(change.to) ||
      change.from < 0 ||
      change.to < change.from ||
      change.to > markdown.length
    ) {
      throw new RangeError(
        `Invalid task change range ${change.from}:${change.to}`,
      );
    }

    if (change.to > upperBound) {
      throw new RangeError("Parent task changes must not overlap");
    }

    const current = markdown.slice(change.from, change.to);
    if (current !== change.previous) {
      throw new Error(
        `Stale parent task change on line ${change.line}: expected ${JSON.stringify(change.previous)}, found ${JSON.stringify(current)}`,
      );
    }

    result =
      result.slice(0, change.from) + change.next + result.slice(change.to);
    upperBound = change.from;
  }

  return result;
}

/** Recalculates automatic parents and returns the updated tree for rendering. */
export function updateParentTasks(markdown: string): ParentTaskUpdate {
  const changes = getParentTaskChanges(markdown);
  const updatedMarkdown = applyParentTaskChanges(markdown, changes);

  return {
    markdown: updatedMarkdown,
    changes,
    tree: parseTaskTree(updatedMarkdown),
  };
}

function collectParentTaskChanges(
  node: TaskNode,
  markdown: string,
  changes: ParentTaskChange[],
): void {
  for (const child of node.children) {
    collectParentTaskChanges(child, markdown, changes);
  }

  const sourceLine = markdown.slice(node.from, node.to);
  let nextLine = removeLegacyParentTaskMarkers(sourceLine);
  const checkboxChanged =
    node.isParent && node.checked !== node.computedChecked;

  if (nextLine !== sourceLine) {
    if (checkboxChanged) {
      const markerFrom = node.markerFrom - node.from;
      nextLine =
        nextLine.slice(0, markerFrom) +
        (node.computedChecked ? "x" : " ") +
        nextLine.slice(markerFrom + 1);
    }

    changes.push({
      line: node.line,
      from: node.from,
      to: node.to,
      previous: sourceLine,
      next: nextLine,
    });
    return;
  }

  if (!checkboxChanged) {
    return;
  }

  changes.push({
    line: node.line,
    from: node.markerFrom,
    to: node.markerTo,
    previous: node.marker,
    next: node.computedChecked ? "x" : " ",
  });
}

function populateProgress(node: TaskNode): void {
  node.isParent = node.children.length > 0;

  if (!node.isParent) {
    node.totalLeaves = 1;
    node.completedLeaves = node.checked ? 1 : 0;
    node.computedChecked = node.checked;
    return;
  }

  let completedLeaves = 0;
  let totalLeaves = 0;

  for (const child of node.children) {
    populateProgress(child);
    completedLeaves += child.completedLeaves;
    totalLeaves += child.totalLeaves;
  }

  node.completedLeaves = completedLeaves;
  node.totalLeaves = totalLeaves;
  node.computedChecked = totalLeaves > 0 && completedLeaves === totalLeaves;
}

function pruneStack(stack: TaskNode[], indent: number): void {
  while (stack.length > 0 && stack[stack.length - 1]!.indent >= indent) {
    stack.pop();
  }
}

function indentationColumns(whitespace: string): number {
  let columns = 0;

  for (const character of whitespace) {
    columns = character === "\t" ? columns + (4 - (columns % 4)) : columns + 1;
  }

  return columns;
}

function leadingWhitespace(line: string): string {
  const match = /^[\t ]*/.exec(line);
  return match?.[0] ?? "";
}

function isClosingFence(line: string, fence: Fence): boolean {
  const trimmed = line.replace(/^[\t ]+/, "");
  let length = 0;

  while (trimmed[length] === fence.character) {
    length += 1;
  }

  return length >= fence.length && /^[\t ]*$/.test(trimmed.slice(length));
}

function splitLines(markdown: string): SourceLine[] {
  const rawLines = markdown.split("\n");
  const lines: SourceLine[] = [];
  let offset = 0;

  for (let line = 0; line < rawLines.length; line += 1) {
    const raw = rawLines[line] ?? "";
    const text = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    lines.push({
      line,
      from: offset,
      to: offset + text.length,
      text,
    });
    offset += raw.length + (line < rawLines.length - 1 ? 1 : 0);
  }

  return lines;
}
