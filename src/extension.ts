import * as vscode from 'vscode';
import * as fs from 'fs/promises'; // Use promises API for async operations
import * as path from 'path';

// --- Debug Logging Flag ---
// Set to true to enable detailed pop-up notifications for debugging
const DEBUG_LOGGING_ENABLED = false;
// ---

// Helper function to find the Git root directory
async function findGitRoot(startPath: string): Promise<string | null> {
	let currentPath = path.resolve(startPath);
	while (currentPath !== path.parse(currentPath).root) {
		const gitPath = path.join(currentPath, '.git');
		try {
			const stats = await fs.stat(gitPath);
			// Check if it's a directory OR a file (for submodules/worktrees)
			if (stats.isDirectory() || stats.isFile()) {
				if (DEBUG_LOGGING_ENABLED) console.log(`Found .git at: ${gitPath}, using root: ${currentPath}`);
				return currentPath; // Found the .git directory or file
			}
		} catch (err: any) {
			if (err.code !== 'ENOENT') {
				console.error(`[findGitRoot] Error checking ${gitPath}:`, err);
				return null; // Unexpected error
			}
			// .git not found, continue searching upwards
		}
		currentPath = path.dirname(currentPath);
	}
	if (DEBUG_LOGGING_ENABLED) console.log(`[findGitRoot] Reached filesystem root from ${startPath} without finding .git`);
	return null; // Reached the filesystem root without finding .git
}

