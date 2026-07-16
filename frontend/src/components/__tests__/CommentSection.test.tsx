import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import CommentSection from '../CommentSection';
import * as api from '../../api';

vi.mock('../../api');
vi.mock('../../context/AppContext', () => ({
  useAppContext: () => ({
    // CommentSection takes no props — it always shows the signed-in user's own comments,
    // fetched via /comments/my-comments/:user_id
    currentUser: { id: 2, user_id: 2, email: 'commenter@example.com', is_admin: false, profile: null }
  })
}));

const mockComments = [
  {
    id: 1,
    target_user_id: 1,
    commenter_id: 2,
    content: 'Great memories!',
    published: true,
    created_at: '2024-06-19T10:00:00Z',
    updated_at: '2024-06-19T10:00:00Z'
  }
];

describe('CommentSection Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.default.get).mockImplementation(() =>
      Promise.resolve({ data: { comments: mockComments } })
    );
  });

  it('should render comment section', async () => {
    render(<CommentSection />);

    await waitFor(() => {
      expect(screen.getByText(/My Comments/i)).toBeInTheDocument();
    });
  });

  it('should display loading state initially', () => {
    render(<CommentSection />);

    expect(screen.getByText('Loading comments...')).toBeInTheDocument();
  });

  it('should display comments after loading', async () => {
    render(<CommentSection />);

    await waitFor(() => {
      expect(screen.getByText('Great memories!')).toBeInTheDocument();
    });
  });

  it('should show empty state when no comments', async () => {
    vi.mocked(api.default.get).mockResolvedValueOnce({
      data: { comments: [] }
    });

    render(<CommentSection />);

    await waitFor(() => {
      expect(
        screen.getByText(/You haven't posted any comments yet/i)
      ).toBeInTheDocument();
    });
  });

  it('should allow user to post comment', async () => {
    const user = userEvent.setup();

    vi.mocked(api.default.post).mockResolvedValueOnce({
      data: {
        comment: {
          id: 2,
          target_user_id: 1,
          commenter_id: 2,
          content: 'New comment',
          published: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      }
    });

    render(<CommentSection />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Share your thoughts...')).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText('Share your thoughts...');
    const submitButton = screen.getByRole('button', { name: /Post comment/i });

    await user.type(textarea, 'New comment');
    await user.click(submitButton);

    await waitFor(() => {
      expect(api.default.post).toHaveBeenCalledWith(
        expect.stringContaining('/comments'),
        expect.objectContaining({ content: 'New comment' })
      );
    });
  });

  it('should show error when comment submission fails', async () => {
    const user = userEvent.setup();
    const errorMsg = 'Failed to post comment';

    vi.mocked(api.default.post).mockRejectedValueOnce({
      response: { data: { error: errorMsg } }
    });

    render(<CommentSection />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Share your thoughts...')).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText('Share your thoughts...');
    const submitButton = screen.getByRole('button', { name: /Post comment/i });

    await user.type(textarea, 'Test comment');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(errorMsg)).toBeInTheDocument();
    });
  });

  it('should allow editing own comments', async () => {
    const user = userEvent.setup();

    render(<CommentSection />);

    await waitFor(() => {
      expect(screen.getByText('Great memories!')).toBeInTheDocument();
    });

    const editButton = screen.getByRole('button', { name: /Edit/i });
    expect(editButton).toBeInTheDocument();

    await user.click(editButton);

    expect(screen.getByDisplayValue('Great memories!')).toBeInTheDocument();
  });

  it('should allow deleting own comments', async () => {
    const user = userEvent.setup();

    vi.mocked(api.default.delete).mockResolvedValueOnce({
      data: { message: 'Deleted' }
    });

    render(<CommentSection />);

    await waitFor(() => {
      expect(screen.getByText('Great memories!')).toBeInTheDocument();
    });

    // Opens the ConfirmModal (the component uses a modal, not window.confirm)
    const deleteButton = screen.getByRole('button', { name: /Delete/i });
    await user.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText('Delete Comment')).toBeInTheDocument();
    });

    // Modal's own confirm button is also labeled "Delete" — it's the one added after opening
    const confirmButtons = screen.getAllByRole('button', { name: 'Delete' });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => {
      expect(api.default.delete).toHaveBeenCalledWith('/comments/1');
    });
  });
});
