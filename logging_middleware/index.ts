
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export type LogStack = 'backend' | 'frontend';

export interface LogEntry {
  stack: LogStack;
  level: LogLevel;
  packageName: string;
  message: string;
  timestamp: string;
}

const TEST_SERVER_URL = 'http://20.207.122.201/evaluation-service/logs';

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
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiJyaXBwbGVza2FydGhpQGdtYWlsLmNvbSIsImV4cCI6MTc3ODA2MjI2MiwiaWF0IjoxNzc4MDYxMzYyLCJpc3MiOiJBZmZvcmQgTWVkaWNhbCBUZWNobm9sb2dpZXMgUHJpdmF0ZSBMaW1pdGVkIiwianRpIjoiYTdkZmUzNDItM2E0YS00M2NjLWE5ODItYjk3ZWJhMGYwZGJkIiwibG9jYWxlIjoiZW4tSU4iLCJuYW1lIjoia2FydGhpa2V5YW4gcyIsInN1YiI6ImU0YjE4NzQ4LWFjYzktNDBlYy05NzIyLTAyZTZhODJmZTlhNiJ9LCJlbWFpbCI6InJpcHBsZXNrYXJ0aGlAZ21haWwuY29tIiwibmFtZSI6ImthcnRoaWtleWFuIHMiLCJyb2xsTm8iOiJjaC5zYy51NGNzZTIzMjIzIiwiYWNjZXNzQ29kZSI6IlBUQk1tUSIsImNsaWVudElEIjoiZTRiMTg3NDgtYWNjOS00MGVjLTk3MjItMDJlNmE4MmZlOWE2IiwiY2xpZW50U2VjcmV0IjoiVUVGU3VwalRaVGh4elNWdyJ9.Agw4mXMJKqEkEfLO5nuVYJTVeRywgf3E31UB6twweeI'
      },
      body: JSON.stringify(logEntry)
    });
  } catch (error) {

  }
}

export default { Log };
