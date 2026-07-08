export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  hwid: string | null;
  banned: boolean;
  created_at: string;
  last_login: string | null;
  sub_until: string | null;
}

export interface Profile extends User {
  sub_until: string | null;
}

export interface Stats {
  total_users: number;
  active_subs: number;
  total_keys_used: number;
  users_today: number;
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: string;
  hwid: string | null;
  banned: boolean;
  created_at: string;
}

export interface AdminUsersResponse {
  users: AdminUser[];
  total: number;
  limit: number;
}

export interface JarInfo {
  exists: boolean;
  size?: number;
}

export interface IconData {
  icon: string | null;
  mime_type?: string;
}
