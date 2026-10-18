/** Shapes returned by the MAXIMUS authentication and profile endpoints. */

/** The public representation of a user account. Never contains secrets. */
export interface AuthUser {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
}

export interface RegisterPayload {
  display_name: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ProfileUpdatePayload {
  display_name?: string;
}
