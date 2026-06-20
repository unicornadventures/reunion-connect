import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import api from '../api';
import { Comment } from '../types';
import ConfirmModal from './ConfirmModal';

interface CommentWithProfile extends Comment {
  target_user_profile?: {
    first_name: string | null;
    last_name: string | null;
  };
}

const AdminCommentsPage: React.FC = () => {
  const { currentUser } = useAppContext();
  const [comments, setComments] = useState<CommentWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: number | null }>({ isOpen: false, id: null });

  useEffect(() => {
    fetchAllUnpublishedComments();
  }, []);

  const fetchAllUnpublishedComments = async () => {
    setLoading(true);
    try {
      // Fetch all users first to get their class info
      const usersResponse = await api.get('/admin/users');
      const users = usersResponse.data.users || [];

      // For each user, fetch their pending comments
      const allComments: CommentWithProfile[] = [];
      for (const user of users) {
        try {
          const commentsResponse = await api.get(`/users/${user.id}/comments/pending`, {
            params: { requesterId: currentUser?.user_id }
          });
          const userComments = commentsResponse.data.comments || [];
          userComments.forEach((comment: Comment) => {
            allComments.push({
              ...comment,
              target_user_profile: {
                first_name: user.first_name,
                last_name: user.last_name
              }
            });
          });
        } catch (err) {
          // Skip if error fetching comments for this user
          continue;
        }
      }

      // Filter to only unpublished comments and sort by date
      const unpublished = allComments
        .filter(c => !c.published)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setComments(unpublished);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching comments:', err);
      setError(err.response?.data?.error || 'Failed to load comments.');
    } finally {
      setLoading(false);
    }
  };

  const handlePublishComment = async (commentId: number) => {
    setActionLoading(commentId);
    try {
      await api.put(`/comments/${commentId}`, {
        published: true,
        requesterId: currentUser?.user_id
      });

      setComments(comments.filter(c => c.id !== commentId));
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to publish comment.');
    } finally {
      setActionLoading(null);
    }
  };

  const openDeleteModal = (commentId: number) => {
    setDeleteModal({ isOpen: true, id: commentId });
  };

  const closeDeleteModal = () => {
    setDeleteModal({ isOpen: false, id: null });
  };

  const handleDeleteComment = async () => {
    if (deleteModal.id === null) return;

    const commentId = deleteModal.id;
    setActionLoading(commentId);
    try {
      await api.delete(`/comments/${commentId}`);
      setComments(comments.filter(c => c.id !== commentId));
      setError(null);
      closeDeleteModal();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete comment.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="max-w-[900px] mx-auto px-5 py-8">
      <h1 className="text-3xl font-bold text-[#333] mb-2">💬 Pending Comments</h1>
      <p className="text-[#999] mb-6">Review and approve comments before they appear on user profiles</p>

      {error && (
        <div className="px-4 py-3 bg-[#FFEBEE] text-[#C62828] rounded border border-[#EF5350] text-sm mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-[#999]">Loading comments...</div>
      ) : comments.length === 0 ? (
        <div className="py-12 text-center bg-[#f9f9f9] rounded-lg border border-[#ddd]">
          <div className="text-4xl mb-4">✅</div>
          <p className="text-[#999]">All comments have been reviewed!</p>
          <p className="text-sm text-[#ccc] mt-2">No pending comments to moderate.</p>
        </div>
      ) : (
        <div className="space-y-4 max-h-[calc(100vh-250px)] overflow-y-auto">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="bg-white p-5 rounded-lg border border-[#FFB74D] shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-[#333]">
                      Profile: {comment.target_user_profile?.first_name} {comment.target_user_profile?.last_name}
                    </span>
                    <span className="px-2 py-0.5 bg-[#FF6F00] text-white text-xs font-bold rounded">
                      Pending Review
                    </span>
                  </div>
                  <span className="text-xs text-[#999]">
                    {new Date(comment.created_at).toLocaleDateString()} at{' '}
                    {new Date(comment.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>

              <div className="bg-[#F5F5F5] p-4 rounded-lg mb-4 border border-[#E0E0E0]">
                <p className="text-[#555] leading-relaxed break-words">{comment.content}</p>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => openDeleteModal(comment.id)}
                  disabled={actionLoading === comment.id}
                  className={`px-4 py-2 rounded text-sm font-bold border-none cursor-pointer transition-opacity ${
                    actionLoading === comment.id
                      ? 'bg-gray-300 text-[#666] cursor-not-allowed'
                      : 'bg-[#f44336] text-white hover:opacity-90'
                  }`}
                >
                  {actionLoading === comment.id ? 'Deleting...' : 'Delete'}
                </button>
                <button
                  onClick={() => handlePublishComment(comment.id)}
                  disabled={actionLoading === comment.id}
                  className={`px-4 py-2 rounded text-sm font-bold border-none cursor-pointer transition-opacity ${
                    actionLoading === comment.id
                      ? 'bg-gray-300 text-[#666] cursor-not-allowed'
                      : 'bg-[#4CAF50] text-white hover:opacity-90'
                  }`}
                >
                  {actionLoading === comment.id ? 'Publishing...' : 'Publish'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        title="Delete Comment"
        message="Are you sure you want to delete this comment? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        isDangerous={true}
        onConfirm={handleDeleteComment}
        onCancel={closeDeleteModal}
      />
    </div>
  );
};

export default AdminCommentsPage;
