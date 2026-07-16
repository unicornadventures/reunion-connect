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
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState<'then' | 'now' | null>(null);

  const isOwnPage = currentUser?.user_id === parseInt(userId || '0');
  // Class admins only ever reach this page for classmates (the profile fetch below
  // 403s otherwise), so this is safe to enable without a separate same-class check.
  const canManagePhotos = isOwnPage || !!currentUser?.is_admin || !!currentUser?.is_class_admin;

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

  const handlePhotoUpload = async (photoType: 'then' | 'now', file: File) => {
    if (!file || !canManagePhotos || !userId) return;
    setUploadingPhoto(photoType);
    try {
      const response = await api.post(`/users/${userId}/photo/${photoType}`, undefined, {
        params: { requesterId: currentUser?.user_id }
      });
      const { presignedUrl } = response.data;

      const putRes = await fetch(presignedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': 'image/jpeg' }
      });
      if (!putRes.ok) throw new Error(`S3 upload failed: ${putRes.status}`);

      await fetchUserProfileAndComments();
      setError(null);
    } catch (err: any) {
      setError(`Photo upload failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setUploadingPhoto(null);
    }
  };

  const handlePhotoDelete = async (photoType: 'then' | 'now') => {
    if (!canManagePhotos || !userId) return;
    setUploadingPhoto(photoType);
    try {
      await api.delete(`/users/${userId}/photo/${photoType}`, {
        params: { requesterId: currentUser?.user_id }
      });
      await fetchUserProfileAndComments();
      setError(null);
    } catch (err: any) {
      setError(`Photo delete failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setUploadingPhoto(null);
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

  const handleEditComment = async (commentId: number) => {
    if (!editText.trim()) return;
    try {
      const response = await api.put(`/comments/${commentId}`, {
        content: editText,
        requesterId: currentUser?.user_id
      });
      setComments(comments.map(c =>
        c.id === commentId ? { ...c, ...response.data.comment } : c
      ));
      setEditingCommentId(null);
      setEditText('');
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to edit comment.');
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      await api.delete(`/comments/${commentId}`, {
        params: { requesterId: currentUser?.user_id }
      });
      setComments(comments.filter(c => c.id !== commentId));
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete comment.');
    }
  };

  const handleDownload = () => {
    if (!userProfile) return;
    const { profile } = userProfile;
    const displayName = profile?.first_name
      ? `${profile.first_name} ${profile.last_name || ''}`
      : userProfile.user.email;
    const published = comments.filter(c => c.published);
    const lines = [
      `Comments for ${displayName}`,
      `Downloaded ${new Date().toLocaleDateString()}`,
      '',
      ...published.map(c => {
        const name = c.commenter_first_name
          ? `${c.commenter_first_name} ${c.commenter_last_name || ''}`.trim()
          : 'Anonymous';
        return `${name} — ${new Date(c.created_at).toLocaleDateString()}\n${c.content}\n`;
      })
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comments-${displayName.replace(/\s+/g, '-').toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
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

      <div className="bg-white rounded-lg border border-[#E2E8F0] p-8 mb-6">
        <h2 className="font-display text-3xl font-bold text-[#0E2240] uppercase tracking-tight mb-6">
          {displayName}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[
            { key: 'then' as const, label: 'Then', url: profile?.then_photo_url },
            { key: 'now' as const, label: 'Now', url: profile?.now_photo_url }
          ].map((photo) => (
            <div key={photo.key}>
              {canManagePhotos && (
                <input
                  type="file"
                  id={`comments-photo-${photo.key}`}
                  accept="image/*"
                  onChange={e => { const file = e.target.files?.[0]; if (file) handlePhotoUpload(photo.key, file); e.target.value = ''; }}
                  className="hidden"
                  disabled={uploadingPhoto !== null}
                />
              )}
              <label
                htmlFor={`comments-photo-${photo.key}`}
                style={{ cursor: canManagePhotos ? 'pointer' : 'default' }}
                className={`relative rounded-lg overflow-hidden bg-[#F6F8FC] border border-[#E2E8F0] block group ${canManagePhotos ? 'hover:opacity-80 transition-opacity' : ''}`}
              >
                <div className="absolute top-2 left-2 z-10 bg-[#0E2240]/80 px-2 py-0.5 rounded">
                  <span className="font-display text-xs font-bold text-[#E8A93E] uppercase tracking-wide">{photo.label}</span>
                </div>
                {canManagePhotos && photo.url && (
                  <button
                    type="button"
                    onClick={e => { e.preventDefault(); e.stopPropagation(); handlePhotoDelete(photo.key); }}
                    disabled={uploadingPhoto !== null}
                    className="absolute top-2 right-2 z-10 w-7 h-7 bg-black/60 text-white rounded-full text-sm font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border-none disabled:cursor-not-allowed"
                  >
                    ×
                  </button>
                )}
                {photo.url ? (
                  <img src={photo.url} alt={photo.label} className="w-full h-72 object-cover" />
                ) : (
                  <div className="h-72 flex items-center justify-center">
                    <span className="text-sm text-[#94A3B8]">
                      {uploadingPhoto === photo.key ? 'Uploading...' : canManagePhotos ? 'Click to add photo' : 'No photo'}
                    </span>
                  </div>
                )}
              </label>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-[#FFEBEE] text-[#C62828] border border-[#EF5350] rounded px-4 py-3 text-sm mb-5">{error}</div>
      )}

      <div className="bg-white rounded-lg border border-[#E2E8F0] p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-xl font-bold text-[#0E2240] uppercase tracking-tight">
            Comments ({comments.length})
          </h3>
          {isOwnPage && comments.some(c => c.published) && (
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 text-xs font-semibold border border-[#E2E8F0] text-[#64748B] rounded hover:bg-[#F6F8FC] transition-colors cursor-pointer bg-white"
            >
              Download .txt
            </button>
          )}
        </div>

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

        {comments.length === 0 ? (
          <div className="py-10 text-center text-[#94A3B8] text-sm bg-[#F6F8FC] rounded-lg border border-[#E2E8F0]">
            No comments yet. Be the first to leave one!
          </div>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => {
              const isAuthor = comment.commenter_id === currentUser?.user_id;
              const commenterName = comment.commenter_first_name
                ? `${comment.commenter_first_name} ${comment.commenter_last_name || ''}`.trim()
                : null;
              const isEditing = editingCommentId === comment.id;

              return (
                <div
                  key={comment.id}
                  className={`rounded-lg border p-4 ${!comment.published ? 'bg-[#FFF8EE] border-[#E8A93E]/40' : 'bg-white border-[#E2E8F0]'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {commenterName && (
                        <span className="text-xs font-semibold text-[#0E2240]">{commenterName}</span>
                      )}
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
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isAuthor && !isEditing && (
                        <>
                          <button
                            onClick={() => { setEditingCommentId(comment.id); setEditText(comment.content); }}
                            className="px-2 py-1 rounded text-xs font-semibold border border-[#E2E8F0] text-[#64748B] hover:bg-[#F6F8FC] cursor-pointer bg-white transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            className="px-2 py-1 rounded text-xs font-semibold bg-[#FFEBEE] text-[#C62828] hover:opacity-80 cursor-pointer border-none transition-opacity"
                          >
                            Delete
                          </button>
                        </>
                      )}
                      {isCanModerate && !isEditing && (
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
                  </div>

                  {isEditing ? (
                    <div>
                      <textarea
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        className="w-full min-h-20 px-3 py-2 border border-[#E2E8F0] rounded text-sm resize-vertical mb-2 focus:outline-none focus:border-[#E8A93E] focus:ring-1 focus:ring-[#E8A93E] transition-colors"
                        autoFocus
                      />
                      <div className="flex gap-2 items-center">
                        <button
                          onClick={() => handleEditComment(comment.id)}
                          disabled={!editText.trim()}
                          className="px-3 py-1 text-xs font-semibold bg-[#0E2240] text-white rounded hover:opacity-90 cursor-pointer border-none disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => { setEditingCommentId(null); setEditText(''); }}
                          className="px-3 py-1 text-xs font-semibold border border-[#E2E8F0] text-[#64748B] rounded hover:bg-[#F6F8FC] cursor-pointer bg-white"
                        >
                          Cancel
                        </button>
                        <span className="text-[10px] text-[#94A3B8]">Edits require re-approval</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-[#64748B] leading-relaxed break-words">{comment.content}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserCommentsPage;
