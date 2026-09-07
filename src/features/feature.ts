import { Component } from "obsidian";
import type { Extension } from "@codemirror/state";

export const FEATURE_IDS = ["parentCheckboxes", "timedTasks"] as const;
export type FeatureId = (typeof FEATURE_IDS)[number];

/** A separately toggleable unit inside the plugin. */
export abstract class TaskFeature extends Component {
  abstract readonly id: FeatureId;
  abstract readonly editorExtensions: readonly Extension[];

  abstract decorateReadingView(root: HTMLElement): void;
  abstract cleanupReadingView(root: ParentNode): void;
}
