import { APIGatewayProxyEvent } from 'aws-lambda';

// ---- Mock DB ----------------------------------------------------------

type MockUser = { id: number; email: string | null; is_admin?: boolean; is_class_admin?: boolean; is_deceased?: boolean };
type MockProfile = {
  user_id: number;
  first_name?: string;
  last_name?: string;
  former_first_name?: string | null;
  former_last_name?: string | null;
  then_photo_url?: string | null;
  now_photo_url?: string | null;
};
type MockClassUser = { user_id: number; class_id: number };

function freshMockDb() {
  return {
    users: [
      { id: 1, email: 'super@x.com', is_admin: true, is_class_admin: false },
      { id: 2, email: 'classadmin@x.com', is_admin: false, is_class_admin: true }, // belongs to class 10
      { id: 3, email: 'user3@x.com', is_admin: false, is_class_admin: false, is_deceased: false }, // class 10
      { id: 4, email: 'user4@x.com', is_admin: false, is_class_admin: false, is_deceased: false }, // class 20
      { id: 5, email: null, is_admin: false, is_class_admin: false }, // no email on file
      { id: 6, email: 'dup@x.com', is_admin: false, is_class_admin: false },
    ] as MockUser[],
    profiles: [
      { user_id: 3, first_name: 'Sam', last_name: 'Three', former_first_name: null, former_last_name: null, then_photo_url: 'photos/3-then.jpg', now_photo_url: null },
      { user_id: 4, first_name: 'Pat', last_name: 'Four', former_first_name: null, former_last_name: null, then_photo_url: null, now_photo_url: null },
    ] as MockProfile[],
    classUsers: [
      { user_id: 2, class_id: 10 },
      { user_id: 3, class_id: 10 },
      { user_id: 4, class_id: 20 },
    ] as MockClassUser[],
    classes: [
      { id: 10, year: 2010 },
      { id: 20, year: 2020 },
    ],
    classSchoolLinks: [
      { class_id: 10, school_id: 100 },
    ],
    passwordResetTokens: [] as { user_id: number; token_hash: string }[],
    nextUserId: 1000,
  };
}

let mockDb = freshMockDb();

const mockSend = jest.fn().mockResolvedValue({});
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  DeleteObjectCommand: jest.fn().mockImplementation((params) => params)
}));

