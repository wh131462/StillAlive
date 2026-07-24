export type EditorCommandType =
  | 'undo'
  | 'redo'
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'heading4'
  | 'heading5'
  | 'heading6'
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'inlineCode'
  | 'quote'
  | 'bulletList'
  | 'orderedList'
  | 'taskList'
  | 'codeBlock'
  | 'link'
  | 'horizontalRule'
  | 'table'
  | 'images'
  | 'mention';

export interface EditorImage {
  id: string;
  uri: string;
  alt: string;
}

export interface EditorCommand {
  id: number;
  type: EditorCommandType;
  value?: string | EditorImage[];
}

export interface EditorMediaSource {
  id: string;
  uri: string;
}
