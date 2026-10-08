/**
 * Application Error Reporting
 */
export function reportAppError(error: unknown, context: Record<string, unknown> = {}) {
  if (process.env.NODE_ENV !== "production") {
    console.error("Runtime error caught:", error, context);
  }
}

export const reportLovableError = reportAppError;
