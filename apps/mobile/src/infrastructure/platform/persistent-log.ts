import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

type LogLevel = 'INFO' | 'WARN' | 'ERROR';
type LogValue = unknown;

const LOG_FILE_NAME = 'still-alive-diagnostics.log';
const MAX_LOG_BYTES = 512 * 1024;
const MAX_DETAIL_LENGTH = 8_000;
let sequence = 0;
let globalErrorLoggingInstalled = false;

export type LogDetails = Record<string, LogValue>;

export function writePersistentLog(level: LogLevel, event: string, details: LogDetails = {}): void {
  try {
    const file = ensureLogFile();
    const line = formatLogLine(level, event, { ...runtimeDetails(), ...details });
    if (file.size + line.length * 4 > MAX_LOG_BYTES) {
      file.write(`${formatLogLine('INFO', 'log.rotated', { maxBytes: MAX_LOG_BYTES })}`);
    }
    file.write(line, { append: true });
  } catch {
    // Logging must never interrupt the application flow.
  }
}

export function writePersistentError(event: string, cause: unknown, details: LogDetails = {}): void {
  if (cause instanceof Error) {
    writePersistentLog('ERROR', event, {
      ...details,
      errorName: cause.name || 'Error',
      errorMessage: cause.message,
      errorStack: cause.stack,
      errorCause: cause.cause,
    });
    return;
  }
  writePersistentLog('ERROR', event, { ...details, errorType: typeof cause, errorValue: cause });
}

/** 安装一次全局异常兜底，避免 JS 崩溃和未处理异步错误完全没有现场。 */
export function installGlobalErrorLogging(): void {
  if (globalErrorLoggingInstalled) return;
  globalErrorLoggingInstalled = true;
  const errorUtils = (globalThis as typeof globalThis & {
    ErrorUtils?: {
      getGlobalHandler?: () => (error: unknown, isFatal?: boolean) => void;
      setGlobalHandler?: (handler: (error: unknown, isFatal?: boolean) => void) => void;
    };
  }).ErrorUtils;
  const previousHandler = errorUtils?.getGlobalHandler?.();
  errorUtils?.setGlobalHandler?.((error, isFatal) => {
    writePersistentError('app.unhandled.error', error, { fatal: Boolean(isFatal) });
    previousHandler?.(error, isFatal);
  });

  const globalWithRejection = globalThis as typeof globalThis & {
    onunhandledrejection?: ((event: { reason?: unknown }) => void) | null;
  };
  const previousRejectionHandler = globalWithRejection.onunhandledrejection;
  globalWithRejection.onunhandledrejection = (event) => {
    writePersistentError('app.unhandled.rejection', event?.reason, { source: 'onunhandledrejection' });
    previousRejectionHandler?.(event);
  };
}

export function getPersistentLogFile(): File {
  return ensureLogFile();
}

export function clearPersistentLog(): void {
  try {
    const file = new File(Paths.document, LOG_FILE_NAME);
    if (file.exists) file.delete();
  } catch {
    // 清理诊断日志失败不应影响应用流程。
  }
}

function ensureLogFile(): File {
  const file = new File(Paths.document, LOG_FILE_NAME);
  if (!file.exists) file.create({ intermediates: true });
  return file;
}

function formatLogLine(level: LogLevel, event: string, details: LogDetails): string {
  const safeEvent = event.replace(/[\r\n]+/g, ' ').slice(0, 128);
  const safeDetails = Object.fromEntries(Object.entries(details).flatMap(([key, value]) => {
    if (value === undefined) return [];
    return [[key, normalizeLogValue(value)]];
  }));
  const serializedDetails = Object.keys(safeDetails).length > 0 ? ` ${JSON.stringify(safeDetails)}` : '';
  sequence += 1;
  return `${new Date().toISOString()} ${level} #${sequence} ${safeEvent}${serializedDetails}\n`;
}

function runtimeDetails(): LogDetails {
  return {
    platform: Platform.OS,
    appVersion: Constants.expoConfig?.version ?? Constants.manifest?.version,
    buildVersion: Constants.expoConfig?.android?.versionCode ?? Constants.nativeBuildVersion,
    development: __DEV__,
  };
}

function normalizeLogValue(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack, cause: normalizeLogValue(value.cause) };
  }
  if (typeof value === 'string') return value.slice(0, MAX_DETAIL_LENGTH);
  try {
    JSON.stringify(value);
    return value;
  } catch {
    return String(value).slice(0, MAX_DETAIL_LENGTH);
  }
}
