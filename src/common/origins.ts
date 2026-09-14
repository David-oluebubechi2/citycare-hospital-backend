export function getAllowedOrigins(): string[] {
  const raw = process.env.FRONTEND_URL || 'http://localhost:5173';
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export function corsOrigin(origin: string | undefined): boolean | string {
  const allowed = getAllowedOrigins();
  if (!origin || !allowed.length) return allowed.includes(origin as string);
  return allowed.includes(origin);
}