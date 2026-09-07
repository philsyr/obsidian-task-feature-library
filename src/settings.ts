import { App, PluginSettingTab, Setting } from "obsidian";

import type TaskFeatureLibraryPlugin from "./main";
import type { FeatureId } from "./features/feature";
import { FEATURE_DEFINITIONS } from "./features/registry";

export type TaskFeatureLibrarySettings = Record<FeatureId, boolean>;

export const DEFAULT_SETTINGS = FEATURE_DEFINITIONS.reduce(
  (settings, feature) => {
    settings[feature.id] = feature.defaultEnabled;
    return settings;
  },
  {} as TaskFeatureLibrarySettings,
);

export class TaskFeatureLibrarySettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: TaskFeatureLibraryPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Task features" });
    containerEl.createEl("p", {
      text: "Each feature can be enabled or disabled independently.",
      cls: "setting-item-description",
    });

    for (const feature of FEATURE_DEFINITIONS) {
      new Setting(this.containerEl)
        .setName(feature.name)
        .setDesc(feature.description)
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings[feature.id])
            .onChange(async (enabled) => {
              await this.plugin.setFeatureEnabled(feature.id, enabled);
            }),
        );
    }
  }
}
