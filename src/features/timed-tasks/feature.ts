import type { Extension } from "@codemirror/state";

import { TaskFeature } from "../feature";
import { createTimedTaskEditorExtension } from "./editor";
import { cleanupTimedTasks, decorateTimedTasks } from "./reading";

export class TimedTasksFeature extends TaskFeature {
  readonly id = "timedTasks" as const;
  readonly editorExtensions: readonly Extension[] = [
    createTimedTaskEditorExtension(),
  ];

  decorateReadingView(root: HTMLElement): void {
    decorateTimedTasks(root);
  }

  cleanupReadingView(root: ParentNode): void {
    cleanupTimedTasks(root);
  }
}
