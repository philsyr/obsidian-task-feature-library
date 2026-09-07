import { MarkdownRenderChild, MarkdownView, Plugin } from "obsidian";
import type { Extension } from "@codemirror/state";

import { type FeatureId, TaskFeature } from "./features/feature";
import { FEATURE_DEFINITIONS } from "./features/registry";
import {
  DEFAULT_SETTINGS,
  TaskFeatureLibrarySettingTab,
  type TaskFeatureLibrarySettings,
} from "./settings";

export default class TaskFeatureLibraryPlugin extends Plugin {
  settings: TaskFeatureLibrarySettings = { ...DEFAULT_SETTINGS };

  private readonly editorExtensions: Extension[] = [];
  private readonly activeFeatures = new Map<FeatureId, TaskFeature>();
  private readonly renderedRoots = new Set<HTMLElement>();
  private settingsSaveQueue: Promise<void> = Promise.resolve();

  async onload(): Promise<void> {
    await this.loadSettings();
    this.reconcileFeatures(false);

    this.registerEditorExtension(this.editorExtensions);
    this.registerMarkdownPostProcessor((element, context) => {
      if (!this.renderedRoots.has(element)) {
        this.renderedRoots.add(element);
        context.addChild(
          new RenderRootTracker(element, () => {
            this.renderedRoots.delete(element);
          }),
        );
      }

      for (const feature of this.activeFeatures.values()) {
        feature.decorateReadingView(element);
      }
    });
    this.addSettingTab(new TaskFeatureLibrarySettingTab(this.app, this));
    this.app.workspace.onLayoutReady(() => this.rerenderReadingViews());
  }

  onunload(): void {
    for (const feature of this.activeFeatures.values()) {
      this.cleanupFeature(feature);
    }
    this.renderedRoots.clear();
  }

  async setFeatureEnabled(id: FeatureId, enabled: boolean): Promise<void> {
    if (this.settings[id] === enabled) {
      return;
    }

    this.settings[id] = enabled;
    this.reconcileFeatures(true);

    const snapshot = { ...this.settings };
    const save = this.settingsSaveQueue
      .catch(() => undefined)
      .then(() => this.saveData(snapshot));
    this.settingsSaveQueue = save;
    await save;
  }

  private async loadSettings(): Promise<void> {
    const saved =
      (await this.loadData()) as Partial<TaskFeatureLibrarySettings> | null;
    this.settings = { ...DEFAULT_SETTINGS };
    for (const feature of FEATURE_DEFINITIONS) {
      const savedValue = saved?.[feature.id];
      if (typeof savedValue === "boolean") {
        this.settings[feature.id] = savedValue;
      }
    }
  }

  private reconcileFeatures(refreshViews: boolean): void {
    for (const definition of FEATURE_DEFINITIONS) {
      const { id } = definition;
      const current = this.activeFeatures.get(id);
      const shouldBeActive = this.settings[id];

      if (shouldBeActive && current === undefined) {
        this.activeFeatures.set(id, this.addChild(definition.create(this.app)));
      } else if (!shouldBeActive && current !== undefined) {
        this.cleanupFeature(current);
        this.removeChild(current);
        this.activeFeatures.delete(id);
      }
    }

    this.editorExtensions.splice(
      0,
      this.editorExtensions.length,
      ...Array.from(this.activeFeatures.values()).flatMap((feature) =>
        Array.from(feature.editorExtensions),
      ),
    );

    if (refreshViews) {
      this.app.workspace.updateOptions();
      this.redecorateTrackedRoots();
      this.rerenderReadingViews();
    }
  }

  private rerenderReadingViews(): void {
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view instanceof MarkdownView) {
        leaf.view.previewMode.rerender(true);
      }
    });
  }

  private cleanupFeature(feature: TaskFeature): void {
    for (const root of this.renderedRoots) {
      feature.cleanupReadingView(root);
    }
  }

  private redecorateTrackedRoots(): void {
    for (const root of this.renderedRoots) {
      if (!root.isConnected) {
        this.renderedRoots.delete(root);
        continue;
      }

      for (const feature of this.activeFeatures.values()) {
        feature.decorateReadingView(root);
      }
    }
  }
}

class RenderRootTracker extends MarkdownRenderChild {
  constructor(
    containerEl: HTMLElement,
    private readonly onDetach: () => void,
  ) {
    super(containerEl);
  }

  onunload(): void {
    this.onDetach();
  }
}
