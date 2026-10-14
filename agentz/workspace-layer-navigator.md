---
id: workspace_layer_navigator
title: "Navigate & Preserve Workspace UI Layers"
priority: high
---

# Workspace Layer Navigator

## 5 Primary Workbench Layers
1. **Top Command Bar**: Host navigation, quick access, top-level workbench controls.
2. **Left Activity Bar**: Main view switcher (Explorer, Search, Source Control, etc.).
3. **Primary Side Bar**: Active view content (File Explorer, tree views, expanded folders).
4. **Main Editor Group/Webviews**: Code editors and custom webview previews (e.g. `[Preview] README.md`).
5. **Bottom Terminal Panel & Status Bar**: Active terminal sessions (e.g. bash), output, debug console, and status indicators.

## Modal Overlay & Notification Handling
- **`.monaco-quick-input-widget`**: Handle quick picks, command palettes, and modal prompts.
- **`.notifications-toasts`**: Process toast alerts and transient notification dialogs.
- **Sandboxed `iframe` Webviews**: Interact with sandboxed editor webview layers cleanly without losing state.

## State-Preservation Rules
- **Open Editor Tabs**: Preserve existing open editor tabs (such as `[Preview] README.md`).
- **Expanded Folders**: Maintain expanded state of folders in the File Explorer panel.
- **Active Terminal Sessions**: Keep active bash terminal sessions running without restarting or closing panels.
