export type FeedbackButtonStyle = 'default' | 'cancel' | 'destructive';

export interface FeedbackButton {
  text: string;
  onPress?: () => void;
  style?: FeedbackButtonStyle;
}

export interface FeedbackAlertRequest {
  kind: 'alert';
  title: string;
  message?: string;
  buttons: FeedbackButton[];
}

export interface FeedbackPromptRequest {
  kind: 'prompt';
  title: string;
  message?: string;
  defaultValue?: string;
  onSubmit: (value: string) => void;
}

export type FeedbackRequest = FeedbackAlertRequest | FeedbackPromptRequest;
type FeedbackPresenter = (request: FeedbackRequest) => void;

let presenter: FeedbackPresenter | null = null;
const pendingRequests: FeedbackRequest[] = [];

export function registerFeedbackPresenter(nextPresenter: FeedbackPresenter | null): () => void {
  presenter = nextPresenter;
  if (presenter) {
    while (pendingRequests.length) presenter(pendingRequests.shift()!);
  }
  return () => {
    if (presenter === nextPresenter) presenter = null;
  };
}

function present(request: FeedbackRequest): void {
  if (presenter) presenter(request);
  else pendingRequests.push(request);
}

export const feedback = {
  alert(title: string, message?: string, buttons: FeedbackButton[] = []): void {
    present({ kind: 'alert', title, message, buttons });
  },

  prompt(title: string, message: string | undefined, onSubmit: (value: string) => void, defaultValue = ''): void {
    present({ kind: 'prompt', title, message, defaultValue, onSubmit });
  },
};
