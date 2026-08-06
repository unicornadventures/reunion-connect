import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-super-secret-key';

const mockDb = {
  users: [
    { id: 1, is_admin: true, is_class_admin: false },
    { id: 2, is_admin: false, is_class_admin: true },
    { id: 3, is_admin: false, is_class_admin: true },
    { id: 4, is_admin: false, is_class_admin: false },
  ],
  classUsers: [
    { class_id: 10, user_id: 2 }, // class admin 2 administers class 10
    { class_id: 10, user_id: 4 }, // target user 4 is in class 10
    { class_id: 20, user_id: 3 }, // class admin 3 administers class 20 (different class)
  ],
};

jest.mock('../../db', () => ({
  query: jest.fn(async (sql: string, params?: any[]) => {
    if (sql.includes('SELECT * FROM users WHERE id')) {
      const user = mockDb.users.find(u => u.id === params?.[0]);
      return { rows: user ? [user] : [] };
    }
    if (sql.includes('cu1.class_id') && sql.includes('cu2.class_id')) {
      const requesterId = Number(params?.[0]);
      const targetId = Number(params?.[1]);
      const requesterClasses = mockDb.classUsers.filter(cu => cu.user_id === requesterId).map(cu => cu.class_id);
      const targetClasses = mockDb.classUsers.filter(cu => cu.user_id === targetId).map(cu => cu.class_id);
      const overlap = requesterClasses.filter(c => targetClasses.includes(c));
      return { rows: overlap.map(class_id => ({ class_id })) };
    }
    return { rows: [] };
  }),
}));

import { requireUserAdmin } from '../adminAuth.ts';

function tokenFor(userId: number) {
  return jwt.sign({ id: userId }, JWT_SECRET);
}

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('requireUserAdmin', () => {
  it('rejects requests with no token', async () => {
    const req: any = { headers: {}, params: { userId: '4' } };
    const res = mockRes();
    const next = jest.fn();

    await requireUserAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows a super admin to manage any user', async () => {
    const req: any = { headers: { authorization: `Bearer ${tokenFor(1)}` }, params: { userId: '4' } };
    const res = mockRes();
    const next = jest.fn();

    await requireUserAdmin(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user.id).toBe(1);
  });

  it('allows a class admin to manage a user in their own class', async () => {
    const req: any = { headers: { authorization: `Bearer ${tokenFor(2)}` }, params: { userId: '4' } };
    const res = mockRes();
    const next = jest.fn();

    await requireUserAdmin(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('rejects a class admin managing a user outside their class', async () => {
    const req: any = { headers: { authorization: `Bearer ${tokenFor(3)}` }, params: { userId: '4' } };
    const res = mockRes();
    const next = jest.fn();

    await requireUserAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a regular user with no admin flags', async () => {
    const req: any = { headers: { authorization: `Bearer ${tokenFor(4)}` }, params: { userId: '2' } };
    const res = mockRes();
    const next = jest.fn();

    await requireUserAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