jest.mock('../../db', () => ({
  query: jest.fn(async (sql: string, params?: any[]) => {
    // ---- getAdminUsersHandler ----
    if (sql.includes('FROM users u') && sql.includes('LEFT JOIN profiles p ON u.id = p.user_id') && sql.includes('ORDER BY u.created_at DESC')) {
      return {
        rows: mockDb.users.map(u => ({
          id: u.id,
          email: u.email,
          is_admin: u.is_admin,
          is_class_admin: u.is_class_admin,
          created_at: new Date(),
          first_name: mockDb.profiles.find(p => p.user_id === u.id)?.first_name,
          last_name: mockDb.profiles.find(p => p.user_id === u.id)?.last_name
        }))
      };
    }

    // ---- shared existence check: SELECT id FROM users WHERE id ----
    if (sql.includes('SELECT id FROM users WHERE id')) {
      const userId = Number(params?.[0]);
      const user = mockDb.users.find(u => u.id === userId);
      return { rows: user ? [{ id: user.id }] : [] };
    }

    // ---- canManageUser same-class check ----
    if (sql.includes('FROM class_user cu1') && sql.includes('cu2.class_id')) {
      const [authUserId, targetUserId] = params!.map(Number);
      const authClasses = mockDb.classUsers.filter(cu => cu.user_id === authUserId).map(cu => cu.class_id);
      const match = mockDb.classUsers.some(cu => cu.user_id === targetUserId && authClasses.includes(cu.class_id));
      return { rows: match ? [{ class_id: authClasses[0] }] : [] };
    }

    // ---- deleteUserHandler: profile photo lookup ----
    if (sql.includes('SELECT then_photo_url, now_photo_url FROM profiles WHERE user_id')) {
      const userId = Number(params?.[0]);
      const profile = mockDb.profiles.find(p => p.user_id === userId);
      return { rows: profile ? [{ then_photo_url: profile.then_photo_url, now_photo_url: profile.now_photo_url }] : [] };
    }

    // ---- deleteUserHandler: delete ----
    if (sql.includes('DELETE FROM users WHERE id')) {
      const userId = Number(params?.[0]);
      mockDb.users = mockDb.users.filter(u => u.id !== userId);
      return { rows: [] };
    }

    // ---- getClassUsersHandler: count ----
    if (sql.includes('SELECT COUNT(*) as count FROM class_user cu')) {
      const classId = Number(params?.[0]);
      let members = mockDb.classUsers.filter(cu => cu.class_id === classId);
      if (sql.includes('ILIKE') && params?.[1]) {
        const term = String(params[1]).replace(/%/g, '').toLowerCase();
        members = members.filter(cu => {
          const profile = mockDb.profiles.find(p => p.user_id === cu.user_id);
          return profile?.last_name?.toLowerCase().startsWith(term);
        });
      }
      return { rows: [{ count: members.length.toString() }] };
    }

    // ---- getClassUsersHandler: paginated results ----
    if (sql.includes('SELECT u.id, u.email, u.is_deceased')) {
      const classId = Number(params?.[0]);
      let members = mockDb.classUsers
        .filter(cu => cu.class_id === classId)
        .map(cu => mockDb.users.find(u => u.id === cu.user_id))
        .filter(Boolean) as MockUser[];

      if (sql.includes('ILIKE') && params?.[1]) {
        const term = String(params[1]).replace(/%/g, '').toLowerCase();
        members = members.filter(u => mockDb.profiles.find(p => p.user_id === u.id)?.last_name?.toLowerCase().startsWith(term));
      }

      members.sort((a, b) => {
        const pa = mockDb.profiles.find(p => p.user_id === a.id);
        const pb = mockDb.profiles.find(p => p.user_id === b.id);
        return (pa?.last_name || '').localeCompare(pb?.last_name || '');
      });

      const offset = Number(params?.[params.length - 1]) || 0;
      const limit = Number(params?.[params.length - 2]) || members.length;
      members = members.slice(offset, offset + limit);

      return {
        rows: members.map(u => {
          const p = mockDb.profiles.find(pr => pr.user_id === u.id);
          return {
            id: u.id, email: u.email, is_deceased: u.is_deceased,
            first_name: p?.first_name, last_name: p?.last_name,
            former_first_name: p?.former_first_name, former_last_name: p?.former_last_name
          };
        })
      };
    }

    // ---- updateUserClassAdminHandler ----
    if (sql.includes('SELECT id, is_class_admin FROM users WHERE id')) {
      const userId = Number(params?.[0]);
      const user = mockDb.users.find(u => u.id === userId);
      return { rows: user ? [{ id: user.id, is_class_admin: user.is_class_admin }] : [] };
    }
    if (sql.includes('UPDATE users SET is_class_admin')) {
      const [is_class_admin, userId] = params!;
      const user = mockDb.users.find(u => u.id === Number(userId));
      if (!user) return { rows: [] };
      user.is_class_admin = is_class_admin;
      return { rows: [{ id: user.id, email: user.email, is_admin: user.is_admin, is_class_admin: user.is_class_admin }] };
    }

    // ---- updateUserProfileHandler ----
    if (sql.includes('UPDATE users SET is_deceased')) {
      const [is_deceased, userId] = params!;
      const user = mockDb.users.find(u => u.id === Number(userId));
      if (!user) return { rows: [] };
      user.is_deceased = is_deceased;
      return { rows: [{ id: user.id, email: user.email, is_deceased: user.is_deceased }] };
    }
    if (sql.includes('UPDATE profiles SET first_name')) {
      const [first_name, last_name, former_first_name, former_last_name, userId] = params!;
      let profile = mockDb.profiles.find(p => p.user_id === Number(userId));
      if (!profile) {
        profile = { user_id: Number(userId) };
        mockDb.profiles.push(profile);
      }
      profile.first_name = first_name;
      profile.last_name = last_name;
      profile.former_first_name = former_first_name;
      profile.former_last_name = former_last_name;
      return { rows: [] };
    }

    // ---- createUserHandler / importUsersHandler ----
    if (sql.includes('SELECT id FROM users WHERE email')) {
      const email = params?.[0];
      const user = mockDb.users.find(u => u.email === email);
      return { rows: user ? [{ id: user.id }] : [] };
    }
    if (sql.includes('INSERT INTO users (email, password, is_deceased)')) {
      const [email, , is_deceased] = params!;
      const id = mockDb.nextUserId++;
      mockDb.users.push({ id, email, is_deceased });
      if (sql.includes('RETURNING id, email, is_deceased')) {
        return { rows: [{ id, email, is_deceased }] };
      }
      return { rows: [{ id }] };
    }
    if (sql.includes('INSERT INTO profiles (user_id, first_name, last_name, former_first_name, former_last_name)')) {
      const [user_id, first_name, last_name, former_first_name, former_last_name] = params!;
      mockDb.profiles.push({ user_id, first_name, last_name, former_first_name, former_last_name });
      return { rows: [] };
    }
    if (sql.includes('INSERT INTO class_user (class_id, user_id, school_id)')) {
      const [class_id, user_id] = params!.map(Number);
      mockDb.classUsers.push({ user_id, class_id });
      return { rows: [] };
    }

    // ---- createRegistrationLinkHandler ----
    if (sql.includes('FROM classes c') && sql.includes('JOIN class_school cs')) {
      const [classId, schoolId] = params!.map(Number);
      const cls = mockDb.classes.find(c => c.id === classId);
      const linked = mockDb.classSchoolLinks.some(l => l.class_id === classId && l.school_id === schoolId);
      return { rows: cls && linked ? [{ id: cls.id, year: cls.year }] : [] };
    }

    // ---- createPasswordLinkHandler ----
    if (sql.includes('SELECT id, email FROM users WHERE id')) {
      const userId = Number(params?.[0]);
      const user = mockDb.users.find(u => u.id === userId);
      return { rows: user ? [{ id: user.id, email: user.email }] : [] };
    }
    if (sql.includes('DELETE FROM password_reset_tokens WHERE user_id')) {
      const userId = Number(params?.[0]);
      mockDb.passwordResetTokens = mockDb.passwordResetTokens.filter(t => t.user_id !== userId);
      return { rows: [] };
    }
    if (sql.includes('INSERT INTO password_reset_tokens')) {
      const [user_id, token_hash] = params!;
      mockDb.passwordResetTokens.push({ user_id: Number(user_id), token_hash });
      return { rows: [] };
    }

    // ---- moveUserClassHandler ----
    if (sql.includes('SELECT id FROM classes WHERE id')) {
      const classId = Number(params?.[0]);
      const cls = mockDb.classes.find(c => c.id === classId);
      return { rows: cls ? [{ id: cls.id }] : [] };
    }
    if (sql.includes('SELECT class_id FROM class_user WHERE user_id')) {
      const userId = Number(params?.[0]);
      const memberships = mockDb.classUsers.filter(cu => cu.user_id === userId);
      return { rows: memberships.map(m => ({ class_id: m.class_id })) };
    }
    if (sql.includes('DELETE FROM class_user WHERE user_id')) {
      const userId = Number(params?.[0]);
      mockDb.classUsers = mockDb.classUsers.filter(cu => cu.user_id !== userId);
      return { rows: [] };
    }
    if (sql.includes('INSERT INTO class_user (class_id, user_id) VALUES')) {
      const [class_id, user_id] = params!.map(Number);
      mockDb.classUsers.push({ user_id, class_id });
      return { rows: [] };
    }

    // Transaction control
    if (sql.includes('BEGIN') || sql.includes('COMMIT') || sql.includes('ROLLBACK')) {
      return { rows: [] };
    }

    return { rows: [] };
  })
}));

