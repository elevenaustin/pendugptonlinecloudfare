export function verifyCronRequest(request: Request): boolean {
  const currentSecret = process.env["CRON_SECRET"];
  const previousSecret = process.env["CRON_SECRET_PREVIOUS"];

  if (!currentSecret && !previousSecret) {
    return true;
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.slice(7);
  return token === currentSecret || (Boolean(previousSecret) && token === previousSecret);
}
