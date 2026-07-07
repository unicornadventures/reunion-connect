import { APIGatewayProxyResult } from 'aws-lambda';
import { pulseHandler } from './src/lambda/pulse.js';
import { loginHandler, registerHandler, getRegistrationLinkHandler, forgotPasswordHandler, resetPasswordHandler } from './src/lambda/auth.js';
import { listUsersHandler, getProfileHandler, updateProfileHandler, getUserClassHandler } from './src/lambda/users.js';
import { createCommentHandler, getCommentsHandler, getPendingCommentsHandler, updateCommentHandler, deleteCommentHandler } from './src/lambda/comments.js';
import { getAdminUsersHandler, updateUserClassAdminHandler, deleteUserHandler, getClassUsersHandler, createUserHandler, importUsersHandler, createRegistrationLinkHandler } from './src/lambda/admin.js';
import { listSchoolsHandler, getSchoolHandler, createSchoolHandler, deleteSchoolHandler } from './src/lambda/schools.js';
import { listAllClassesHandler, listClassesHandler, getClassHandler, bulkLinkClassesHandler, createClassHandler, deleteClassHandler, getClassMembersHandler, getClassDirectoryHandler } from './src/lambda/classes.js';
import { listEventsHandler, getEventHandler, createEventHandler, updateEventHandler, deleteEventHandler } from './src/lambda/events.js';
import { uploadPhotoHandler, deletePhotoHandler, getPhotoPresignedUrlHandler } from './src/lambda/photos.js';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

