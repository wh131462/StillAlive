import { writePersistentLog } from '../infrastructure/platform/persistent-log';

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
    const level = /失败|错误|无法|不可|异常|不存在|不足|未开启|不支持/u.test(title) ? 'ERROR' : 'INFO';
    writePersistentLog(level, 'feedback.alert.presented', {
      title,
      message,
      buttons: buttons.map(({ text, style }) => ({ text, style })),
    });
    present({
      kind: 'alert',
      title,
      message,
      buttons: buttons.map((button) => ({
        ...button,
        onPress: button.onPress ? () => {
          writePersistentLog('INFO', 'feedback.alert.action', { title, action: button.text, style: button.style });
          button.onPress?.();
        } : undefined,
      })),
    });
  },

  prompt(title: string, message: string | undefined, onSubmit: (value: string) => void, defaultValue = ''): void {
    writePersistentLog('INFO', 'feedback.prompt.presented', { title, message, defaultValue });
    present({
      kind: 'prompt',
      title,
      message,
      defaultValue,
      onSubmit: (value) => {
        writePersistentLog('INFO', 'feedback.prompt.submitted', { title, value });
        onSubmit(value);
      },
    });
  },
};
