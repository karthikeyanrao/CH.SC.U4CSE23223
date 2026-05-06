
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export type LogStack = 'backend' | 'frontend';

export interface LogEntry {
  stack: LogStack;
  level: LogLevel;
  packageName: string;
  message: string;
  timestamp: string;
}

const TEST_SERVER_URL = 'http://20.127.122.201/evaluation-service/logs';

export async function Log(
  stack: LogStack,
  level: LogLevel,
  packageName: string,
  message: string
): Promise<void> {
  const logEntry: LogEntry = {
    stack: stack.toLowerCase() as LogStack,
    level: level.toLowerCase() as LogLevel,
    packageName: packageName.toLowerCase(),
    message: message,
    timestamp: new Date().toISOString()
  };
  console.log(`[${logEntry.timestamp}] [${logEntry.level}] [${logEntry.packageName}]: ${message}`);

  try {
    await fetch(TEST_SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer PRE_AUTH_TOKEN'
      },
      body: JSON.stringify(logEntry)
    });
  } catch (error) {
   
  }
}

export default { Log };
