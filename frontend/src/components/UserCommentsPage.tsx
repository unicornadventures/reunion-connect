import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userId) {
      fetchUserProfileAndComments();
    }
  }, [userId]);

  const fetchUserProfileAndComments = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      // Fetch user profile
      const profileResponse = await api.get(`/users/${userId}`);
      setUserProfile(profileResponse.data);

      // Fetch comments on this user's profile (only published)
      const commentsResponse = await api.get(`/users/${userId}/comments`);
      const publishedComments = (commentsResponse.data.comments || []).filter(
        (c: Comment) => c.published
      );
      setComments(publishedComments);
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

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.spinner}>Loading profile...</div>
      </div>
    );
  }

  if (error || !userProfile) {
    return (
      <div style={styles.container}>
        <button onClick={() => navigate('/directory')} style={styles.backButton}>
          ← Back to Directory
        </button>
        <div style={styles.error}>{error || 'User not found.'}</div>
      </div>
    );
  }

  const { user, profile } = userProfile;
  const displayName = profile?.first_name
    ? `${profile.first_name} ${profile.last_name || ''}`
    : user.email;

  return (
    <div style={styles.container}>
      <button onClick={() => navigate('/directory')} style={styles.backButton}>
        ← Back to Directory
      </button>

      {/* User Profile Header */}
      <div style={styles.profileHeader}>
        <h2 style={styles.title}>{displayName}</h2>

        {/* Photos Section */}
        <div style={styles.photosSection}>
          <div style={styles.photoCard}>
            <h4 style={styles.photoLabel}>Then</h4>
            {profile?.then_photo_url ? (
              <img
                src={profile.then_photo_url}
                alt="Then"
                style={styles.profilePhoto}
              />
            ) : (
              <div style={styles.photoPlaceholder}>No photo</div>
            )}
          </div>

          <div style={styles.photoCard}>
            <h4 style={styles.photoLabel}>Now</h4>
            {profile?.now_photo_url ? (
              <img
                src={profile.now_photo_url}
                alt="Now"
                style={styles.profilePhoto}
              />
            ) : (
              <div style={styles.photoPlaceholder}>No photo</div>
            )}
          </div>
        </div>
      </div>

      {/* Comments Section */}
      <div style={styles.commentsSection}>
        <h3 style={styles.commentsTitle}>💬 Comments ({comments.length})</h3>

        {comments.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyText}>
              No comments yet. Be the first to leave a comment!
            </p>
          </div>
        ) : (
          <div style={styles.commentsList}>
            {comments.map((comment) => (
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
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
                <p style={styles.commentContent}>{comment.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '20px',
    maxWidth: '900px',
    margin: '0 auto',
  },
  backButton: {
    marginBottom: '20px',
    padding: '10px 20px',
    backgroundColor: '#2196F3',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold' as const,
  },
  profileHeader: {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '8px',
    marginBottom: '30px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #e0e0e0',
  },
  title: {
    margin: '0 0 20px 0',
    color: '#333',
    fontSize: '28px',
    fontWeight: 'bold' as const,
  },
  photosSection: {
    display: 'grid' as const,
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' as const,
    gap: '20px',
  },
  photoCard: {
    backgroundColor: '#f9f9f9',
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '15px',
    textAlign: 'center' as const,
  },
  photoLabel: {
    margin: '0 0 15px 0',
    fontSize: '16px',
    fontWeight: 'bold' as const,
    color: '#333',
  },
  profilePhoto: {
    maxWidth: '100%',
    maxHeight: '300px',
    borderRadius: '4px',
  },
  photoPlaceholder: {
    height: '300px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e0e0e0',
    borderRadius: '4px',
    color: '#999',
  },
  commentsSection: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #e0e0e0',
  },
  commentsTitle: {
    margin: '0 0 20px 0',
    color: '#333',
    fontSize: '18px',
    fontWeight: 'bold' as const,
  },
  commentsList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '15px',
  },
  commentCard: {
    backgroundColor: '#f9f9f9',
    padding: '15px',
    borderRadius: '8px',
    border: '1px solid #e0e0e0',
  },
  commentHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '10px',
  },
  commenterName: {
    margin: '0 0 5px 0',
    color: '#333',
    fontSize: '14px',
    fontWeight: 'bold' as const,
  },
  commentDate: {
    fontSize: '12px',
    color: '#999',
  },
  commentContent: {
    margin: '10px 0 0 0',
    color: '#555',
    lineHeight: '1.6',
    wordBreak: 'break-word' as const,
  },
  emptyState: {
    padding: '40px 20px',
    textAlign: 'center' as const,
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
    border: '1px solid #ddd',
  },
  emptyText: {
    color: '#999',
    margin: 0,
    fontSize: '14px',
  },
  error: {
    padding: '12px',
    backgroundColor: '#ffebee',
    color: '#c62828',
    borderRadius: '4px',
    marginBottom: '15px',
    border: '1px solid #ef5350',
    fontSize: '14px',
  },
  spinner: {
    padding: '40px',
    textAlign: 'center' as const,
    color: '#999',
    fontSize: '16px',
  },
};

export default UserCommentsPage;
