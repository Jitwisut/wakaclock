/**
 * MinimalTiptap Types
 * @module minimal-tiptap/types
 * @description Type definitions for the MinimalTiptap editor
 */

import type React from 'react';
import type { Editor } from '@tiptap/react';
import type { EditorView } from '@tiptap/pm/view';
import type { EditorState } from '@tiptap/pm/state';

/**
 * Output format for MinimalTiptap editor content
 * @description Specifies the format in which editor content is returned
 */
export type MinimalTiptapOutput = 'html' | 'json' | 'text';

/**
 * Properties for link insertion/editing
 * @description Configuration for creating or updating links in the editor
 */
export interface LinkProps {
  /** The URL of the link */
  url: string;
  /** Optional display text for the link */
  text?: string;
  /** Whether to open the link in a new tab */
  openInNewTab?: boolean;
}

/**
 * Props passed to shouldShow handlers
 * @description Context provided to bubble menu visibility handlers
 */
export interface ShouldShowProps {
  /** The TipTap editor instance */
  editor: Editor;
  /** The ProseMirror editor view */
  view: EditorView;
  /** Current editor state */
  state: EditorState;
  /** Previous editor state (if available) */
  oldState?: EditorState;
  /** Start position of the current selection */
  from: number;
  /** End position of the current selection */
  to: number;
}

/**
 * Configuration for a formatting action
 * @description Defines a formatting action in the editor toolbar
 */
export interface FormatAction {
  /** Display label for the action */
  label: string;
  /** Optional icon to display */
  icon?: React.ReactNode;
  /** Function to execute the action */
  action: (editor: Editor) => void;
  /** Function to check if action is currently active */
  isActive: (editor: Editor) => boolean;
  /** Function to check if action can be executed */
  canExecute: (editor: Editor) => boolean;
  /** Keyboard shortcuts for the action */
  shortcuts: string[];
  /** Unique value identifier for the action */
  value: string;
}
