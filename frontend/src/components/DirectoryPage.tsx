import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import api from '../api';

interface DirectoryUser {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  nickname_school: string | null;
  now_photo_url: string | null;
}

interface ClassInfo {
  id: number;
  year: number;
  school_id: number;
  school_name: string;
}

const DirectoryPage: React.FC = () => {
  const { currentUser } = useAppContext();
  const navigate = useNavigate();
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser?.user_id) {
      fetchClassAndUsers();
    }
  }, [currentUser?.user_id]);

  const fetchClassAndUsers = async () => {
    if (!currentUser?.user_id) return;

    setLoading(true);
    try {
      // Get user's class information
      const classResponse = await api.get(`/users/${currentUser.user_id}/class`);
      const userClass = classResponse.data.class;
      setClassInfo(userClass);

      // Get users in the same class (pass userId for validation)
      const usersResponse = await api.get(`/classes/${userClass.id}/directory`, {
        params: { userId: currentUser.user_id }
      });
      setUsers(usersResponse.data.users || []);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching directory:', err);
      setError(err.response?.data?.error || 'Failed to load directory.');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUserClick = (userId: number) => {
    navigate(`/user/${userId}`);
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.spinner}>Loading directory...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {classInfo && (
        <div style={styles.header}>
          <h2 style={styles.title}>📖 Class Directory</h2>
          <p style={styles.subtitle}>
            {classInfo.school_name} - Class of {classInfo.year}
          </p>
        </div>
      )}

      {error && <div style={styles.error}>{error}</div>}

      {users.length === 0 ? (
        <div style={styles.emptyState}>
          <p style={styles.emptyText}>No classmates found yet.</p>
        </div>
      ) : (
        <div style={styles.grid}>
          {users.map((user) => (
            <div
              key={user.id}
              style={styles.card}
              onClick={() => handleUserClick(user.id)}
            >
              <div style={styles.photoContainer}>
                {user.now_photo_url ? (
                  <img
                    src={user.now_photo_url}
                    alt={`${user.first_name} ${user.last_name}`}
                    style={styles.photo}
                  />
                ) : (
                  <div style={styles.photoPlaceholder}>No Photo</div>
                )}
              </div>

              <div style={styles.info}>
                <h4 style={styles.name}>
                  {user.first_name} {user.last_name}
                </h4>
                {user.nickname_school && (
                  <p style={styles.nickname}>"{user.nickname_school}"</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: '20px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  header: {
    marginBottom: '30px',
  },
  title: {
    margin: '0 0 10px 0',
    color: '#333',
    fontSize: '24px',
    fontWeight: 'bold' as const,
  },
  subtitle: {
    margin: 0,
    color: '#666',
    fontSize: '16px',
  },
  grid: {
    display: 'grid' as const,
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' as const,
    gap: '20px',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '8px',
    overflow: 'hidden',
    border: '1px solid #e0e0e0',
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  photoContainer: {
    width: '100%',
    height: '200px',
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  photo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e0e0e0',
    color: '#999',
    fontSize: '14px',
  },
  info: {
    padding: '15px',
  },
  name: {
    margin: '0 0 5px 0',
    color: '#333',
    fontSize: '16px',
    fontWeight: 'bold' as const,
  },
  nickname: {
    margin: 0,
    color: '#666',
    fontSize: '12px',
    fontStyle: 'italic',
  },
  spinner: {
    padding: '40px',
    textAlign: 'center' as const,
    color: '#999',
    fontSize: '16px',
  },
  emptyState: {
    padding: '40px 20px',
    textAlign: 'center' as const,
    backgroundColor: 'white',
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
};

export default DirectoryPage;
