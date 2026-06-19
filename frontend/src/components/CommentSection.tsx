import React, { useState, useEffect } from 'react';
import api from '@/api';

const API_BASE_URL = 'http://localhost:3001/api';

interface Comment {
  comment_id: number;
  target_user_id: number;
  commenter_id: number;
  content: string;
  is_published: boolean;
  created_at: string;
  commenter_first_name: string;
  commenter_last_name: string;
}

interface CommentSectionProps {
  targetUserId: number | string; // ID of the user being commented on
  commenterId: number | string; // ID of the currently logged-in user
}

const CommentSection: React.FC<CommentSectionProps> = ({ targetUserId, commenterId }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentContent, setNewCommentContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchComments = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/comments/${targetUserId}`);
      setComments(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load comments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [targetUserId]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentContent.trim()) return;

    try {
      await api.post(`/comments`, {
        target_user_id: targetUserId,
        commenter_id: commenterId,
        content: newCommentContent,
      });
      
      // Clear form and refresh list
      setNewCommentContent('');
      fetchComments();

    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to post comment.');
    }
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading comments...</div>;
  if (error) return <div style={{ padding: '20px', color: 'red' }}>Error: {error}</div>;

  return (
    <div style={{ padding: '20px', borderTop: '1px solid #eee', marginTop: '30px' }}>
      <h3 style={{ color: '#4CAF50' }}>Comments ({comments.length})</h3>
      
      {/* Comment Form */}
      <form onSubmit={handleSubmitComment} style={{ marginBottom: '20px' }}>
        <textarea
          placeholder="Write a comment..."
          value={newCommentContent}
          onChange={(e) => setNewCommentContent(e.target.value)}
          required
          style={{ width: '100%', minHeight: '80px', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
        />
        <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#1E88E5', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '10px' }}>
          Post Comment
        </button>
      </form>

      {/* Comment List */}
      <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #eee', padding: '10px' }}>
        {comments.length === 0 && <p>No comments yet.</p>}
        {comments.map((comment) => (
          <div key={comment.comment_id} style={{ borderBottom: '1px solid #f0f0f0', padding: '10px 0' }}>
            <p>
              <strong>{comment.commenter_first_name} {comment.commenter_last_name}</strong> posted on {new Date(comment.created_at).toLocaleDateString()}:
              <br/>
              {comment.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CommentSection;