jest.mock('../init', () => ({ dbReady: Promise.resolve() }));

jest.mock('../authUtils', () => ({ getAuthUser: jest.fn() }));

import {
  getAdminUsersHandler,
  deleteUserHandler,
  getClassUsersHandler,
  updateUserClassAdminHandler,
  updateUserProfileHandler,
  createUserHandler,
  importUsersHandler,
  createRegistrationLinkHandler,
  createPasswordLinkHandler,
  moveUserClassHandler,
} from '../admin';
import { getAuthUser } from '../authUtils';
import { query } from '../../db';

const mockGetAuthUser = getAuthUser as jest.Mock;
const mockQuery = query as jest.Mock;

const superAdmin = { id: 1, email: 'super@x.com', is_admin: true, is_class_admin: false };
const classAdminInClass = { id: 2, email: 'classadmin@x.com', is_admin: false, is_class_admin: true }; // belongs to class 10
const regularUser = { id: 3, email: 'user3@x.com', is_admin: false, is_class_admin: false };

const makeEvent = (overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent => ({
  headers: { Authorization: 'Bearer token' },
  pathParameters: {},
  queryStringParameters: null,
  body: null,
  httpMethod: 'GET',
  ...overrides
} as APIGatewayProxyEvent);

const body = (obj: any) => JSON.stringify(obj);

describe('Lambda admin handlers', () => {
  beforeEach(() => {
    mockDb = freshMockDb();
    jest.clearAllMocks();
    mockSend.mockResolvedValue({});
  });

  // ---- getAdminUsersHandler ----------------------------------------
  describe('getAdminUsersHandler', () => {
    it('returns 401 when unauthenticated', async () => {
      mockGetAuthUser.mockReturnValue(null);
      const result = await getAdminUsersHandler(makeEvent());
      expect(result.statusCode).toBe(401);
    });

    it('returns 403 for a class admin (super admin only)', async () => {
      mockGetAuthUser.mockReturnValue(classAdminInClass);
      const result = await getAdminUsersHandler(makeEvent());
      expect(result.statusCode).toBe(403);
    });

    it('returns the full user list for a super admin', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      const result = await getAdminUsersHandler(makeEvent());
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).users.length).toBe(mockDb.users.length);
    });

    it('returns 500 when the database throws', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      mockQuery.mockImplementationOnce(async () => { throw new Error('Database error'); });
      const result = await getAdminUsersHandler(makeEvent());
      expect(result.statusCode).toBe(500);
    });
  });

  // ---- deleteUserHandler ---------------------------------------------
  describe('deleteUserHandler', () => {
    it('returns 401 when unauthenticated', async () => {
      mockGetAuthUser.mockReturnValue(null);
      const result = await deleteUserHandler(makeEvent({ pathParameters: { userId: '3' } }));
      expect(result.statusCode).toBe(401);
    });

    it('returns 403 for a regular user (not admin, not class admin)', async () => {
      mockGetAuthUser.mockReturnValue({ ...regularUser, id: 5 });
      const result = await deleteUserHandler(makeEvent({ pathParameters: { userId: '3' } }));
      expect(result.statusCode).toBe(403);
      expect(JSON.parse(result.body).error).toContain('Admin access required');
    });

    it('returns 400 when userId is missing', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      const result = await deleteUserHandler(makeEvent({ pathParameters: {} }));
      expect(result.statusCode).toBe(400);
    });

    it('returns 404 for a non-existent user', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      const result = await deleteUserHandler(makeEvent({ pathParameters: { userId: '999' } }));
      expect(result.statusCode).toBe(404);
    });

    it('allows a super admin to delete any user', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      const result = await deleteUserHandler(makeEvent({ pathParameters: { userId: '4' } }));
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).message).toContain('deleted');
      expect(mockDb.users.find(u => u.id === 4)).toBeUndefined();
    });

    it('allows a class admin to delete a user in their own class', async () => {
      mockGetAuthUser.mockReturnValue(classAdminInClass);
      const result = await deleteUserHandler(makeEvent({ pathParameters: { userId: '3' } }));
      expect(result.statusCode).toBe(200);
      expect(mockDb.users.find(u => u.id === 3)).toBeUndefined();
    });

    it('deletes any S3 photos on the target user before removing them', async () => {
      mockGetAuthUser.mockReturnValue(classAdminInClass);
      const result = await deleteUserHandler(makeEvent({ pathParameters: { userId: '3' } }));
      expect(result.statusCode).toBe(200);
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ Key: 'photos/3-then.jpg' }));
    });

    it('denies a class admin deleting a user outside their own class', async () => {
      mockGetAuthUser.mockReturnValue(classAdminInClass);
      const result = await deleteUserHandler(makeEvent({ pathParameters: { userId: '4' } }));
      expect(result.statusCode).toBe(403);
      expect(JSON.parse(result.body).error).toContain('your class');
      expect(mockDb.users.find(u => u.id === 4)).toBeDefined();
    });

    it('returns 500 when the database throws', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      mockQuery.mockImplementationOnce(async () => { throw new Error('Database error'); });
      const result = await deleteUserHandler(makeEvent({ pathParameters: { userId: '3' } }));
      expect(result.statusCode).toBe(500);
    });
  });

  // ---- getClassUsersHandler ------------------------------------------
  describe('getClassUsersHandler', () => {
    it('returns 401 when unauthenticated', async () => {
      mockGetAuthUser.mockReturnValue(null);
      const result = await getClassUsersHandler(makeEvent({ pathParameters: { classId: '10' } }));
      expect(result.statusCode).toBe(401);
    });

    it('returns 403 for a class admin (super admin only)', async () => {
      mockGetAuthUser.mockReturnValue(classAdminInClass);
      const result = await getClassUsersHandler(makeEvent({ pathParameters: { classId: '10' } }));
      expect(result.statusCode).toBe(403);
    });

    it('returns 400 when classId is missing', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      const result = await getClassUsersHandler(makeEvent({ pathParameters: {} }));
      expect(result.statusCode).toBe(400);
    });

    it('returns paginated members of the class', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      const result = await getClassUsersHandler(makeEvent({
        pathParameters: { classId: '10' },
        queryStringParameters: { page: '1', pageSize: '10' }
      }));
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.total).toBe(2); // users 2 and 3 belong to class 10
      expect(body.users.map((u: any) => u.id).sort()).toEqual([2, 3]);
    });

    it('filters by last name', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      const result = await getClassUsersHandler(makeEvent({
        pathParameters: { classId: '10' },
        queryStringParameters: { page: '1', pageSize: '10', lastName: 'Three' }
      }));
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.users).toHaveLength(1);
      expect(body.users[0].id).toBe(3);
    });

    it('returns 500 when the database throws', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      mockQuery.mockImplementationOnce(async () => { throw new Error('Database error'); });
      const result = await getClassUsersHandler(makeEvent({ pathParameters: { classId: '10' } }));
      expect(result.statusCode).toBe(500);
    });
  });

  // ---- updateUserClassAdminHandler ------------------------------------
  describe('updateUserClassAdminHandler', () => {
    it('returns 401 when unauthenticated', async () => {
      mockGetAuthUser.mockReturnValue(null);
      const result = await updateUserClassAdminHandler(makeEvent({ pathParameters: { userId: '3' }, body: body({ is_class_admin: true }) }));
      expect(result.statusCode).toBe(401);
    });

    it('returns 403 for a class admin (super admin only)', async () => {
      mockGetAuthUser.mockReturnValue(classAdminInClass);
      const result = await updateUserClassAdminHandler(makeEvent({ pathParameters: { userId: '3' }, body: body({ is_class_admin: true }) }));
      expect(result.statusCode).toBe(403);
    });

    it('returns 400 when is_class_admin is missing', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      const result = await updateUserClassAdminHandler(makeEvent({ pathParameters: { userId: '3' }, body: body({}) }));
      expect(result.statusCode).toBe(400);
    });

    it('returns 404 for a non-existent user', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      const result = await updateUserClassAdminHandler(makeEvent({ pathParameters: { userId: '999' }, body: body({ is_class_admin: true }) }));
      expect(result.statusCode).toBe(404);
    });

    it('updates a user\'s class admin status', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      const result = await updateUserClassAdminHandler(makeEvent({ pathParameters: { userId: '3' }, body: body({ is_class_admin: true }) }));
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).user.is_class_admin).toBe(true);
      expect(mockDb.users.find(u => u.id === 3)?.is_class_admin).toBe(true);
    });

    it('returns 500 when the database throws', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      mockQuery.mockImplementationOnce(async () => { throw new Error('Database error'); });
      const result = await updateUserClassAdminHandler(makeEvent({ pathParameters: { userId: '3' }, body: body({ is_class_admin: true }) }));
      expect(result.statusCode).toBe(500);
    });
  });

  // ---- updateUserProfileHandler ---------------------------------------
  describe('updateUserProfileHandler', () => {
    const validBody = { is_deceased: true, first_name: 'Sammy', last_name: 'Threeson' };

    it('returns 401 when unauthenticated', async () => {
      mockGetAuthUser.mockReturnValue(null);
      const result = await updateUserProfileHandler(makeEvent({ pathParameters: { userId: '3' }, body: body(validBody) }));
      expect(result.statusCode).toBe(401);
    });

    it('returns 400 when is_deceased is not a boolean', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      const result = await updateUserProfileHandler(makeEvent({ pathParameters: { userId: '3' }, body: body({ ...validBody, is_deceased: 'yes' }) }));
      expect(result.statusCode).toBe(400);
    });

    it('returns 400 when first_name or last_name is missing', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      const result = await updateUserProfileHandler(makeEvent({ pathParameters: { userId: '3' }, body: body({ is_deceased: true, first_name: '', last_name: 'Threeson' }) }));
      expect(result.statusCode).toBe(400);
    });

    it('returns 404 for a non-existent user', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      const result = await updateUserProfileHandler(makeEvent({ pathParameters: { userId: '999' }, body: body(validBody) }));
      expect(result.statusCode).toBe(404);
    });

    it('denies a regular user (not admin, not class admin)', async () => {
      mockGetAuthUser.mockReturnValue(regularUser);
      const result = await updateUserProfileHandler(makeEvent({ pathParameters: { userId: '4' }, body: body(validBody) }));
      expect(result.statusCode).toBe(403);
    });

    it('denies a class admin updating a user outside their own class', async () => {
      mockGetAuthUser.mockReturnValue(classAdminInClass);
      const result = await updateUserProfileHandler(makeEvent({ pathParameters: { userId: '4' }, body: body(validBody) }));
      expect(result.statusCode).toBe(403);
    });

    it('allows a super admin to update any user', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      const result = await updateUserProfileHandler(makeEvent({ pathParameters: { userId: '4' }, body: body(validBody) }));
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).user.first_name).toBe('Sammy');
    });

    it('allows a class admin to update a user in their own class', async () => {
      mockGetAuthUser.mockReturnValue(classAdminInClass);
      const result = await updateUserProfileHandler(makeEvent({ pathParameters: { userId: '3' }, body: body(validBody) }));
      expect(result.statusCode).toBe(200);
      expect(mockDb.users.find(u => u.id === 3)?.is_deceased).toBe(true);
    });

    it('returns 500 when the database throws', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      mockQuery.mockImplementationOnce(async () => { throw new Error('Database error'); });
      const result = await updateUserProfileHandler(makeEvent({ pathParameters: { userId: '3' }, body: body(validBody) }));
      expect(result.statusCode).toBe(500);
    });
  });

  // ---- createUserHandler ----------------------------------------------
  describe('createUserHandler', () => {
    const params = { schoolId: '100', classId: '10' };
    const validBody = { email: 'new@x.com', first_name: 'New', last_name: 'User' };

    it('handles CORS preflight', async () => {
      const result = await createUserHandler(makeEvent({ httpMethod: 'OPTIONS' }));
      expect(result.statusCode).toBe(200);
    });

    it('returns 401 when unauthenticated', async () => {
      mockGetAuthUser.mockReturnValue(null);
      const result = await createUserHandler(makeEvent({ httpMethod: 'POST', pathParameters: params, body: body(validBody) }));
      expect(result.statusCode).toBe(401);
    });

    it('returns 403 for a class admin (super admin only)', async () => {
      mockGetAuthUser.mockReturnValue(classAdminInClass);
      const result = await createUserHandler(makeEvent({ httpMethod: 'POST', pathParameters: params, body: body(validBody) }));
      expect(result.statusCode).toBe(403);
    });

    it('returns 400 when schoolId or classId is missing', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      const result = await createUserHandler(makeEvent({ httpMethod: 'POST', pathParameters: {}, body: body(validBody) }));
      expect(result.statusCode).toBe(400);
    });

    it('returns 400 when first_name or last_name is missing', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      const result = await createUserHandler(makeEvent({ httpMethod: 'POST', pathParameters: params, body: body({ email: 'new@x.com', first_name: '', last_name: 'User' }) }));
      expect(result.statusCode).toBe(400);
    });

    it('returns 409 when the email is already in use', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      const result = await createUserHandler(makeEvent({ httpMethod: 'POST', pathParameters: params, body: body({ email: 'dup@x.com', first_name: 'Dup', last_name: 'User' }) }));
      expect(result.statusCode).toBe(409);
    });

    it('creates a user with an email', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      const result = await createUserHandler(makeEvent({ httpMethod: 'POST', pathParameters: params, body: body(validBody) }));
      expect(result.statusCode).toBe(201);
      const created = JSON.parse(result.body).user;
      expect(created.email).toBe('new@x.com');
      expect(mockDb.classUsers.some(cu => cu.user_id === created.id && cu.class_id === 10)).toBe(true);
    });

    it('creates a user without an email', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      const result = await createUserHandler(makeEvent({ httpMethod: 'POST', pathParameters: params, body: body({ first_name: 'No', last_name: 'Email' }) }));
      expect(result.statusCode).toBe(201);
      expect(JSON.parse(result.body).user.email).toBeNull();
    });

    it('returns 500 when the database throws', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      mockQuery.mockImplementationOnce(async () => { throw new Error('Database error'); });
      const result = await createUserHandler(makeEvent({ httpMethod: 'POST', pathParameters: params, body: body(validBody) }));
      expect(result.statusCode).toBe(500);
    });
  });

  // ---- importUsersHandler ----------------------------------------------
  describe('importUsersHandler', () => {
    const params = { schoolId: '100', classId: '10' };

    it('handles CORS preflight', async () => {
      const result = await importUsersHandler(makeEvent({ httpMethod: 'OPTIONS' }));
      expect(result.statusCode).toBe(200);
    });

    it('returns 401 when unauthenticated', async () => {
      mockGetAuthUser.mockReturnValue(null);
      const result = await importUsersHandler(makeEvent({ httpMethod: 'POST', pathParameters: params, body: body({ users: [{ first_name: 'A', last_name: 'One' }] }) }));
      expect(result.statusCode).toBe(401);
    });

    it('returns 403 for a class admin (super admin only)', async () => {
      mockGetAuthUser.mockReturnValue(classAdminInClass);
      const result = await importUsersHandler(makeEvent({ httpMethod: 'POST', pathParameters: params, body: body({ users: [{ first_name: 'A', last_name: 'One' }] }) }));
      expect(result.statusCode).toBe(403);
    });

    it('returns 400 when the users array is missing or empty', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      const result = await importUsersHandler(makeEvent({ httpMethod: 'POST', pathParameters: params, body: body({ users: [] }) }));
      expect(result.statusCode).toBe(400);
    });

    it('returns 400 when the users array exceeds 500 rows', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      const users = Array.from({ length: 501 }, (_, i) => ({ first_name: `F${i}`, last_name: `L${i}` }));
      const result = await importUsersHandler(makeEvent({ httpMethod: 'POST', pathParameters: params, body: body({ users }) }));
      expect(result.statusCode).toBe(400);
    });

    it('creates valid rows and skips invalid or duplicate ones', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      const users = [
        { first_name: 'Valid', last_name: 'Row' },
        { first_name: '', last_name: 'Missing First' },
        { email: 'dup@x.com', first_name: 'Dup', last_name: 'User' },
      ];
      const result = await importUsersHandler(makeEvent({ httpMethod: 'POST', pathParameters: params, body: body({ users }) }));
      expect(result.statusCode).toBe(201);
      const parsed = JSON.parse(result.body);
      expect(parsed.created).toBe(1);
      expect(parsed.skipped).toHaveLength(2);
      expect(parsed.skipped[0].reason).toContain('Missing first or last name');
      expect(parsed.skipped[1].reason).toContain('Email already exists');
    });

    it('returns 500 on malformed JSON body', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      const result = await importUsersHandler(makeEvent({ httpMethod: 'POST', pathParameters: params, body: '{not valid json' }));
      expect(result.statusCode).toBe(500);
    });
  });

  // ---- createRegistrationLinkHandler -----------------------------------
  describe('createRegistrationLinkHandler', () => {
    const validBody = { classId: 10, schoolId: 100 };

    it('returns 401 when unauthenticated', async () => {
      mockGetAuthUser.mockReturnValue(null);
      const result = await createRegistrationLinkHandler(makeEvent({ httpMethod: 'POST', body: body(validBody) }));
      expect(result.statusCode).toBe(401);
    });

    it('returns 403 for a class admin (super admin only)', async () => {
      mockGetAuthUser.mockReturnValue(classAdminInClass);
      const result = await createRegistrationLinkHandler(makeEvent({ httpMethod: 'POST', body: body(validBody) }));
      expect(result.statusCode).toBe(403);
    });

    it('returns 400 when classId or schoolId is missing', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      const result = await createRegistrationLinkHandler(makeEvent({ httpMethod: 'POST', body: body({ classId: 10 }) }));
      expect(result.statusCode).toBe(400);
    });

    it('returns 404 when the class is not linked to the school', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      const result = await createRegistrationLinkHandler(makeEvent({ httpMethod: 'POST', body: body({ classId: 10, schoolId: 999 }) }));
      expect(result.statusCode).toBe(404);
    });

    it('returns a registration link on success', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      const result = await createRegistrationLinkHandler(makeEvent({ httpMethod: 'POST', body: body(validBody) }));
      expect(result.statusCode).toBe(200);
      const parsed = JSON.parse(result.body);
      expect(parsed.hash).toBeTruthy();
      expect(parsed.registrationUrl).toContain(parsed.hash);
      expect(parsed.class).toEqual({ id: 10, year: 2010 });
    });

    it('returns 500 when the database throws', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      mockQuery.mockImplementationOnce(async () => { throw new Error('Database error'); });
      const result = await createRegistrationLinkHandler(makeEvent({ httpMethod: 'POST', body: body(validBody) }));
      expect(result.statusCode).toBe(500);
    });
  });

  // ---- createPasswordLinkHandler -----------------------------------------
  describe('createPasswordLinkHandler', () => {
    it('returns 401 when unauthenticated', async () => {
      mockGetAuthUser.mockReturnValue(null);
      const result = await createPasswordLinkHandler(makeEvent({ httpMethod: 'POST', pathParameters: { userId: '3' } }));
      expect(result.statusCode).toBe(401);
    });

    it('returns 403 for a class admin (super admin only)', async () => {
      mockGetAuthUser.mockReturnValue(classAdminInClass);
      const result = await createPasswordLinkHandler(makeEvent({ httpMethod: 'POST', pathParameters: { userId: '3' } }));
      expect(result.statusCode).toBe(403);
    });

    it('returns 400 when userId is missing', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      const result = await createPasswordLinkHandler(makeEvent({ httpMethod: 'POST', pathParameters: {} }));
      expect(result.statusCode).toBe(400);
    });

    it('returns 404 for a non-existent user', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      const result = await createPasswordLinkHandler(makeEvent({ httpMethod: 'POST', pathParameters: { userId: '999' } }));
      expect(result.statusCode).toBe(404);
    });

    it('returns 400 when the user has no email on file', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      const result = await createPasswordLinkHandler(makeEvent({ httpMethod: 'POST', pathParameters: { userId: '5' } }));
      expect(result.statusCode).toBe(400);
    });

    it('creates a password setup link', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      const result = await createPasswordLinkHandler(makeEvent({ httpMethod: 'POST', pathParameters: { userId: '3' } }));
      expect(result.statusCode).toBe(200);
      const parsed = JSON.parse(result.body);
      expect(parsed.passwordSetupUrl).toContain('/reset-password?token=');
      expect(parsed.expiresAt).toBeTruthy();
      expect(mockDb.passwordResetTokens.some(t => t.user_id === 3)).toBe(true);
    });

    it('returns 500 when the database throws', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      mockQuery.mockImplementationOnce(async () => { throw new Error('Database error'); });
      const result = await createPasswordLinkHandler(makeEvent({ httpMethod: 'POST', pathParameters: { userId: '3' } }));
      expect(result.statusCode).toBe(500);
    });
  });

  // ---- moveUserClassHandler -----------------------------------------------
  describe('moveUserClassHandler', () => {
    it('returns 401 when unauthenticated', async () => {
      mockGetAuthUser.mockReturnValue(null);
      const result = await moveUserClassHandler(makeEvent({ httpMethod: 'PUT', pathParameters: { userId: '4' }, body: body({ class_id: 10 }) }));
      expect(result.statusCode).toBe(401);
    });

    it('returns 403 for a class admin (super admin only)', async () => {
      mockGetAuthUser.mockReturnValue(classAdminInClass);
      const result = await moveUserClassHandler(makeEvent({ httpMethod: 'PUT', pathParameters: { userId: '4' }, body: body({ class_id: 10 }) }));
      expect(result.statusCode).toBe(403);
    });

    it('returns 400 when userId is missing', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      const result = await moveUserClassHandler(makeEvent({ httpMethod: 'PUT', pathParameters: {}, body: body({ class_id: 10 }) }));
      expect(result.statusCode).toBe(400);
    });

    it('returns 400 when class_id is missing', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      const result = await moveUserClassHandler(makeEvent({ httpMethod: 'PUT', pathParameters: { userId: '4' }, body: body({}) }));
      expect(result.statusCode).toBe(400);
    });

    it('returns 404 for a non-existent user', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      const result = await moveUserClassHandler(makeEvent({ httpMethod: 'PUT', pathParameters: { userId: '999' }, body: body({ class_id: 10 }) }));
      expect(result.statusCode).toBe(404);
    });

    it('returns 404 for a non-existent class', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      const result = await moveUserClassHandler(makeEvent({ httpMethod: 'PUT', pathParameters: { userId: '4' }, body: body({ class_id: 999 }) }));
      expect(result.statusCode).toBe(404);
    });

    it('returns 400 when the user is already in that class', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      const result = await moveUserClassHandler(makeEvent({ httpMethod: 'PUT', pathParameters: { userId: '3' }, body: body({ class_id: 10 }) }));
      expect(result.statusCode).toBe(400);
    });

    it('moves a user to a new class', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      const result = await moveUserClassHandler(makeEvent({ httpMethod: 'PUT', pathParameters: { userId: '4' }, body: body({ class_id: 10 }) }));
      expect(result.statusCode).toBe(200);
      expect(mockDb.classUsers.some(cu => cu.user_id === 4 && cu.class_id === 10)).toBe(true);
      expect(mockDb.classUsers.some(cu => cu.user_id === 4 && cu.class_id === 20)).toBe(false);
    });

    it('returns 500 when the database throws', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      mockQuery.mockImplementationOnce(async () => { throw new Error('Database error'); });
      const result = await moveUserClassHandler(makeEvent({ httpMethod: 'PUT', pathParameters: { userId: '4' }, body: body({ class_id: 10 }) }));
      expect(result.statusCode).toBe(500);
    });
  });
});
