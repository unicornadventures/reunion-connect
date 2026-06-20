import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import api from '../api';
import { Comment } from '../types';

interface UserProfile {
  user: {
    id: number;
    email: string;
  };
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
    if (userId && currentUser?.user_id) {
      fetchUserProfileAndComments();
    }
  }, [userId, currentUser?.user_id]);

  const fetchUserProfileAndComments = async () => {
    if (!userId || !currentUser?.user_id) return;

    setLoading(true);
    try {
      // Fetch user profile with access validation
      const profileResponse = await api.get(`/users/${userId}`, {
        params: { requesterId: currentUser.user_id }
      });
      setUserProfile(profileResponse.data);

      // Check if user is the profile owner or an admin
      const canModerate = currentUser.user_id === parseInt(userId) || currentUser.is_admin;
      setIsCanModerate(canModerate);

      // Fetch all comments if can moderate, otherwise just published
      let allComments: Comment[] = [];
      if (canModerate) {
        try {
          const pendingResponse = await api.get(`/users/${userId}/comments/pending`, {
            params: { requesterId: currentUser.user_id }
          });
          allComments = pendingResponse.data.comments || [];
        } catch {
          // Fall back to published-only if pending endpoint fails
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
      console.error('Error fetching user profile and comments:', err);
      setError(err.response?.data?.error || 'Failed to load user profile.');
      setUserProfile(null);
      setComments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newCommentText.trim()) {
      setError('Comment cannot be empty.');
      return;
    }

    if (!currentUser?.user_id || !userId) {
      setError('User not authenticated.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post(`/users/${userId}/comments`, {
        commenterId: currentUser.user_id,
        content: newCommentText
      });

      // Add comment to the list (it will be published after admin approval)
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
        <div className="py-10 text-center text-[#999] text-base">Loading profile...</div>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="max-w-[900px] mx-auto px-5 py-8">
        <button
          onClick={() => navigate('/directory')}
          className="mb-5 px-5 py-2 bg-[#2196F3] text-white border-none rounded text-sm font-bold cursor-pointer hover:opacity-90"
        >
          ← Back to Directory
        </button>
        <div className="px-3 py-3 bg-[#FFEBEE] text-[#C62828] rounded border border-[#EF5350] text-sm">
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
      <button
        onClick={() => navigate('/directory')}
        className="mb-5 px-5 py-2 bg-[#2196F3] text-white border-none rounded text-sm font-bold cursor-pointer hover:opacity-90"
      >
        ← Back to Directory
      </button>

      {/* User Profile Header */}
      <div className="bg-white p-8 rounded-lg mb-8 shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-[#e0e0e0]">
        <h2 className="m-0 mb-5 text-[#333] text-3xl font-bold">{displayName}</h2>

        {/* Photos Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-[#f9f9f9] border border-[#ddd] rounded-lg p-4 text-center">
            <h4 className="m-0 mb-4 text-base font-bold text-[#333]">Then</h4>
            {profile?.then_photo_url ? (
              <img
                src={profile.then_photo_url}
                alt="Then"
                className="max-w-full max-h-80 rounded"
              />
            ) : (
              <div className="h-80 flex items-center justify-center bg-[#e0e0e0] rounded text-[#999]">
                No photo
              </div>
            )}
          </div>

          <div className="bg-[#f9f9f9] border border-[#ddd] rounded-lg p-4 text-center">
            <h4 className="m-0 mb-4 text-base font-bold text-[#333]">Now</h4>
            {profile?.now_photo_url ? (
              <img
                src={profile.now_photo_url}
                alt="Now"
                className="max-w-full max-h-80 rounded"
              />
            ) : (
              <div className="h-80 flex items-center justify-center bg-[#e0e0e0] rounded text-[#999]">
                No photo
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="px-3 py-3 bg-[#FFEBEE] text-[#C62828] rounded border border-[#EF5350] text-sm mb-5">
          {error}
        </div>
      )}

      {/* Comments Section */}
      <div className="bg-white p-5 rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-[#e0e0e0]">
        <h3 className="m-0 mb-5 text-[#333] text-lg font-bold">💬 Comments ({comments.length})</h3>

        {/* New Comment Form */}
        <div className="bg-[#f9f9f9] p-4 rounded-lg mb-5 border border-[#e0e0e0]">
          <h4 className="m-0 mb-3 text-[#333] text-sm font-bold">Leave a Comment</h4>
          <textarea
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            placeholder="Share your message..."
            className="w-full min-h-24 p-3 border border-[#ddd] rounded text-sm resize-vertical mb-3 disabled:bg-gray-100"
            disabled={submitting}
          />
          <button
            onClick={handleAddComment}
            disabled={submitting || !newCommentText.trim()}
            className={`px-4 py-2 border-none rounded text-white font-bold text-sm transition-opacity ${
              submitting || !newCommentText.trim()
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-[#4CAF50] cursor-pointer hover:opacity-90'
            }`}
          >
            {submitting ? 'Posting...' : 'Post Comment'}
          </button>
          <p className="text-xs text-[#999] mt-2">Comments will be published after review.</p>
        </div>

        {/* Comments List */}
        {comments.length === 0 ? (
          <div className="p-10 text-center bg-[#f9f9f9] rounded-lg border border-[#ddd]">
            <p className="text-[#999] m-0 text-sm">
              No comments yet. Be the first to leave a comment!
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className={`p-4 rounded-lg border ${
                  !comment.published
                    ? 'bg-[#FFF3E0] border-[#FFB74D]'
                    : 'bg-[#f9f9f9] border-[#e0e0e0]'
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#999]">
                      {new Date(comment.created_at).toLocaleDateString()} at{' '}
                      {new Date(comment.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {!comment.published && (
                      <span className="px-2 py-0.5 bg-[#FF6F00] text-white text-xs font-bold rounded">
                        Pending Review
                      </span>
                    )}
                  </div>
                  {isCanModerate && (
                    <button
                      onClick={() => handlePublishComment(comment.id, !comment.published)}
                      className={`px-3 py-1 rounded text-xs font-bold border-none cursor-pointer transition-opacity ${
                        comment.published
                          ? 'bg-[#FFA726] text-white hover:opacity-90'
                          : 'bg-[#4CAF50] text-white hover:opacity-90'
                      }`}
                    >
                      {comment.published ? 'Unpublish' : 'Publish'}
                    </button>
                  )}
                </div>
                <p className="m-0 text-[#555] leading-relaxed break-words">{comment.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserCommentsPage;
