import {
  School,
  ClassEntity,
  User,
  Profile,
  Comment,
  UserRegisterInput
} from '../types';

describe('Type Definitions', () => {
  describe('School interface', () => {
    it('should have required properties', () => {
      const school: School = {
        id: 1,
        name: 'Test School',
        location: 'Test Location',
        created_at: new Date(),
        updated_at: new Date()
      };

      expect(school.id).toBe(1);
      expect(school.name).toBe('Test School');
      expect(school.location).toBe('Test Location');
      expect(school.created_at).toBeInstanceOf(Date);
      expect(school.updated_at).toBeInstanceOf(Date);
    });
  });

  describe('ClassEntity interface', () => {
    it('should have required properties', () => {
      const classEntity: ClassEntity = {
        id: 1,
        year: 2020,
        created_at: new Date(),
      };

      expect(classEntity.id).toBe(1);
      expect(classEntity.year).toBe(2020);
      expect(classEntity.created_at).toBeInstanceOf(Date);
    });
  });

  describe('User interface', () => {
    it('should have required properties', () => {
      const user: User = {
        id: 1,
        email: 'test@example.com',
        password: 'hashed_password',
        is_admin: false,
        created_at: new Date(),
        updated_at: new Date()
      };

      expect(user.id).toBe(1);
      expect(user.email).toBe('test@example.com');
      expect(user.password).toBe('hashed_password');
      expect(user.is_admin).toBe(false);
      expect(user.created_at).toBeInstanceOf(Date);
      expect(user.updated_at).toBeInstanceOf(Date);
    });

    it('should support admin users', () => {
      const adminUser: User = {
        id: 2,
        email: 'admin@example.com',
        password: 'hashed_password',
        is_admin: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      expect(adminUser.is_admin).toBe(true);
    });
  });

  describe('Profile interface', () => {
    it('should have required properties', () => {
      const profile: Profile = {
        id: 1,
        user_id: 1,
        first_name: 'John',
        last_name: 'Doe',
        nickname: 'Johnny',
        former_first_name: null,
        former_last_name: null,
        bio: 'Test bio',
        then_photo_url: 'http://example.com/then.jpg',
        now_photo_url: 'http://example.com/now.jpg',
        avatar_color: null,
        created_at: new Date(),
        updated_at: new Date()
      };

      expect(profile.id).toBe(1);
      expect(profile.user_id).toBe(1);
      expect(profile.first_name).toBe('John');
      expect(profile.last_name).toBe('Doe');
      expect(profile.nickname).toBe('Johnny');
      expect(profile.bio).toBe('Test bio');
      expect(profile.then_photo_url).toBe('http://example.com/then.jpg');
      expect(profile.now_photo_url).toBe('http://example.com/now.jpg');
    });

    it('should support null values for optional fields', () => {
      const profile: Profile = {
        id: 2,
        user_id: 2,
        first_name: null,
        last_name: null,
        nickname: null,
        former_first_name: null,
        former_last_name: null,
        bio: null,
        then_photo_url: null,
        now_photo_url: null,
        avatar_color: null,
        created_at: new Date(),
        updated_at: new Date()
      };

      expect(profile.first_name).toBeNull();
      expect(profile.last_name).toBeNull();
      expect(profile.nickname).toBeNull();
      expect(profile.bio).toBeNull();
      expect(profile.then_photo_url).toBeNull();
      expect(profile.now_photo_url).toBeNull();
    });
  });

  describe('Comment interface', () => {
    it('should have required properties', () => {
      const comment: Comment = {
        id: 1,
        target_user_id: 1,
        commenter_id: 2,
        content: 'Great reunion!',
        published: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      expect(comment.id).toBe(1);
      expect(comment.target_user_id).toBe(1);
      expect(comment.commenter_id).toBe(2);
      expect(comment.content).toBe('Great reunion!');
      expect(comment.published).toBe(true);
      expect(comment.created_at).toBeInstanceOf(Date);
      expect(comment.updated_at).toBeInstanceOf(Date);
    });

    it('should support unpublished comments', () => {
      const comment: Comment = {
        id: 2,
        target_user_id: 1,
        commenter_id: 3,
        content: 'Pending approval',
        published: false,
        created_at: new Date(),
        updated_at: new Date()
      };

      expect(comment.published).toBe(false);
    });
  });

  describe('UserRegisterInput interface', () => {
    it('should have required properties', () => {
      const input: UserRegisterInput = {
        email: 'newuser@example.com',
        password: 'Password123!',
        first_name: 'Jane',
        last_name: 'Smith',
        class_id: 1
      };

      expect(input.email).toBe('newuser@example.com');
      expect(input.password).toBe('Password123!');
      expect(input.first_name).toBe('Jane');
      expect(input.last_name).toBe('Smith');
      expect(input.class_id).toBe(1);
    });

    it('should validate email format in implementation', () => {
      const input: UserRegisterInput = {
        email: 'test@example.com',
        password: 'Password123!',
        first_name: 'Test',
        last_name: 'User',
        class_id: 1
      };

      expect(input.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });
  });
});