// Helper function to process selected URIs and call the appropriate Cline API function
async function handleFileSelection(
	clineApi: ClineExtensionApi,
	uri: vscode.Uri | undefined,
	selectedUris: vscode.Uri[] | undefined,
	startNewTaskFirst: boolean
): Promise<void> {
	// Re-check clineApi just before use, in case it became invalid
	if (!clineApi) {
		vscode.window.showErrorMessage('[Context Menu Command] Cline API object is not available!');
		return;
	}

	// Determine the URIs to process (handle single click vs multi-select)
	const urisToProcess = selectedUris && selectedUris.length > 0 ? selectedUris : (uri ? [uri] : []);

	if (urisToProcess.length === 0) {
		vscode.window.showWarningMessage('No files or folders selected.');
		return;
	}

	// Filter out non-file URIs just in case
	const fileUris = urisToProcess.filter(u => u.scheme === 'file');

	if (fileUris.length === 0) {
		vscode.window.showWarningMessage('Selection contains no valid files or folders.');
		return;
	}

	const filePaths = fileUris.map(u => u.fsPath);
	vscode.window.showInformationMessage(`Processing ${filePaths.length} item(s) for Cline: ${filePaths.map(p => path.basename(p)).join(', ')}`);

	try {
		// --- Attempt to use the Cline API ---

		if (!clineApi.sendMessage || (startNewTaskFirst && !clineApi.startNewTask)) {
			console.error('Cline API does not have the expected methods (sendMessage/startNewTask).');
			vscode.window.showErrorMessage('Could not find the required functions in the Cline API.');
			return;
		}

		// --- Process selected files/folders ---
		const fileMentions: string[] = [];
		let foldersSkipped = 0;
		let gitRootPath: string | null = null;

		// Determine the Git root based on the first selected URI
		const firstUri = fileUris[0];
		if (firstUri) {
			// Start search from the directory containing the file
			gitRootPath = await findGitRoot(path.dirname(firstUri.fsPath));
		}

		if (!gitRootPath) {
			vscode.window.showErrorMessage("Could not determine Git root directory for the selected files. Ensure they are within a Git repository.");
			return;
		}
		if (DEBUG_LOGGING_ENABLED) console.log(`Git root identified as: ${gitRootPath}`);


		for (const fileUri of fileUris) {
			try {
				// Use VS Code's stat which might be faster/more integrated
				const stats = await vscode.workspace.fs.stat(fileUri);
				if (stats.type === vscode.FileType.File) {
					// Calculate path relative to Git root
					const absolutePath = fileUri.fsPath;
					const relativePath = path.relative(gitRootPath, absolutePath);
					// Add relative file path mention, ensuring POSIX separators
					const posixRelativePath = relativePath.split(path.sep).join(path.posix.sep);
					fileMentions.push(`@${posixRelativePath}`);
					if (DEBUG_LOGGING_ENABLED) console.log(`Adding Git relative path: @${posixRelativePath} (from ${absolutePath})`);
				} else if (stats.type === vscode.FileType.Directory) {
					// Skip folders for now, but count them
					if (DEBUG_LOGGING_ENABLED) console.log(`Skipping folder: ${fileUri.fsPath}`);
					foldersSkipped++;
				} else {
					console.log(`Skipping non-file/folder item: ${fileUri.fsPath}`);
				}
			} catch (readErr) {
				console.error(`Error processing ${fileUri.fsPath}:`, readErr);
				vscode.window.showWarningMessage(`Could not process: ${path.basename(fileUri.fsPath)}`);
			}
		}

		if (fileMentions.length > 0) {
			// Combine all file mentions into a single message string
			const combinedMessage = fileMentions.join(' '); // Separate mentions with a space

			// --- Call Cline API ---

			// Attempt to focus the Cline sidebar view first
			try {
				if (DEBUG_LOGGING_ENABLED) vscode.window.showInformationMessage(`[Context Menu Command] Attempting to focus Cline sidebar...`);
				await vscode.commands.executeCommand('workbench.view.extension.claude-dev-ActivityBar');
				// Add a small delay to allow focus to potentially shift
				await new Promise(resolve => setTimeout(resolve, 150));
				if (DEBUG_LOGGING_ENABLED) vscode.window.showInformationMessage(`[Context Menu Command] Focus command executed.`);
			} catch (focusErr: any) {
				// Show warning only if debugging, otherwise fail silently
				if (DEBUG_LOGGING_ENABLED) vscode.window.showWarningMessage(`[Context Menu Command] Could not execute focus command: ${focusErr.message}`);
			}

			// Start new task if requested
			if (startNewTaskFirst && clineApi.startNewTask) {
				if (DEBUG_LOGGING_ENABLED) vscode.window.showInformationMessage(`[Context Menu Command] Calling startNewTask...`);
				await clineApi.startNewTask(); // Start with no initial message, we'll send files next
				if (DEBUG_LOGGING_ENABLED) vscode.window.showInformationMessage(`[Context Menu Command] startNewTask called.`);
				// Add a slight delay after starting a new task before sending the message
				await new Promise(resolve => setTimeout(resolve, 200));
			}

			// Send the message with file paths
			if (clineApi.sendMessage) {
				if (DEBUG_LOGGING_ENABLED) vscode.window.showInformationMessage(`[Context Menu Command] Calling sendMessage...`);
				await clineApi.sendMessage(combinedMessage);
				if (DEBUG_LOGGING_ENABLED) vscode.window.showInformationMessage(`[Context Menu Command] sendMessage called with: ${combinedMessage.substring(0, 100)}...`);
			} else {
				// Should have been caught earlier, but double-check
				vscode.window.showErrorMessage(`[Context Menu Command] Error: clineApi.sendMessage is not a function`);
				return;
			}


			// Notify user
			let finalMessage = `Attached ${fileMentions.length} file(s) to Cline${startNewTaskFirst ? ' in a new task' : ''}.`;
			if (foldersSkipped > 0) {
				finalMessage += ` ${foldersSkipped} folder(s) were skipped.`;
			}
			vscode.window.showInformationMessage(finalMessage);

		} else if (foldersSkipped > 0) {
			// Only folders were selected
			vscode.window.showWarningMessage(`Skipped ${foldersSkipped} folder(s). Only files can be added currently.`);
		} else {
			// No valid files found after processing
			vscode.window.showWarningMessage('No valid files found in selection to add.');
		}
		// --- End file processing ---

	} catch (err) {
		console.error('Error calling Cline API:', err);
		vscode.window.showErrorMessage(`Failed to add selection to Cline: ${err}`);
	}
}


