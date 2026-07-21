import api from './api';
import { User, Profile, School, Class, AuthResponse, CurrentUser, SlideshowPhoto } from './types';

// Auth endpoints
export const authAPI = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }),

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    return Promise.resolve();
  },

  register: (email: string, password: string, first_name: string, last_name: string, hash?: string) =>
    api.post('/auth/register', { email, password, first_name, last_name, hash }),

  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),

  resetPassword: (token: string, password: string) =>
    api.post('/auth/reset-password', { token, password }),

  getRegistrationLink: (hash: string) =>
    api.get(`/auth/registration-link/${hash}`),

  claimSearch: (first_name: string, last_name: string, class_id: number) =>
    api.post<{ matches: { id: number; first_name: string; last_name: string; maiden_name: string | null; class_year: number | null; school_name: string | null }[] }>(
      '/auth/claim-search', { first_name, last_name, class_id }
    ),

  claimAccount: (user_id: number, email: string, password: string) =>
    api.post<{ token: string; user: { user_id: number; email: string; is_admin: boolean; is_class_admin: boolean; profile: { first_name: string; last_name: string } | null } }>(
      '/auth/claim-account', { user_id, email, password }
    ),
};

// User endpoints
export const userAPI = {
  register: (email: string, password: string, first_name: string, last_name: string, class_id?: number) =>
    api.post('/auth/register', { email, password, first_name, last_name }),

  getUser: (userId: number) =>
    api.get<{ user: User; profile: Profile | null }>(`/users/${userId}`),

  updateProfile: (userId: number, data: Partial<Profile>) =>
    api.put(`/users/${userId}/profile`, data),

  getUserClass: (userId: number) =>
    api.get(`/users/${userId}/class`),

  getDirectory: (page = 1, pageSize = 20) =>
    api.get(`/users?page=${page}&pageSize=${pageSize}`),

  uploadPhoto: (userId: number, photoType: 'then' | 'now', requesterId?: number) =>
    api.post<{ presignedUrl: string }>(`/users/${userId}/photo/${photoType}`, undefined, {
      params: requesterId ? { requesterId } : undefined
    }),

  deletePhoto: (userId: number, photoType: 'then' | 'now', requesterId?: number) =>
    api.delete(`/users/${userId}/photo/${photoType}`, {
      params: requesterId ? { requesterId } : undefined
    }),
};

// School endpoints
export const schoolAPI = {
  getSchools: () => api.get<{ schools: School[] }>('/schools'),
  getSchool: (schoolId: number) => api.get<{ school: School }>(`/schools/${schoolId}`),
  getClasses: (schoolId: number) => api.get<{ classes: Class[] }>(`/schools/${schoolId}/classes`),
};

// Admin school endpoints
export const adminSchoolAPI = {
  getSchools: () => api.get<{ schools: School[] }>('/schools'),
  getSchool: (schoolId: number) => api.get<{ school: School }>(`/schools/${schoolId}`),
  createSchool: (name: string, location?: string, timezone?: string) =>
    api.post<{ school: School }>('/admin/schools', { name, location, timezone }),
  updateSchool: (schoolId: number, name: string, location?: string, timezone?: string) =>
    api.put<{ school: School }>(`/admin/schools/${schoolId}`, { name, location, timezone }),

  deleteSchool: (schoolId: number) =>
    api.delete(`/admin/schools/${schoolId}`),
};

// Class endpoints
export const classAPI = {
  getAllClasses: () => api.get<{ classes: Class[] }>('/classes'),
  getClass: (classId: number) => api.get<{ class: Class }>(`/classes/${classId}`),
  getClassMembers: (classId: number) =>
    api.get<{ members: (User & { profile: Profile | null })[] }>(`/classes/${classId}/members`),
  getPhotos: (classId: number, userId: number) =>
    api.get<{ photos: SlideshowPhoto[] }>(`/classes/${classId}/photos`, { params: { userId } }),
};