// Match a path pattern against an actual path; return extracted params or null.
function matchPath(pattern: string, path: string): Record<string, string> | null {
  const names: string[] = [];
  const regex = new RegExp(
    '^' + pattern.replace(/:[a-zA-Z]+/g, m => { names.push(m.slice(1)); return '([^/]+)'; }).replace(/\//g, '\\/') + '$'
  );
  const m = path.match(regex);
  if (!m) return null;
  const params: Record<string, string> = {};
  names.forEach((n, i) => { params[n] = m[i + 1]; });
  return params;
}

// Normalise HTTP API v2 events to the v1 shape our handlers expect.
function normalise(event: any, pathParameters: Record<string, string> | null = null): any {
  return {
    ...event,
    path: event.rawPath || event.path,
    httpMethod: (event.requestContext?.http?.method || event.httpMethod || 'GET').toUpperCase(),
    resource: event.rawPath || event.path,
    pathParameters: pathParameters ?? event.pathParameters ?? null,
    queryStringParameters: event.queryStringParameters ?? null,
    headers: event.headers ?? {},
  };
}

export const handler = async (event: any): Promise<APIGatewayProxyResult> => {
  const path = event.rawPath || event.path || '/';
  const method = (event.requestContext?.http?.method || event.httpMethod || 'GET').toUpperCase();

  if (method === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  let p: Record<string, string> | null;

  if (path === '/pulse' && method === 'GET') return pulseHandler(normalise(event));

  // Auth
  if (path === '/api/auth/login' && method === 'POST') return loginHandler(normalise(event));
  if (path === '/api/auth/register' && method === 'POST') return registerHandler(normalise(event));
  if ((p = matchPath('/api/auth/registration-link/:hash', path)) && method === 'GET') return getRegistrationLinkHandler(normalise(event, p));
  if (path === '/api/auth/forgot-password' && method === 'POST') return forgotPasswordHandler(normalise(event));
  if (path === '/api/auth/reset-password' && method === 'POST') return resetPasswordHandler(normalise(event));

  // Users
  if (path === '/api/users' && method === 'GET') return listUsersHandler(normalise(event));
  if ((p = matchPath('/api/users/:userId/profile', path)) && method === 'PUT') return updateProfileHandler(normalise(event, p));
  if ((p = matchPath('/api/users/:userId/class', path)) && method === 'GET') return getUserClassHandler(normalise(event, p));
  if ((p = matchPath('/api/users/:userId', path)) && method === 'GET') return getProfileHandler(normalise(event, p));

  // Comments — most-specific paths first
  if ((p = matchPath('/api/users/:targetUserId/comments/pending', path)) && method === 'GET') return getPendingCommentsHandler(normalise(event, p));
  if ((p = matchPath('/api/users/:targetUserId/comments', path)) && method === 'POST') return createCommentHandler(normalise(event, p));
  if ((p = matchPath('/api/users/:targetUserId/comments', path)) && method === 'GET') return getCommentsHandler(normalise(event, p));
  if ((p = matchPath('/api/comments/:commentId', path)) && method === 'PUT') return updateCommentHandler(normalise(event, p));
  if ((p = matchPath('/api/comments/:commentId', path)) && method === 'DELETE') return deleteCommentHandler(normalise(event, p));

  // Admin — import before create (more specific path first)
  if (path === '/api/admin/users' && method === 'GET') return getAdminUsersHandler(normalise(event));
  if ((p = matchPath('/api/admin/users/:userId', path)) && method === 'PUT') return updateUserClassAdminHandler(normalise(event, p));
  if ((p = matchPath('/api/admin/users/:userId', path)) && method === 'DELETE') return deleteUserHandler(normalise(event, p));
  if ((p = matchPath('/api/admin/classes/:classId/users', path)) && method === 'GET') return getClassUsersHandler(normalise(event, p));
  if ((p = matchPath('/api/admin/schools/:schoolId/classes/:classId/users/import', path)) && method === 'POST') return importUsersHandler(normalise(event, p));
  if ((p = matchPath('/api/admin/schools/:schoolId/classes/:classId/users', path)) && method === 'POST') return createUserHandler(normalise(event, p));
  if (path === '/api/admin/registration-links' && method === 'POST') return createRegistrationLinkHandler(normalise(event));

  // Schools
  if (path === '/api/schools' && method === 'GET') return listSchoolsHandler(normalise(event));
  if (path === '/api/admin/schools' && method === 'POST') return createSchoolHandler(normalise(event));
  if ((p = matchPath('/api/admin/schools/:schoolId', path)) && method === 'DELETE') return deleteSchoolHandler(normalise(event, p));
  if ((p = matchPath('/api/schools/:schoolId', path)) && method === 'GET') return getSchoolHandler(normalise(event, p));

  // Classes — more specific paths first
  if (path === '/api/classes' && method === 'GET') return listAllClassesHandler(normalise(event));
  if ((p = matchPath('/api/admin/schools/:schoolId/classes/bulk', path)) && method === 'POST') return bulkLinkClassesHandler(normalise(event, p));
  if ((p = matchPath('/api/admin/schools/:schoolId/classes/:classId', path)) && method === 'DELETE') return deleteClassHandler(normalise(event, p));
  if ((p = matchPath('/api/admin/schools/:schoolId/classes', path)) && method === 'POST') return createClassHandler(normalise(event, p));
  if ((p = matchPath('/api/schools/:schoolId/classes', path)) && method === 'GET') return listClassesHandler(normalise(event, p));
  if ((p = matchPath('/api/classes/:classId/members', path)) && method === 'GET') return getClassMembersHandler(normalise(event, p));
  if ((p = matchPath('/api/classes/:classId/directory', path)) && method === 'GET') return getClassDirectoryHandler(normalise(event, p));
  if ((p = matchPath('/api/classes/:classId', path)) && method === 'GET') return getClassHandler(normalise(event, p));

  // Events
  if ((p = matchPath('/api/schools/:schoolId/classes/:classId/events', path)) && method === 'GET') return listEventsHandler(normalise(event, p));
  if ((p = matchPath('/api/admin/schools/:schoolId/classes/:classId/events', path)) && method === 'POST') return createEventHandler(normalise(event, p));
  if ((p = matchPath('/api/events/:eventId', path)) && method === 'GET') return getEventHandler(normalise(event, p));
  if ((p = matchPath('/api/events/:eventId', path)) && method === 'PUT') return updateEventHandler(normalise(event, p));
  if ((p = matchPath('/api/events/:eventId', path)) && method === 'DELETE') return deleteEventHandler(normalise(event, p));

  // Photos
  if ((p = matchPath('/api/users/:userId/photo/:photoType', path)) && method === 'POST') return uploadPhotoHandler(normalise(event, p));
  if ((p = matchPath('/api/users/:userId/photo/:photoType', path)) && method === 'DELETE') return deletePhotoHandler(normalise(event, p));
  if ((p = matchPath('/api/photos/:photoKey/presigned', path)) && method === 'GET') return getPhotoPresignedUrlHandler(normalise(event, p));

  return { statusCode: 404, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Not found' }) };
};
