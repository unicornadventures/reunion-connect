import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import api from '../api';
import { Comment } from '../types';

interface UserProfile {
  user: { id: number; email: string };
  profile: {
    first_name: string | null;
    last_name: string | null;
    then_photo_url: string | null;
    now_photo_url: string | null;
  };
}

const UserCommentsPage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { currentUser } = useAppContext();
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isCanModerate, setIsCanModerate] = useState(false);

  useEffect(() => {
    if (userId && currentUser?.user_id) fetchUserProfileAndComments();
  }, [userId, currentUser?.user_id]);

  const fetchUserProfileAndComments = async () => {
    if (!userId || !currentUser?.user_id) return;
    setLoading(true);
    try {
      const profileResponse = await api.get(`/users/${userId}`, {
        params: { requesterId: currentUser.user_id }
      });
      setUserProfile(profileResponse.data);

      const canModerate = currentUser.user_id === parseInt(userId) || currentUser.is_admin;
      setIsCanModerate(canModerate);

      let allComments: Comment[] = [];
      if (canModerate) {
        try {
          const pendingResponse = await api.get(`/users/${userId}/comments/pending`, {
            params: { requesterId: currentUser.user_id }
          });
          allComments = pendingResponse.data.comments || [];
        } catch {
          const commentsResponse = await api.get(`/users/${userId}/comments`);
          allComments = commentsResponse.data.comments || [];
        }
      } else {
        const commentsResponse = await api.get(`/users/${userId}/comments`);
        allComments = commentsResponse.data.comments || [];
      }

      setComments(allComments);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load user profile.');
      setUserProfile(null);
      setComments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newCommentText.trim()) { setError('Comment cannot be empty.'); return; }
    if (!currentUser?.user_id || !userId) { setError('User not authenticated.'); return; }

    setSubmitting(true);
    try {
      const response = await api.post(`/users/${userId}/comments`, {
        commenterId: currentUser.user_id,
        content: newCommentText
      });
      setComments([...comments, response.data.comment]);
      setNewCommentText('');
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to post comment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublishComment = async (commentId: number, shouldPublish: boolean) => {
    try {
      const response = await api.put(`/comments/${commentId}`, {
        published: shouldPublish,
        requesterId: currentUser?.user_id
      });
      setComments(comments.map(c =>
        c.id === commentId ? { ...c, published: response.data.comment.published } : c
      ));
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update comment.');
    }
  };

  if (loading) {
    return (
      <div className="max-w-[900px] mx-auto px-5 py-8">
        <div className="text-center text-[#94A3B8] text-sm py-10">Loading profile...</div>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="max-w-[900px] mx-auto px-5 py-8">
        <button onClick={() => navigate('/directory')}
          className="mb-5 text-sm text-[#64748B] hover:text-[#0E2240] bg-transparent border-none cursor-pointer transition-colors">
          ← Back to Directory
        </button>
        <div className="bg-[#FFEBEE] text-[#C62828] border border-[#EF5350] rounded px-4 py-3 text-sm">
          {error || 'User not found.'}
        </div>
      </div>
    );
  }

  const { user, profile } = userProfile;
  const displayName = profile?.first_name
    ? `${profile.first_name} ${profile.last_name || ''}`
    : user.email;

  return (
    <div className="max-w-[900px] mx-auto px-5 py-8">
      <button onClick={() => navigate('/directory')}
        className="mb-6 text-sm text-[#64748B] hover:text-[#0E2240] bg-transparent border-none cursor-pointer transition-colors">
        ← Back to Directory
      </button>

      {/* Profile header */}
      <div className="bg-white rounded-lg border border-[#E2E8F0] p-8 mb-6">
        <h2 className="font-display text-3xl font-bold text-[#0E2240] uppercase tracking-tight mb-6">
          {displayName}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[
            { label: 'Then', url: profile?.then_photo_url },
            { label: 'Now', url: profile?.now_photo_url }
          ].map((photo) => (
            <div key={photo.label} className="relative rounded-lg overflow-hidden bg-[#F6F8FC] border border-[#E2E8F0]">
              <div className="absolute top-2 left-2 z-10 bg-[#0E2240]/80 px-2 py-0.5 rounded">
                <span className="font-display text-xs font-bold text-[#E8A93E] uppercase tracking-wide">
                  {photo.label}
                </span>
              </div>
              {photo.url ? (
                <img src={photo.url} alt={photo.label} className="w-full h-72 object-cover" />
              ) : (
                <div className="h-72 flex items-center justify-center">
                  <span className="text-sm text-[#94A3B8]">No photo</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-[#FFEBEE] text-[#C62828] border border-[#EF5350] rounded px-4 py-3 text-sm mb-5">
          {error}
        </div>
      )}

      {/* Comments section */}
      <div className="bg-white rounded-lg border border-[#E2E8F0] p-6">
        <h3 className="font-display text-xl font-bold text-[#0E2240] uppercase tracking-tight mb-5">
          Comments ({comments.length})
        </h3>

        {/* New comment form */}
        <div className="bg-[#F6F8FC] border border-[#E2E8F0] rounded-lg p-5 mb-6">
          <h4 className="text-sm font-semibold text-[#0E2240] mb-3">Leave a comment</h4>
          <textarea
            value={newCommentText}
            onChange={e => setNewCommentText(e.target.value)}
            placeholder="Share your message..."
            className="w-full min-h-24 px-3 py-3 border border-[#E2E8F0] rounded text-sm resize-vertical mb-3 focus:outline-none focus:border-[#E8A93E] focus:ring-1 focus:ring-[#E8A93E] disabled:bg-[#F6F8FC] transition-colors"
            disabled={submitting}
          />
          <div className="flex items-center gap-4">
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
            <p className="text-xs text-[#94A3B8]">Comments appear after review.</p>
          </div>
        </div>

        {/* Comments list */}
        {comments.length === 0 ? (
          <div className="py-10 text-center text-[#94A3B8] text-sm bg-[#F6F8FC] rounded-lg border border-[#E2E8F0]">
            No comments yet. Be the first to leave one!
          </div>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className={`rounded-lg border p-4 ${
                  !comment.published
                    ? 'bg-[#FFF8EE] border-[#E8A93E]/40'
                    : 'bg-white border-[#E2E8F0]'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#94A3B8]">
                      {new Date(comment.created_at).toLocaleDateString()} at{' '}
                      {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {!comment.published && (
                      <span className="px-2 py-0.5 bg-[#E8A93E] text-[#0E2240] text-[10px] font-bold uppercase tracking-wide rounded">
                        Pending
                      </span>
                    )}
                  </div>
                  {isCanModerate && (
                    <button
                      onClick={() => handlePublishComment(comment.id, !comment.published)}
                      className={`px-3 py-1 rounded text-xs font-semibold border-none cursor-pointer transition-opacity ${
                        comment.published
                          ? 'bg-[#E2E8F0] text-[#64748B] hover:opacity-80'
                          : 'bg-[#0E2240] text-white hover:opacity-90'
                      }`}
                    >
                      {comment.published ? 'Unpublish' : 'Publish'}
                    </button>
                  )}
                </div>
                <p className="text-sm text-[#64748B] leading-relaxed break-words">{comment.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserCommentsPage;
