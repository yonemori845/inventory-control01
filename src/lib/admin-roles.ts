const ROLES = ["admin", "user"] as const;

export type AppRole = (typeof ROLES)[number];

export function isAppRole(s: string): s is AppRole {
  return (ROLES as readonly string[]).includes(s);
}
