# Cline Context Menu Extension README

This extension adds an "Add Selection to Cline" option to the VS Code file explorer context menu, allowing you to quickly send selected file paths to the main Cline AI assistant (`saoudrizwan.claude-dev`).

## Features

*   Right-click on one or more files in the VS Code Explorer.
*   Select "Add Selection to Cline".
*   The selected file paths (relative to the Git repository root) will be sent to the active Cline chat session using the `@` mention syntax (e.g., `@src/utils/helper.ts @README.md`).

## Requirements

*   Visual Studio Code v1.84.0 or later.
*   The main **Cline** extension (`saoudrizwan.claude-dev`) must be installed and enabled.

## Development & Testing

1.  **Prerequisites:**
    *   Node.js (LTS recommended)
    *   pnpm (`npm install -g pnpm`)
    *   VS Code
    *   The main Cline extension (`saoudrizwan.claude-dev`) installed in your VS Code instance.

2.  **Setup:**
    *   Clone this repository.
    *   Navigate to the `cline-context-menu` directory.
    *   Run `pnpm install` to install dependencies.

3.  **Build:**
    *   Run `pnpm run compile` for a development build.
    *   Run `pnpm run package` for a production build (used for packaging).

4.  **Debugging:**
    *   Open the `cline-context-menu` folder in VS Code.
    *   Ensure the main Cline extension (`saoudrizwan.claude-dev`) is enabled in your VS Code.
    *   **Important:** Temporarily rename or move the local `cline` source directory (if present within this project) to avoid conflicts with the installed main extension during debugging.
    *   Press `F5` to start debugging. This will open a new "Extension Development Host" (EDH) window.
    *   In the EDH window, open a folder/workspace that is part of a Git repository.
    *   Right-click a file in the Explorer and select "Add Selection to Cline".
    *   Check the Cline chat UI (preferably the sidebar) in the EDH window to see if the `@<relative-path>` message appears.

5.  **Debug Logging:**
    *   To enable detailed pop-up notifications for debugging, set the `DEBUG_LOGGING_ENABLED` flag to `true` at the top of `src/extension.ts` and rebuild (`pnpm run compile`).

## Extension Settings

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

For example:

This extension contributes the following settings:

* `myExtension.enable`: Enable/disable this extension.
* `myExtension.thing`: Set to `blah` to do something.

## Known Issues

Calling out known issues can help limit users opening duplicate issues against your extension.

---

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
* Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
* Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
