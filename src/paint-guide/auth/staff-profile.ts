export type StaffRole = "owner" | "supervisor";

export type StaffProfile = {
  user_id: string;
  display_name: string | null;
  role: StaffRole;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type StaffAuthState =
  | "loading"
  | "unauthenticated"
  | "unauthorized"
  | "inactive"
  | "authorized_owner"
  | "authorized_supervisor";

function isStaffRole(value: unknown): value is StaffRole {
  return value === "owner" || value === "supervisor";
}

export function parseStaffProfile(value: unknown): StaffProfile | null {
  if (!value || typeof value !== "object") return null;

  const profile = value as Record<string, unknown>;

  if (
    typeof profile.user_id !== "string" ||
    (profile.display_name !== null && typeof profile.display_name !== "string") ||
    !isStaffRole(profile.role) ||
    typeof profile.active !== "boolean" ||
    typeof profile.created_at !== "string" ||
    typeof profile.updated_at !== "string"
  ) {
    return null;
  }

  return {
    user_id: profile.user_id,
    display_name: profile.display_name,
    role: profile.role,
    active: profile.active,
    created_at: profile.created_at,
    updated_at: profile.updated_at,
  };
}
