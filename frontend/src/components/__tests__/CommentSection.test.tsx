import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import CommentSection from '../CommentSection';
import * as api from '../../api';

vi.mock('../../api');

const mockComments = [
  {
    id: 1,
    target_user_id: 1,
    commenter_id: 2,
    content: 'Great memories!',
    published: true,
    created_at: '2024-06-19T10:00:00Z',
    updated_at: '2024-06-19T10:00:00Z',
    first_name: 'John',
    last_name: 'Doe'
  }
];

describe('CommentSection Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.default.get).mockResolvedValueOnce({
      data: { comments: mockComments }
    });
  });

  it('should render comment section', async () => {
    render(<CommentSection targetUserId={1} commenterId={2} />);

    await waitFor(() => {
      expect(screen.getByText(/Comments/i)).toBeInTheDocument();
    });
  });

  it('should display loading state initially', () => {
    render(<CommentSection targetUserId={1} commenterId={2} />);

    expect(screen.getByText('Loading comments...')).toBeInTheDocument();
  });

  it('should display comments after loading', async () => {
    render(<CommentSection targetUserId={1} commenterId={2} />);

    await waitFor(() => {
      expect(screen.getByText('Great memories!')).toBeInTheDocument();
      expect(screen.getByText(/John Doe/)).toBeInTheDocument();
    });
  });

  it('should show empty state when no comments', async () => {
    vi.mocked(api.default.get).mockResolvedValueOnce({
      data: { comments: [] }
    });

    render(<CommentSection targetUserId={1} commenterId={2} />);

    await waitFor(() => {
      expect(
        screen.getByText(/Be the first to comment/i)
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
          updated_at: new Date().toISOString(),
          first_name: 'Jane',
          last_name: 'Smith'
        }
      }
    });

    render(<CommentSection targetUserId={1} commenterId={2} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Share your thoughts...')).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText('Share your thoughts...');
    const submitButton = screen.getByRole('button', { name: /Post Comment/i });

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

    render(<CommentSection targetUserId={1} commenterId={2} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Share your thoughts...')).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText('Share your thoughts...');
    const submitButton = screen.getByRole('button', { name: /Post Comment/i });

    await user.type(textarea, 'Test comment');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(errorMsg)).toBeInTheDocument();
    });
  });

  it('should allow editing own comments', async () => {
    const user = userEvent.setup();

    vi.mocked(api.default.get).mockResolvedValueOnce({
      data: {
        comments: [
          {
            ...mockComments[0],
            commenter_id: 2 // Current user
          }
        ]
      }
    });

    render(<CommentSection targetUserId={1} commenterId={2} />);

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
    window.confirm = vi.fn(() => true);

    vi.mocked(api.default.get).mockResolvedValueOnce({
      data: {
        comments: [
          {
            ...mockComments[0],
            commenter_id: 2
          }
        ]
      }
    });

    vi.mocked(api.default.delete).mockResolvedValueOnce({
      data: { message: 'Deleted' }
    });

    render(<CommentSection targetUserId={1} commenterId={2} />);

    await waitFor(() => {
      expect(screen.getByText('Great memories!')).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole('button', { name: /Delete/i });
    await user.click(deleteButton);

    expect(window.confirm).toHaveBeenCalled();
  });

  it('should not show edit/delete buttons for other users comments', async () => {
    vi.mocked(api.default.get).mockResolvedValueOnce({
      data: {
        comments: [
          {
            ...mockComments[0],
            commenter_id: 3 // Different user
          }
        ]
      }
    });

    render(<CommentSection targetUserId={1} commenterId={2} />);

    await waitFor(() => {
      expect(screen.getByText('Great memories!')).toBeInTheDocument();
    });

    const editButtons = screen.queryAllByRole('button', { name: /Edit/i });
    const deleteButtons = screen.queryAllByRole('button', { name: /Delete/i });

    expect(editButtons).toHaveLength(0);
    expect(deleteButtons).toHaveLength(0);
  });
});
