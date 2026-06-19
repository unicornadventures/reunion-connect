import React, { useState, useEffect } from 'react';
import api from '../api';
import { Comment } from '../types';

interface CommentSectionProps {
  targetUserId: number | string;
  commenterId: number | string;
}

const CommentSection: React.FC<CommentSectionProps> = ({ targetUserId, commenterId }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');

  const fetchComments = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/users/${targetUserId}/comments`);
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
    fetchComments();
  }, [targetUserId]);

  const handleAddComment = async () => {
    if (!newCommentText.trim()) {
      setError('Comment cannot be empty.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post(`/users/${targetUserId}/comments`, {
        commenterId,
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

  const handleDeleteComment = async (commentId: number) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) {
      return;
    }

    try {
      await api.delete(`/comments/${commentId}`);
      setComments(comments.filter(c => c.id !== commentId));
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete comment.');
    }
  };

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>💬 Comments ({comments.length})</h3>

      {error && <div style={styles.error}>{error}</div>}

      {/* New Comment Form */}
      <div style={styles.newCommentSection}>
        <h4 style={styles.formTitle}>Leave a Comment</h4>
        <textarea
          value={newCommentText}
          onChange={(e) => setNewCommentText(e.target.value)}
          placeholder="Share your thoughts..."
          style={styles.textarea}
          disabled={submitting}
        />
        <button
          onClick={handleAddComment}
          disabled={submitting || !newCommentText.trim()}
          style={{
            ...styles.button,
            backgroundColor: submitting || !newCommentText.trim() ? '#ccc' : '#4CAF50',
            cursor: submitting || !newCommentText.trim() ? 'not-allowed' : 'pointer'
          }}
        >
          {submitting ? 'Posting...' : 'Post Comment'}
        </button>
      </div>

      {/* Comments List */}
      <div style={styles.commentsList}>
        {loading ? (
          <div style={styles.spinner}>Loading comments...</div>
        ) : comments.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyText}>No comments yet. Be the first to comment!</p>
          </div>
        ) : (
          comments.map(comment => (
            <div key={comment.id} style={styles.commentCard}>
              <div style={styles.commentHeader}>
                <div>
                  <h5 style={styles.commenterName}>
                    {comment.first_name && comment.last_name
                      ? `${comment.first_name} ${comment.last_name}`
                      : 'Anonymous'}
                  </h5>
                  <span style={styles.commentDate}>
                    {new Date(comment.created_at).toLocaleDateString()} at{' '}
                    {new Date(comment.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>

              {editingId === comment.id ? (
                <div style={styles.editForm}>
                  <textarea
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    style={styles.editTextarea}
                    disabled={submitting}
                  />
                  <div style={styles.editActions}>
                    <button
                      onClick={() => handleUpdateComment(comment.id)}
                      disabled={submitting}
                      style={{
                        ...styles.smallButton,
                        backgroundColor: '#4CAF50',
                        cursor: submitting ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {submitting ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setEditingText('');
                      }}
                      style={{
                        ...styles.smallButton,
                        backgroundColor: '#999'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p style={styles.commentContent}>{comment.content}</p>

                  {/* Only show edit/delete if this is the commenter's comment */}
                  {parseInt(String(commenterId)) === comment.commenter_id && (
                    <div style={styles.commentActions}>
                      <button
                        onClick={() => {
                          setEditingId(comment.id);
                          setEditingText(comment.content);
                        }}
                        style={{
                          ...styles.actionButton,
                          color: '#2196F3'
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        style={{
                          ...styles.actionButton,
                          color: '#f44336'
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '20px',
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
    border: '1px solid #e0e0e0'
  },
  title: {
    marginTop: 0,
    marginBottom: '20px',
    color: '#333',
    fontSize: '18px',
    fontWeight: 'bold'
  },
  newCommentSection: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '20px',
    border: '1px solid #ddd'
  },
  formTitle: {
    margin: '0 0 15px 0',
    color: '#333',
    fontSize: '16px'
  },
  textarea: {
    width: '100%',
    minHeight: '100px',
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    fontFamily: 'inherit',
    resize: 'vertical',
    boxSizing: 'border-box' as const,
    marginBottom: '10px'
  },
  editTextarea: {
    width: '100%',
    minHeight: '80px',
    padding: '12px',
    border: '1px solid #4CAF50',
    borderRadius: '4px',
    fontSize: '14px',
    fontFamily: 'inherit',
    resize: 'vertical',
    boxSizing: 'border-box' as const,
    marginBottom: '10px'
  },
  button: {
    padding: '10px 20px',
    border: 'none',
    borderRadius: '4px',
    color: 'white',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'opacity 0.2s'
  },
  smallButton: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: '4px',
    color: 'white',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontSize: '12px',
    marginRight: '8px'
  },
  commentsList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '15px'
  },
  commentCard: {
    backgroundColor: 'white',
    padding: '15px',
    borderRadius: '8px',
    border: '1px solid #e0e0e0',
    transition: 'box-shadow 0.2s'
  },
  commentHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '10px'
  },
  commenterName: {
    margin: '0 0 5px 0',
    color: '#333',
    fontSize: '14px',
    fontWeight: 'bold'
  },
  commentDate: {
    fontSize: '12px',
    color: '#999'
  },
  commentContent: {
    margin: '10px 0',
    color: '#555',
    lineHeight: '1.6',
    wordBreak: 'break-word' as const
  },
  commentActions: {
    display: 'flex',
    gap: '15px',
    marginTop: '10px'
  },
  actionButton: {
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold',
    padding: 0,
    transition: 'opacity 0.2s'
  },
  editForm: {
    backgroundColor: '#f9f9f9',
    padding: '10px',
    borderRadius: '4px',
    marginTop: '10px'
  },
  editActions: {
    display: 'flex',
    gap: '10px'
  },
  spinner: {
    padding: '20px',
    textAlign: 'center' as const,
    color: '#999',
    fontSize: '14px'
  },
  emptyState: {
    padding: '40px 20px',
    textAlign: 'center' as const,
    backgroundColor: 'white',
    borderRadius: '8px',
    border: '1px solid #ddd'
  },
  emptyText: {
    color: '#999',
    margin: 0,
    fontSize: '14px'
  },
  error: {
    padding: '12px',
    backgroundColor: '#ffebee',
    color: '#c62828',
    borderRadius: '4px',
    marginBottom: '15px',
    border: '1px solid #ef5350',
    fontSize: '14px'
  }
};

export default CommentSection;