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
  | 'unlink'
  | 'horizontalRule'
  | 'table'
  | 'tableAddRow'
  | 'tableDeleteRow'
  | 'tableAddColumn'
  | 'tableDeleteColumn'
  | 'tableDelete'
  | 'images'
  | 'replaceImage'
  | 'mention'
  | 'audio'
  | 'recordingStart'
  | 'recordingCancel';

export interface EditorImage {
  id: string;
  uri: string;
  alt: string;
}

export interface EditorAudio {
  durationMs: number;
  id: string;
  uri: string;
}

export interface EditorImageReplacement extends EditorImage {
  previousId: string;
}

export interface EditorCommand {
  id: number;
  type: EditorCommandType;
  value?: string | EditorAudio | EditorImage[] | EditorImageReplacement;
}

export interface EditorMediaSource {
  id: string;
  mimeType?: string;
  uri: string;
}

export interface EditorTheme {
  colorScheme: 'light' | 'dark';
  paper: string;
  sheet: string;
  ink: string;
  inkSoft: string;
  inkFaint: string;
  line: string;
  life: string;
  lifeDeep: string;
  lifeLight: string;
  lifeLine: string;
  sun: string;
  onLife: string;
  danger: string;
  dangerLight: string;
  dangerLine: string;
  overlay: string;
  codeBackground: string;
  codeForeground: string;
}
