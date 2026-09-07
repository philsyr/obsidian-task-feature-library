const LEGACY_PARENT_TASK_CLASS = "task-feature-library-parent-task";
const LEGACY_PARTIAL_PARENT_TASK_CLASS =
  "task-feature-library-parent-task-partial";
const LEGACY_PROGRESS_CLASS = "task-feature-library-parent-progress";
const LEGACY_PARENT_CHECKBOX_CLASS = "task-feature-library-parent-checkbox";

/** Remove UI artifacts left by older releases; automatic parents stay vanilla. */
export function cleanupParentTasks(root: ParentNode): void {
  for (const task of elementsIncludingRoot(
    root,
    `.${LEGACY_PARENT_TASK_CLASS}, .${LEGACY_PARTIAL_PARENT_TASK_CLASS}`,
  )) {
    task.classList.remove(
      LEGACY_PARENT_TASK_CLASS,
      LEGACY_PARTIAL_PARENT_TASK_CLASS,
    );
    delete task.dataset.taskFeatureLibraryParentState;
  }

  for (const task of elementsIncludingRoot(
    root,
    "[data-task-feature-library-parent-state]",
  )) {
    delete task.dataset.taskFeatureLibraryParentState;
  }

  for (const task of elementsIncludingRoot(
    root,
    "[data-task-feature-library-progress]",
  )) {
    delete task.dataset.taskFeatureLibraryProgress;
  }

  for (const progress of elementsIncludingRoot(
    root,
    `.${LEGACY_PROGRESS_CLASS}`,
  )) {
    progress.remove();
  }

  for (const element of elementsIncludingRoot(
    root,
    `.${LEGACY_PARENT_CHECKBOX_CLASS}`,
  )) {
    if (element.tagName === "INPUT") {
      const checkbox = element as HTMLInputElement;
      checkbox.disabled =
        checkbox.dataset.taskFeatureLibraryOriginalDisabled === "true";
      delete checkbox.dataset.taskFeatureLibraryOriginalDisabled;
    }
    element.classList.remove(LEGACY_PARENT_CHECKBOX_CLASS);
  }
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
