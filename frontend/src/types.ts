// Frontend types matching backend API responses

export interface User {
  id: number;
  email: string;
  is_admin: boolean;
  is_class_admin?: boolean;
  created_at: string;
}

export interface Profile {
  id: number;
  user_id: number;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  former_first_name: string | null;
  former_last_name: string | null;
  bio: string | null;
  then_photo_url: string | null;
  now_photo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  id: number;
  email: string;
  is_admin: boolean;
  profile: Profile | null;
  token: string;
}

export interface School {
  id: number;
  name: string;
  location: string | null;
  created_at: string;
  updated_at: string;
}

export interface Class {
  id: number;
  school_id: number;
  school_name: string;
  year: number;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: number;
  target_user_id: number;
  commenter_id: number;
  content: string;
  published: boolean;
  created_at: string;
  updated_at: string;
  first_name?: string | null;
  last_name?: string | null;
}

export interface CurrentUser extends User {
  profile: Profile | null;
}