// Admin class endpoints
export const adminClassAPI = {
  getClasses: (schoolId: number) =>
    api.get<{ classes: Class[] }>(`/schools/${schoolId}/classes`),

  createClass: (schoolId: number, year: number) =>
    api.post<{ class: Class }>(`/admin/schools/${schoolId}/classes`, { year }),

  bulkLinkClasses: (schoolId: number, startYear: number) =>
    api.post<{ classes: { id: number; year: number; member_count: number }[] }>(
      `/admin/schools/${schoolId}/classes/bulk`,
      { startYear }
    ),

  getClassUsers: (classId: number) =>
    api.get(`/admin/classes/${classId}/users`),

  unlinkClass: (schoolId: number, classId: number) =>
    api.delete(`/admin/schools/${schoolId}/classes/${classId}`),

  createUser: (schoolId: number, classId: number, data: {
    first_name: string; last_name: string;
    original_first_name?: string; original_last_name?: string; email?: string;
  }) => api.post(`/admin/schools/${schoolId}/classes/${classId}/users`, data),

  importUsers: (schoolId: number, classId: number, users: {
    first_name: string; last_name: string;
    original_first_name?: string; original_last_name?: string; email?: string;
  }[]) => api.post<{ created: number; skipped: { index: number; name: string; reason: string }[] }>(
    `/admin/schools/${schoolId}/classes/${classId}/users/import`, { users }
  ),

  createRegistrationLink: (schoolId: number, classId: number) =>
    api.post('/admin/registration-links', { schoolId, classId }),
};

// Admin user endpoints
export const adminAPI = {
  getUsers: () => api.get<{ users: (User & { profile: Profile | null })[] }>('/admin/users'),

  updateUser: (userId: number, data: { is_class_admin?: boolean; class_id?: number }) =>
    api.put(`/admin/users/${userId}`, data),

  deleteUser: (userId: number) =>
    api.delete(`/admin/users/${userId}`),

  moveUserClass: (userId: number, classId: number) =>
    api.put(`/admin/users/${userId}/move-class`, { class_id: classId }),

  createPasswordLink: (userId: number) =>
    api.post<{ passwordSetupUrl: string; expiresAt: string }>(`/admin/users/${userId}/password-link`),
};

// Comment endpoints
export const commentAPI = {
  getComments: (userId: number) =>
    api.get(`/users/${userId}/comments`),

  getPendingComments: (userId: number) =>
    api.get(`/users/${userId}/comments/pending`),

  createComment: (targetUserId: number, content: string, commenterId: number) =>
    api.post(`/users/${targetUserId}/comments`, { content, commenterId }),

  updateComment: (commentId: number, data: { published?: boolean; content?: string; requesterId?: number }) =>
    api.put(`/comments/${commentId}`, data),

  deleteComment: (commentId: number, requesterId?: number) =>
    api.delete(`/comments/${commentId}`, {
      params: requesterId ? { requesterId } : undefined
    }),
};

// Gallery endpoints
export const galleryAPI = {
  list: (userId: number, requesterId: number) =>
    api.get(`/users/${userId}/gallery`, { params: { requesterId } }),

  upload: (userId: number, requesterId: number) =>
    api.post(`/users/${userId}/gallery`, { requesterId }),

  delete: (userId: number, photoId: number, requesterId: number) =>
    api.delete(`/users/${userId}/gallery/${photoId}`, { params: { requesterId } }),
};

// Event endpoints
export const eventAPI = {
  listEvents: (schoolId: number, classId: number) =>
    api.get(`/schools/${schoolId}/classes/${classId}/events`),

  getEvent: (eventId: number) =>
    api.get(`/events/${eventId}`),

  createEvent: (schoolId: number, classId: number, data: { title: string; description?: string; event_date: string; location?: string }) =>
    api.post(`/admin/schools/${schoolId}/classes/${classId}/events`, data),

  updateEvent: (eventId: number, data: { title?: string; description?: string; event_date?: string; location?: string }) =>
    api.put(`/events/${eventId}`, data),

  deleteEvent: (eventId: number) =>
    api.delete(`/events/${eventId}`),
};
