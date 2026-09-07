import { type App, type Editor, MarkdownView, TFile } from "obsidian";
import type { Extension } from "@codemirror/state";

import { getParentTaskChanges, updateParentTasks } from "../../core/task-tree";
import { TaskFeature } from "../feature";
import { cleanupParentTasks } from "./reading";

const EDITOR_TRANSACTION_ORIGIN = "task-feature-library-parent-sync";
const ABORT_FILE_PROCESS = new Error(
  "Task Feature Library: file reconciliation aborted",
);

export class ParentTasksFeature extends TaskFeature {
  readonly id = "parentCheckboxes" as const;
  readonly editorExtensions: readonly Extension[] = [];

  private readonly scheduledFiles = new Map<string, number>();
  private readonly scheduledEditors = new Map<Editor, number>();
  private readonly processingFiles = new Set<string>();
  private readonly processingEditors = new WeakSet<Editor>();
  private active = false;
  private generation = 0;

  constructor(private readonly app: App) {
    super();
  }

  onload(): void {
    this.active = true;
    this.generation += 1;
    const generation = this.generation;

    this.registerEvent(
      this.app.workspace.on("editor-change", (editor) => {
        this.scheduleEditor(editor);
      }),
    );

    this.registerEvent(
      this.app.workspace.on("file-open", () => {
        this.scheduleOpenEditors();
      }),
    );

    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof TFile && file.extension === "md") {
          this.scheduleFile(file);
        }
      }),
    );

    this.scheduleOpenEditors();
    this.app.workspace.onLayoutReady(() => {
      if (this.isCurrent(generation)) {
        this.scheduleOpenEditors();
      }
    });
  }

  onunload(): void {
    this.active = false;
    this.generation += 1;

    for (const timer of this.scheduledFiles.values()) {
      window.clearTimeout(timer);
    }
    for (const timer of this.scheduledEditors.values()) {
      window.clearTimeout(timer);
    }
    this.scheduledFiles.clear();
    this.scheduledEditors.clear();
  }

  decorateReadingView(root: HTMLElement): void {
    cleanupParentTasks(root);
  }

  cleanupReadingView(root: ParentNode): void {
    cleanupParentTasks(root);
  }

  private reconcileEditor(editor: Editor): void {
    if (!this.active || this.processingEditors.has(editor)) {
      return;
    }

    const changes = getParentTaskChanges(editor.getValue());
    if (changes.length === 0) {
      return;
    }

    this.processingEditors.add(editor);
    try {
      editor.transaction(
        {
          changes: changes
            .slice()
            .sort((left, right) => left.from - right.from)
            .map((change) => ({
              from: editor.offsetToPos(change.from),
              to: editor.offsetToPos(change.to),
              text: change.next,
            })),
        },
        EDITOR_TRANSACTION_ORIGIN,
      );
    } finally {
      window.setTimeout(() => this.processingEditors.delete(editor), 0);
    }
  }

  private scheduleEditor(editor: Editor): void {
    if (!this.active || this.processingEditors.has(editor)) {
      return;
    }

    const previousTimer = this.scheduledEditors.get(editor);
    if (previousTimer !== undefined) {
      window.clearTimeout(previousTimer);
    }

    const timer = window.setTimeout(() => {
      this.scheduledEditors.delete(editor);
      this.reconcileEditor(editor);
    }, 40);
    this.scheduledEditors.set(editor, timer);
  }

  private scheduleFile(file: TFile): void {
    const path = file.path;
    if (!this.active || this.processingFiles.has(path)) {
      return;
    }

    const openEditor = this.findOpenEditor(file);
    if (openEditor !== null) {
      this.scheduleEditor(openEditor);
      return;
    }

    const previousTimer = this.scheduledFiles.get(path);
    if (previousTimer !== undefined) {
      window.clearTimeout(previousTimer);
    }

    const timer = window.setTimeout(() => {
      this.scheduledFiles.delete(path);
      void this.reconcileFile(file);
    }, 120);
    this.scheduledFiles.set(path, timer);
  }

  private async reconcileFile(file: TFile): Promise<void> {
    const path = file.path;
    if (!this.active || this.processingFiles.has(path)) {
      return;
    }

    const generation = this.generation;
    this.processingFiles.add(path);
    try {
      const openEditor = this.findOpenEditor(file);
      if (openEditor !== null) {
        this.scheduleEditor(openEditor);
        return;
      }

      const current = await this.app.vault.read(file);
      if (!this.isCurrent(generation)) {
        return;
      }
      const editorAfterRead = this.findOpenEditor(file);
      if (editorAfterRead !== null) {
        this.scheduleEditor(editorAfterRead);
        return;
      }
      if (getParentTaskChanges(current).length === 0) {
        return;
      }

      await this.app.vault.process(file, (markdown) => {
        if (!this.isCurrent(generation)) {
          throw ABORT_FILE_PROCESS;
        }

        const editor = this.findOpenEditor(file);
        if (editor !== null) {
          this.scheduleEditor(editor);
          throw ABORT_FILE_PROCESS;
        }

        return updateParentTasks(markdown).markdown;
      });
    } catch (error) {
      if (error === ABORT_FILE_PROCESS) {
        return;
      }
      console.error(
        `Task Feature Library: could not synchronize ${path}`,
        error,
      );
    } finally {
      this.processingFiles.delete(path);
    }
  }

  private findOpenEditor(file: TFile): Editor | null {
    let editor: Editor | null = null;
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (
        editor === null &&
        leaf.view instanceof MarkdownView &&
        leaf.view.file?.path === file.path
      ) {
        editor = leaf.view.editor;
      }
    });
    return editor;
  }

  private scheduleOpenEditors(): void {
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view instanceof MarkdownView) {
        this.scheduleEditor(leaf.view.editor);
      }
    });
  }

  private isCurrent(generation: number): boolean {
    return this.active && this.generation === generation;
  }
}
