import { RangeSetBuilder } from "@codemirror/state";
import type { Extension } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";

import { findTimedTasks } from "./time";

export const TIME_TOKEN_CLASS = "task-feature-library-time-token";

export function createTimedTaskEditorExtension(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view);
      }

      update(update: ViewUpdate): void {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildDecorations(update.view);
        }
      }
    },
    {
      decorations: (plugin) => plugin.decorations,
    },
  );
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const timedTasks = findTimedTasks(view.state.doc.toString());

  for (const timedTask of timedTasks) {
    const visible = view.visibleRanges.some(
      (range) => timedTask.to >= range.from && timedTask.from <= range.to,
    );
    if (!visible) {
      continue;
    }

    builder.add(
      timedTask.timeFrom,
      timedTask.timeTo,
      Decoration.mark({ class: TIME_TOKEN_CLASS }),
    );
  }

  return builder.finish();
}