// Define a basic interface for the expected Cline API
// We assume it has a method to handle adding URIs.
// The actual structure might be different and may need adjustment.
// Define the expected Cline API based on the documentation
interface ClineExtensionApi {
	setCustomInstructions?(instructions: string): Promise<void>;
	getCustomInstructions?(): Promise<string | undefined>;
	startNewTask?(initialMessage?: string, images?: string[]): Promise<void>;
	sendMessage?(message: string): Promise<void>;
	pressPrimaryButton?(): Promise<void>;
	pressSecondaryButton?(): Promise<void>;
}

export async function activate(context: vscode.ExtensionContext) {

	console.log('Cline Context Menu extension activated.');

	// Get the main Cline extension
	const clineExtension = vscode.extensions.getExtension<ClineExtensionApi>('saoudrizwan.claude-dev');

	if (!clineExtension) {
		vscode.window.showErrorMessage('The main Cline extension (saoudrizwan.claude-dev) is not installed or enabled. Please install or enable it.');
		return;
	}

	// Activate the main extension if it's not already active and get its API
	let clineApi: ClineExtensionApi | undefined;
	try {
		if (!clineExtension.isActive) {
			console.log('Activating main Cline extension...');
			clineApi = await clineExtension.activate();
			console.log('Main Cline extension activated.');
		} else {
			clineApi = clineExtension.exports;
		}
	} catch (err) {
		console.error('Failed to activate Cline extension:', err);
		vscode.window.showErrorMessage(`Failed to activate the main Cline extension: ${err}`);
		return;
	}


	if (!clineApi) {
		vscode.window.showErrorMessage('Could not retrieve the API from the main Cline extension.');
		return;
	}

	// Log the API object if debug logging is enabled
	if (DEBUG_LOGGING_ENABLED) {
		vscode.window.showInformationMessage(`[Context Menu] Retrieved clineApi object. Type: ${typeof clineApi}`);
		if (clineApi) {
			try {
				const keys = Object.keys(clineApi);
				vscode.window.showInformationMessage(`[Context Menu] Available Cline API keys: ${keys.join(', ')}`);
				const sendMessageType = typeof (clineApi as any).sendMessage; // Use 'any' to bypass strict type checking for logging
				vscode.window.showInformationMessage(`[Context Menu] typeof clineApi.sendMessage: ${sendMessageType}`);
			} catch (e: any) {
				vscode.window.showErrorMessage(`[Context Menu] Error inspecting Cline API keys: ${e.message}`);
			}
		} else {
			vscode.window.showErrorMessage('[Context Menu] clineApi object is null or undefined after activation!');
			// Note: We still return below if clineApi is truly null/undefined
		}
	}
	// Ensure we still return if the API object is actually missing, regardless of logging
	if (!clineApi) {
		vscode.window.showErrorMessage('Could not retrieve the API from the main Cline extension.');
		return;
	}


	// Register the command to add files to the *current* task
	const addToTaskDisposable = vscode.commands.registerCommand('cline-context-menu.addSelectionToClineTask', async (uri?: vscode.Uri, selectedUris?: vscode.Uri[]) => {
		// We need a valid clineApi object here
		if (!clineApi) {
			vscode.window.showErrorMessage('Cline API not available when trying to add to task.');
			return;
		}
		await handleFileSelection(clineApi, uri, selectedUris, false); // false -> don't start new task
	});

	// Register the command to add files to a *new* task
	const addToNewTaskDisposable = vscode.commands.registerCommand('cline-context-menu.addSelectionToNewClineTask', async (uri?: vscode.Uri, selectedUris?: vscode.Uri[]) => {
		// We need a valid clineApi object here
		if (!clineApi) {
			vscode.window.showErrorMessage('Cline API not available when trying to add to new task.');
			return;
		}
		await handleFileSelection(clineApi, uri, selectedUris, true); // true -> start new task first
	});

	context.subscriptions.push(addToTaskDisposable, addToNewTaskDisposable);
}

export function deactivate() {}
