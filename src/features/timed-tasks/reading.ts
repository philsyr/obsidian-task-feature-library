import { parseStartTimeText } from "./time";

export const TIME_TOKEN_CLASS = "task-feature-library-time-token";
const LEGACY_TIMED_TASK_CLASS = "task-feature-library-timed-task";
const LEGACY_COMPLETE_TIMED_TASK_CLASS =
  "task-feature-library-timed-task-complete";
const TASKS_TEXT_WRAPPER_CLASS = "tasks-list-text";

export function decorateTimedTasks(root: HTMLElement): void {
  cleanupTimedTasks(root);
  const ownerDocument = root.ownerDocument;

  for (const task of elementsIncludingRoot(root, "li.task-list-item")) {
    if (!hasStandardTaskStatus(task) || isInQuotedContainer(task)) {
      continue;
    }
    const firstTextNode = findFirstTaskTextNode(task);
    if (firstTextNode === null) {
      continue;
    }

    const startTime = parseStartTimeText(firstTextNode.data);
    if (startTime === null) {
      continue;
    }

    const fragment = ownerDocument.createDocumentFragment();
    fragment.append(firstTextNode.data.slice(0, startTime.from));
    const token = ownerDocument.createElement("span");
    token.className = TIME_TOKEN_CLASS;
    token.textContent = startTime.time;
    fragment.append(token);
    fragment.append(firstTextNode.data.slice(startTime.to));
    firstTextNode.replaceWith(fragment);
  }
}

export function cleanupTimedTasks(root: ParentNode): void {
  for (const task of elementsIncludingRoot(
    root,
    `.${LEGACY_TIMED_TASK_CLASS}, .${LEGACY_COMPLETE_TIMED_TASK_CLASS}, [data-task-feature-library-start-time]`,
  )) {
    task.classList.remove(
      LEGACY_TIMED_TASK_CLASS,
      LEGACY_COMPLETE_TIMED_TASK_CLASS,
    );
    delete task.dataset.taskFeatureLibraryStartTime;
  }

  for (const token of elementsIncludingRoot(root, `.${TIME_TOKEN_CLASS}`)) {
    const parent = token.parentNode;
    token.replaceWith(
      token.ownerDocument.createTextNode(token.textContent ?? ""),
    );
    parent?.normalize();
  }
}

function findFirstTaskTextNode(task: HTMLElement): Text | null {
  const checkbox = ownedCheckbox(task);
  const contentContainer = checkbox?.parentElement;
  if (
    checkbox === null ||
    contentContainer === null ||
    contentContainer === undefined
  ) {
    return null;
  }

  let reachedCheckbox = false;
  for (const node of Array.from(contentContainer.childNodes)) {
    if (node === checkbox) {
      reachedCheckbox = true;
      continue;
    }
    if (!reachedCheckbox) {
      continue;
    }

    if (node.nodeType === 3) {
      const text = node as Text;
      if (text.data.trim().length > 0) {
        return text;
      }
      continue;
    }

    if (
      node.nodeType === 1 &&
      (node as HTMLElement).classList.contains(TASKS_TEXT_WRAPPER_CLASS)
    ) {
      return findFirstTextInTasksWrapper(node as HTMLElement);
    }

    // A Markdown element before the text means that the raw task content did
    // not start with a plain HH:MM token.
    return null;
  }

  return null;
}

function findFirstTextInTasksWrapper(wrapper: HTMLElement): Text | null {
  const showText = wrapper.ownerDocument.defaultView?.NodeFilter.SHOW_TEXT ?? 4;
  const walker = wrapper.ownerDocument.createTreeWalker(wrapper, showText);
  let node = walker.nextNode();

  while (node !== null) {
    const text = node as Text;
    if (text.data.trim().length > 0) {
      return text;
    }
    node = walker.nextNode();
  }

  return null;
}

function ownedCheckbox(task: HTMLElement): HTMLInputElement | null {
  return (
    Array.from(
      task.querySelectorAll<HTMLInputElement>("input[type='checkbox']"),
    ).find((candidate) => candidate.closest("li.task-list-item") === task) ??
    null
  );
}

function hasStandardTaskStatus(task: HTMLElement): boolean {
  const status = task.dataset.task;
  return status === "" || status === " " || status?.toLowerCase() === "x";
}

function isInQuotedContainer(task: HTMLElement): boolean {
  return task.closest("blockquote, .callout") !== null;
}

function elementsIncludingRoot(
  root: ParentNode,
  selector: string,
): HTMLElement[] {
  const elements = Array.from(root.querySelectorAll<HTMLElement>(selector));
  if (root.nodeType === 1 && (root as HTMLElement).matches(selector)) {
    elements.unshift(root as HTMLElement);
  }
  return elements;
}
