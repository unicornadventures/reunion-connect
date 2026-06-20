import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import api from '../api';
import { Comment } from '../types';
import ConfirmModal from './ConfirmModal';

const CommentSection: React.FC = () => {
  const { currentUser } = useAppContext();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: number | null }>({ isOpen: false, id: null });

  const fetchComments = async () => {
    if (!currentUser?.user_id) return;

    setLoading(true);
    try {
      const response = await api.get(`/comments/my-comments/${currentUser.user_id}`);
      setComments(response.data.comments || []);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load comments.');
      setComments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser?.user_id) {
      fetchComments();
    }
  }, [currentUser?.user_id]);

  const handleAddComment = async () => {
    if (!newCommentText.trim()) {
      setError('Comment cannot be empty.');
      return;
    }

    if (!currentUser?.user_id) {
      setError('User not authenticated.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post(`/users/${currentUser.user_id}/comments`, {
        commenterId: currentUser.user_id,
        content: newCommentText
      });

      setComments([response.data.comment, ...comments]);
      setNewCommentText('');
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to post comment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateComment = async (commentId: number) => {
    if (!editingText.trim()) {
      setError('Comment cannot be empty.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.put(`/comments/${commentId}`, {
        content: editingText
      });

      setComments(comments.map(c => c.id === commentId ? response.data.comment : c));
      setEditingId(null);
      setEditingText('');
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update comment.');
    } finally {
      setSubmitting(false);
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
    try {
      await api.delete(`/comments/${commentId}`);
      setComments(comments.filter(c => c.id !== commentId));
      setError(null);
      closeDeleteModal();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete comment.');
    }
  };

  return (
    <div className="p-5 bg-[#f9f9f9] rounded-lg border border-[#e0e0e0]">
      <h3 className="mt-0 mb-5 text-[#333] text-lg font-bold">💬 My Comments ({comments.length})</h3>

      {error && (
        <div className="px-3 py-3 bg-[#FFEBEE] text-[#C62828] rounded border border-[#EF5350] mb-4 text-sm">
          {error}
        </div>
      )}

      {/* New Comment Form */}
      <div className="bg-white p-5 rounded-lg mb-5 border border-[#ddd]">
        <h4 className="m-0 mb-4 text-[#333] text-base">Add a Comment to Your Profile</h4>
        <textarea
          value={newCommentText}
          onChange={(e) => setNewCommentText(e.target.value)}
          placeholder="Share your thoughts..."
          className="w-full min-h-[100px] p-3 border border-[#ddd] rounded text-sm resize-vertical mb-3 disabled:bg-gray-100"
          disabled={submitting}
        />
        <button
          onClick={handleAddComment}
          disabled={submitting || !newCommentText.trim()}
          className={`px-5 py-2 border-none rounded text-white font-bold text-sm transition-opacity ${
            submitting || !newCommentText.trim()
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-[#4CAF50] cursor-pointer hover:opacity-90'
          }`}
        >
          {submitting ? 'Posting...' : 'Post Comment'}
        </button>
      </div>

      {/* Comments List */}
      <div className="flex flex-col gap-4">
        {loading ? (
          <div className="p-5 text-center text-[#999] text-sm">Loading comments...</div>
        ) : comments.length === 0 ? (
          <div className="p-10 text-center bg-white rounded-lg border border-[#ddd]">
            <p className="text-[#999] m-0 text-sm">
              You haven't posted any comments yet. Add one to get started!
            </p>
          </div>
        ) : (
          comments.map(comment => (
            <div
              key={comment.id}
              className="bg-white p-4 rounded-lg border border-[#e0e0e0] transition-shadow hover:shadow-md"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs text-[#999]">
                  {new Date(comment.created_at).toLocaleDateString()} at{' '}
                  {new Date(comment.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>

              {editingId === comment.id ? (
                <div className="bg-[#f9f9f9] p-2 rounded-lg mt-3">
                  <textarea
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    className="w-full min-h-20 p-3 border border-[#4CAF50] rounded text-sm resize-vertical mb-3 disabled:bg-gray-100"
                    disabled={submitting}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdateComment(comment.id)}
                      disabled={submitting}
                      className="px-4 py-2 bg-[#4CAF50] text-white border-none rounded text-xs font-bold cursor-pointer hover:opacity-90 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      {submitting ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setEditingText('');
                      }}
                      className="px-4 py-2 bg-[#999] text-white border-none rounded text-xs font-bold cursor-pointer hover:opacity-90"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="m-2.5 text-[#555] leading-relaxed break-words">{comment.content}</p>

                  <div className="flex gap-4 mt-2.5">
                    <button
                      onClick={() => {
                        setEditingId(comment.id);
                        setEditingText(comment.content);
                      }}
                      className="border-none bg-none cursor-pointer text-xs font-bold text-[#2196F3] p-0 transition-opacity hover:opacity-70"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => openDeleteModal(comment.id)}
                      className="border-none bg-none cursor-pointer text-xs font-bold text-[#f44336] p-0 transition-opacity hover:opacity-70"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>

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

export default CommentSection;