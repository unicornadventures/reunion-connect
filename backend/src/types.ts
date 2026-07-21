// School Entity
export interface School {
  id: number;
  name: string;
  location: string;
  created_at: Date;
  updated_at: Date;
}

// Class Entity
export interface ClassEntity {
  id: number;
  year: number;
  created_at: Date;
}

// User Entity - Auth only
export interface User {
  id: number;
  email: string;
  password: string;
  is_admin: boolean;
  created_at: Date;
  updated_at: Date;
}

// Profile Entity - User profile information
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
  avatar_color: string | null;
  created_at: Date;
  updated_at: Date;
}

// Comment Entity
export interface Comment {
  id: number;
  target_user_id: number;
  commenter_id: number;
  content: string;
  published: boolean;
  created_at: Date;
  updated_at: Date;
}

// Input type for user registration
export interface UserRegisterInput {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  class_id: number;
}