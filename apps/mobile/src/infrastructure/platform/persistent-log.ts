import { File, Paths } from 'expo-file-system';

type LogLevel = 'INFO' | 'WARN' | 'ERROR';
type LogValue = boolean | number | string | null | undefined;

const LOG_FILE_NAME = 'still-alive-diagnostics.log';
const MAX_LOG_BYTES = 512 * 1024;
const MAX_DETAIL_LENGTH = 1_000;

export type LogDetails = Record<string, LogValue>;

export function writePersistentLog(level: LogLevel, event: string, details: LogDetails = {}): void {
  try {
    const file = ensureLogFile();
    const line = formatLogLine(level, event, details);
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
    });
    return;
  }
  writePersistentLog('ERROR', event, { ...details, errorType: typeof cause });
}

export function getPersistentLogFile(): File {
  return ensureLogFile();
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
    const safeValue = typeof value === 'string' ? value.slice(0, MAX_DETAIL_LENGTH) : value;
    return [[key, safeValue]];
  }));
  const serializedDetails = Object.keys(safeDetails).length > 0 ? ` ${JSON.stringify(safeDetails)}` : '';
  return `${new Date().toISOString()} ${level} ${safeEvent}${serializedDetails}\n`;
}
