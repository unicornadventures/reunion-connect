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

// School endpoints (public read-only)
export const schoolAPI = {
  getSchools: () => api.get<{ schools: School[] }>('/schools'),

  getSchool: (schoolId: number) => api.get<{ school: School }>(`/schools/${schoolId}`),
};

// Admin school endpoints (requires admin token)
export const adminSchoolAPI = {
  getSchools: (token: string) => api.get<{ schools: School[] }>('/admin/schools', {
    headers: { Authorization: `Bearer ${token}` }
  }),

  getSchool: (schoolId: number, token: string) => api.get<{ school: School }>(`/admin/schools/${schoolId}`, {
    headers: { Authorization: `Bearer ${token}` }
  }),

  createSchool: (name: string, token: string, location?: string) =>
    api.post<{ school: School }>('/admin/schools', { name, location }, {
      headers: { Authorization: `Bearer ${token}` }
    }),

  updateSchool: (schoolId: number, name: string, token: string, location?: string) =>
    api.put<{ school: School }>(`/admin/schools/${schoolId}`, { name, location }, {
      headers: { Authorization: `Bearer ${token}` }
    }),

  deleteSchool: (schoolId: number, token: string, cascadeUsers?: boolean) =>
    api.delete(`/admin/schools/${schoolId}${cascadeUsers ? '?cascadeUsers=true' : ''}`, {
      headers: { Authorization: `Bearer ${token}` }
    }),
};

// Class endpoints (public read-only)
export const classAPI = {
  getClasses: () => api.get<{ classes: Class[] }>('/classes'),

  getClass: (classId: number) => api.get<{ class: Class }>(`/classes/${classId}`),

  getClassMembers: (classId: number) =>
    api.get<{ members: (User & { profile: Profile | null })[] }>(`/classes/${classId}/members`),
};

// Admin class endpoints (requires admin token)
export const adminClassAPI = {
  getClasses: (token: string) => api.get<{ classes: Class[] }>('/admin/classes', {
    headers: { Authorization: `Bearer ${token}` }
  }),

  getClass: (classId: number, token: string) => api.get<{ class: Class }>(`/admin/classes/${classId}`, {
    headers: { Authorization: `Bearer ${token}` }
  }),

  createClass: (school_id: number, year: number, token: string) =>
    api.post<{ class: Class }>('/admin/classes', { school_id, year }, {
      headers: { Authorization: `Bearer ${token}` }
    }),

  updateClass: (classId: number, school_id: number, year: number, token: string) =>
    api.put<{ class: Class }>(`/admin/classes/${classId}`, { school_id, year }, {
      headers: { Authorization: `Bearer ${token}` }
    }),

  deleteClass: (classId: number, token: string) =>
    api.delete(`/admin/classes/${classId}`, {
      headers: { Authorization: `Bearer ${token}` }
    }),
};

// Admin endpoints
export const adminAPI = {
  seedAdmin: (password: string) =>
    api.post('/admin/seed', { password }),

  getUsers: () => api.get<{ users: (User & { profile: Profile | null })[] }>('/admin/users'),
};
