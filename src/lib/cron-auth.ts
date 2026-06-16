export function isAuthorizedCron(
  headers: { authorization?: string | null },
  env: Record<string, string | undefined> = process.env,
): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) return false;
  return headers.authorization === `Bearer ${secret}`;
}
