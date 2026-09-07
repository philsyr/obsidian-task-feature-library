import type { App } from "obsidian";

import type { FeatureId, TaskFeature } from "./feature";
import { ParentTasksFeature } from "./parent-tasks/feature";
import { TimedTasksFeature } from "./timed-tasks/feature";

export interface FeatureDefinition {
  id: FeatureId;
  name: string;
  description: string;
  defaultEnabled: boolean;
  create(app: App): TaskFeature;
}

/** Single registry used by lifecycle management and the settings screen. */
export const FEATURE_DEFINITIONS: readonly FeatureDefinition[] = [
  {
    id: "parentCheckboxes",
    name: "Automatic parent checkboxes",
    description:
      "Completes a parent task automatically when all of its nested tasks are complete.",
    defaultEnabled: true,
    create: (app) => new ParentTasksFeature(app),
  },
  {
    id: "timedTasks",
    name: "Start-time highlighting",
    description:
      "Highlights tasks whose text starts with a time in HH:MM format.",
    defaultEnabled: true,
    create: () => new TimedTasksFeature(),
  },
];
