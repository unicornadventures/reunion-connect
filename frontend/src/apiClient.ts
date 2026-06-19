import api from './api';
import { User, Profile, School, Class, AuthResponse, CurrentUser } from './types';

// Auth endpoints
export const authAPI = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }),

  logout: () => api.post('/auth/logout'),

  getCurrentUser: () => api.get<{ user: CurrentUser }>('/auth/me'),
};

// User endpoints
export const userAPI = {
  register: (
    email: string,
    password: string,
    first_name: string,
    last_name: string,
    class_id: number
  ) =>
    api.post<{ user: User }>('/users/register', {
      email,
      password,
      first_name,
      last_name,
      class_id,
    }),

  getUser: (userId: number) =>
    api.get<{ user: User; profile: Profile | null }>(`/users/${userId}`),

  uploadPhotoPresignedUrl: (userId: number, photoType: 'then' | 'now', fileName: string) =>
    api.post<{ presignedUrl: string }>(`/users/${userId}/photo/upload/${photoType}`, { fileName }),

  updatePhoto: (userId: number, photoType: 'then' | 'now', photoUrl: string) =>
    api.put<{ profile: Profile }>(`/users/${userId}/photo/${photoType}`, { photoUrl }),
};

// School endpoints
export const schoolAPI = {
  getSchools: () => api.get<{ schools: School[] }>('/schools'),

  getSchool: (schoolId: number) => api.get<{ school: School }>(`/schools/${schoolId}`),

  createSchool: (name: string, location?: string) =>
    api.post<{ school: School }>('/schools', { name, location }),
};

// Class endpoints
export const classAPI = {
  getClasses: () => api.get<{ classes: Class[] }>('/classes'),

  getClass: (classId: number) => api.get<{ class: Class }>(`/classes/${classId}`),

  createClass: (school_id: number, year: number) =>
    api.post<{ class: Class }>('/classes', { school_id, year }),

  getClassMembers: (classId: number) =>
    api.get<{ members: (User & { profile: Profile | null })[] }>(`/classes/${classId}/members`),
};

// Admin endpoints
export const adminAPI = {
  seedAdmin: (password: string) =>
    api.post('/admin/seed', { password }),

  getUsers: () => api.get<{ users: (User & { profile: Profile | null })[] }>('/admin/users'),
};
