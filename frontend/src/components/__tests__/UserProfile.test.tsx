import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import UserProfile from '../UserProfile';
import * as api from '../../api';

vi.mock('../../api');

const mockProfile = {
  user: {
    id: 1,
    email: 'test@example.com',
    is_admin: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  profile: {
    id: 1,
    user_id: 1,
    first_name: 'John',
    last_name: 'Doe',
    nickname_school: 'Johnny',
    bio: 'Software engineer',
    then_photo_url: 'https://example.com/then.jpg',
    now_photo_url: 'https://example.com/now.jpg',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }
};

describe('UserProfile Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.default.get).mockResolvedValueOnce({
      data: mockProfile
    });
  });

  it('should render user profile', async () => {
    render(<UserProfile userId={1} />);

    await waitFor(() => {
      expect(screen.getByText(/John Doe/)).toBeInTheDocument();
      expect(screen.getByText(/test@example.com/)).toBeInTheDocument();
    });
  });

  it('should display loading state initially', () => {
    render(<UserProfile userId={1} />);

    expect(screen.getByText('Loading profile...')).toBeInTheDocument();
  });

  it('should display profile information after loading', async () => {
    render(<UserProfile userId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Johnny')).toBeInTheDocument();
      expect(screen.getByText('Software engineer')).toBeInTheDocument();
    });
  });

  it('should show error on failed profile load', async () => {
    const errorMsg = 'Failed to load profile';

    vi.mocked(api.default.get).mockRejectedValueOnce({
      response: { data: { error: errorMsg } }
    });

    render(<UserProfile userId={999} />);

    await waitFor(() => {
      expect(screen.getByText(new RegExp(errorMsg))).toBeInTheDocument();
    });
  });

  it('should toggle edit mode', async () => {
    const user = userEvent.setup();

    render(<UserProfile userId={1} />);

    await waitFor(() => {
      expect(screen.getByText(/John Doe/)).toBeInTheDocument();
    });

    const editButton = screen.getByRole('button', { name: /Edit Profile/i });
    await user.click(editButton);

    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
  });

  it('should allow editing profile information', async () => {
    const user = userEvent.setup();

    render(<UserProfile userId={1} />);

    await waitFor(() => {
      expect(screen.getByText('John')).toBeInTheDocument();
    });

    const editButton = screen.getByRole('button', { name: /Edit Profile/i });
    await user.click(editButton);

    const firstNameInput = screen.getByDisplayValue('John');
    await user.clear(firstNameInput);
    await user.type(firstNameInput, 'Jane');

    expect(screen.getByDisplayValue('Jane')).toBeInTheDocument();
  });

  it('should display photos when available', async () => {
    render(<UserProfile userId={1} />);

    await waitFor(() => {
      expect(screen.getByAltText('Then')).toBeInTheDocument();
      expect(screen.getByAltText('Now')).toBeInTheDocument();
    });
  });

  it('should show photo placeholders when photos are not available', async () => {
    vi.mocked(api.default.get).mockResolvedValueOnce({
      data: {
        ...mockProfile,
        profile: {
          ...mockProfile.profile,
          then_photo_url: null,
          now_photo_url: null
        }
      }
    });

    render(<UserProfile userId={1} />);

    await waitFor(() => {
      expect(screen.getAllByText('No photo uploaded')).toHaveLength(2);
    });
  });

  it('should allow file input for photo upload', async () => {
    const user = userEvent.setup();

    render(<UserProfile userId={1} />);

    await waitFor(() => {
      expect(screen.getByAltText('Then')).toBeInTheDocument();
    });

    const fileInputs = screen.getAllByDisplayValue('');
    expect(fileInputs.length).toBeGreaterThan(0);
  });

  it('should display account creation date', async () => {
    render(<UserProfile userId={1} />);

    await waitFor(() => {
      const dateStr = new Date(mockProfile.user.created_at).toLocaleDateString();
      expect(screen.getByText(dateStr)).toBeInTheDocument();
    });
  });

  it('should display admin status', async () => {
    vi.mocked(api.default.get).mockResolvedValueOnce({
      data: {
        ...mockProfile,
        user: {
          ...mockProfile.user,
          is_admin: true
        }
      }
    });

    render(<UserProfile userId={1} />);

    await waitFor(() => {
      expect(screen.getByText('✓ Admin')).toBeInTheDocument();
    });
  });

  it('should handle missing profile gracefully', async () => {
    vi.mocked(api.default.get).mockResolvedValueOnce({
      data: {
        user: mockProfile.user,
        profile: null
      }
    });

    render(<UserProfile userId={1} />);

    await waitFor(() => {
      expect(screen.getByText(/test@example.com/)).toBeInTheDocument();
    });
  });
});
