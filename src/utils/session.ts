export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function isValidSessionId(sessionId: string): boolean {
  return sessionId.startsWith('session_') && sessionId.length > 10;
}