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
    if (currentUser?.user_id) fetchComments();
  }, [currentUser?.user_id]);

  const handleAddComment = async () => {
    if (!newCommentText.trim()) { setError('Comment cannot be empty.'); return; }
    if (!currentUser?.user_id) { setError('User not authenticated.'); return; }

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
    if (!editingText.trim()) { setError('Comment cannot be empty.'); return; }
    setSubmitting(true);
    try {
      const response = await api.put(`/comments/${commentId}`, { content: editingText, requesterId: currentUser?.user_id });
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

  const handleDeleteComment = async () => {
    if (deleteModal.id === null) return;
    const commentId = deleteModal.id;
    try {
      await api.delete(`/comments/${commentId}`, {
        params: { requesterId: currentUser?.user_id }
      });
      setComments(comments.filter(c => c.id !== commentId));
      setError(null);
      setDeleteModal({ isOpen: false, id: null });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete comment.');
    }
  };

  const inputClass = 'w-full border border-[#E2E8F0] rounded text-sm focus:outline-none focus:border-[#E8A93E] focus:ring-1 focus:ring-[#E8A93E] transition-colors disabled:bg-[#F6F8FC]';

  return (
    <div className="bg-[#F6F8FC] rounded-lg border border-[#E2E8F0] p-6">
      <h3 className="font-display text-xl font-bold text-[#0E2240] uppercase tracking-tight mb-5">
        My Comments ({comments.length})
      </h3>

      {error && (
        <div className="bg-[#FFEBEE] text-[#C62828] border border-[#EF5350] rounded px-4 py-3 text-sm mb-4">
          {error}
        </div>
      )}

      {/* New comment form */}
      <div className="bg-white rounded-lg border border-[#E2E8F0] p-5 mb-5">
        <h4 className="text-sm font-semibold text-[#0E2240] mb-3">Add a comment to your profile</h4>
        <textarea
          value={newCommentText}
          onChange={e => setNewCommentText(e.target.value)}
          placeholder="Share your thoughts..."
          className={`${inputClass} min-h-[100px] resize-vertical p-3 mb-3`}
          disabled={submitting}
        />
        <button
          onClick={handleAddComment}
          disabled={submitting || !newCommentText.trim()}
          className={`px-5 py-2 rounded text-sm font-semibold transition-opacity ${
            submitting || !newCommentText.trim()
              ? 'bg-[#E2E8F0] text-[#94A3B8] cursor-not-allowed'
              : 'bg-[#0E2240] text-white hover:opacity-90 cursor-pointer'
          }`}
        >
          {submitting ? 'Posting...' : 'Post comment'}
        </button>
      </div>

      {/* Comments list */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-5 text-center text-[#94A3B8] text-sm">Loading comments...</div>
        ) : comments.length === 0 ? (
          <div className="py-10 text-center bg-white rounded-lg border border-[#E2E8F0]">
            <p className="text-sm text-[#94A3B8]">You haven't posted any comments yet.</p>
          </div>
        ) : (
          comments.map(comment => (
            <div key={comment.id} className="bg-white rounded-lg border border-[#E2E8F0] p-4">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs text-[#94A3B8]">
                  {new Date(comment.created_at).toLocaleDateString()} at{' '}
                  {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {editingId === comment.id ? (
                <div className="mt-2">
                  <textarea
                    value={editingText}
                    onChange={e => setEditingText(e.target.value)}
                    className={`${inputClass} min-h-20 resize-vertical p-3 mb-3`}
                    disabled={submitting}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdateComment(comment.id)}
                      disabled={submitting}
                      className="px-4 py-2 bg-[#0E2240] text-white rounded text-xs font-semibold hover:opacity-90 disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] disabled:cursor-not-allowed transition-opacity cursor-pointer"
                    >
                      {submitting ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => { setEditingId(null); setEditingText(''); }}
                      className="px-4 py-2 bg-[#E2E8F0] text-[#64748B] rounded text-xs font-semibold hover:opacity-80 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-[#64748B] leading-relaxed break-words mt-1 mb-3">
                    {comment.content}
                  </p>
                  <div className="flex gap-4">
                    <button
                      onClick={() => { setEditingId(comment.id); setEditingText(comment.content); }}
                      className="text-xs font-semibold text-[#E8A93E] hover:opacity-70 bg-transparent border-none cursor-pointer p-0 transition-opacity"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteModal({ isOpen: true, id: comment.id })}
                      className="text-xs font-semibold text-[#f44336] hover:opacity-70 bg-transparent border-none cursor-pointer p-0 transition-opacity"
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
        onCancel={() => setDeleteModal({ isOpen: false, id: null })}
      />
    </div>
  );
};

export default CommentSection;
