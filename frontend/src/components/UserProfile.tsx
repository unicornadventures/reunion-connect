import React, { useState, useEffect } from 'react';
import api from '../api';
import { User, Profile } from '../types';

interface UserWithProfile {
  user: User;
  profile: Profile | null;
}

const UserProfile: React.FC<{ userId: number | string }> = ({ userId }) => {
  const [data, setData] = useState<UserWithProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState<'then' | 'now' | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Partial<Profile>>({});

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/users/${userId}`);
      setData(response.data);
      if (response.data.profile) {
        setEditData(response.data.profile);
      }
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  const handlePhotoUpload = async (photoType: 'then' | 'now', file: File) => {
    if (!file) return;

    setUploadingPhoto(photoType);
    try {
      // 1. Get presigned URL
      const presignedResponse = await api.post(`/users/${userId}/photo/upload/${photoType}`, {
        fileName: file.name
      });

      const presignedUrl = presignedResponse.data.presignedUrl;

      // 2. Upload to S3 using presigned URL
      await fetch(presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file
      });

      // 3. Update the profile with the photo URL
      const photoUrl = presignedUrl.split('?')[0]; // Get URL without query params
      const updateResponse = await api.put(`/users/${userId}/photo/${photoType}`, {
        photoUrl
      });

      setData(prev => prev ? { ...prev, profile: updateResponse.data.profile } : null);
      setError(null);
    } catch (err: any) {
      setError(`Photo upload failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setUploadingPhoto(null);
    }
  };

  const handleProfileUpdate = async () => {
    if (!data?.profile) return;

    setLoading(true);
    try {
      // Update profile
      const response = await api.put(`/users/${data.user.id}/profile`, editData);
      setData(prev => prev ? { ...prev, profile: response.data.profile } : null);
      setEditMode(false);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update profile.');
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

  if (error && !data) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>Error: {error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={styles.container}>
        <div style={styles.info}>User not found.</div>
      </div>
    );
  }

  const { user, profile } = data;
  const displayName = profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}` : user.email;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>{displayName}'s Profile</h2>
        <button
          onClick={() => setEditMode(!editMode)}
          style={{
            ...styles.button,
            backgroundColor: editMode ? '#f44336' : '#2196F3',
            cursor: 'pointer'
          }}
        >
          {editMode ? 'Cancel' : 'Edit Profile'}
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.content}>
        {/* Personal Information Section */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>📋 Personal Information</h3>
          <div style={styles.infoGrid}>
            <div style={styles.infoItem}>
              <label style={styles.label}>Email</label>
              <p style={styles.value}>{user.email}</p>
            </div>

            {profile && (
              <>
                <div style={styles.infoItem}>
                  <label style={styles.label}>First Name</label>
                  {editMode ? (
                    <input
                      type="text"
                      value={editData.first_name || ''}
                      onChange={(e) => setEditData({ ...editData, first_name: e.target.value })}
                      style={styles.input}
                    />
                  ) : (
                    <p style={styles.value}>{profile.first_name || 'Not provided'}</p>
                  )}
                </div>

                <div style={styles.infoItem}>
                  <label style={styles.label}>Last Name</label>
                  {editMode ? (
                    <input
                      type="text"
                      value={editData.last_name || ''}
                      onChange={(e) => setEditData({ ...editData, last_name: e.target.value })}
                      style={styles.input}
                    />
                  ) : (
                    <p style={styles.value}>{profile.last_name || 'Not provided'}</p>
                  )}
                </div>

                <div style={styles.infoItem}>
                  <label style={styles.label}>Nickname (School)</label>
                  {editMode ? (
                    <input
                      type="text"
                      value={editData.nickname_school || ''}
                      onChange={(e) => setEditData({ ...editData, nickname_school: e.target.value })}
                      style={styles.input}
                    />
                  ) : (
                    <p style={styles.value}>{profile.nickname_school || 'Not provided'}</p>
                  )}
                </div>

                <div style={{ ...styles.infoItem, gridColumn: '1 / -1' }}>
                  <label style={styles.label}>Bio</label>
                  {editMode ? (
                    <textarea
                      value={editData.bio || ''}
                      onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                      style={{ ...styles.input, minHeight: '100px', resize: 'vertical' }}
                    />
                  ) : (
                    <p style={styles.value}>{profile.bio || 'No bio provided.'}</p>
                  )}
                </div>
              </>
            )}
          </div>

          {editMode && (
            <button
              onClick={handleProfileUpdate}
              disabled={loading}
              style={{
                ...styles.button,
                backgroundColor: '#4CAF50',
                marginTop: '15px',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>

        {/* Photo Section */}
        {profile && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>📸 Photos</h3>
            <div style={styles.photosGrid}>
              {/* Then Photo */}
              <div style={styles.photoCard}>
                <h4 style={styles.photoLabel}>School Photo (Then)</h4>
                {profile.then_photo_url ? (
                  <div style={styles.photoPreview}>
                    <img src={profile.then_photo_url} alt="Then" style={styles.photoImage} />
                    <p style={styles.photoText}>Photo uploaded ✓</p>
                  </div>
                ) : (
                  <div style={styles.photoPlaceholder}>No photo uploaded</div>
                )}
                <label style={styles.fileInputLabel}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files && handlePhotoUpload('then', e.target.files[0])}
                    style={styles.fileInput}
                    disabled={uploadingPhoto === 'then'}
                  />
                  <span style={styles.fileInputButton}>
                    {uploadingPhoto === 'then' ? 'Uploading...' : 'Choose File'}
                  </span>
                </label>
              </div>

              {/* Now Photo */}
              <div style={styles.photoCard}>
                <h4 style={styles.photoLabel}>Current Photo (Now)</h4>
                {profile.now_photo_url ? (
                  <div style={styles.photoPreview}>
                    <img src={profile.now_photo_url} alt="Now" style={styles.photoImage} />
                    <p style={styles.photoText}>Photo uploaded ✓</p>
                  </div>
                ) : (
                  <div style={styles.photoPlaceholder}>No photo uploaded</div>
                )}
                <label style={styles.fileInputLabel}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files && handlePhotoUpload('now', e.target.files[0])}
                    style={styles.fileInput}
                    disabled={uploadingPhoto === 'now'}
                  />
                  <span style={styles.fileInputButton}>
                    {uploadingPhoto === 'now' ? 'Uploading...' : 'Choose File'}
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Metadata Section */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>ℹ️ Account Info</h3>
          <div style={styles.infoGrid}>
            <div style={styles.infoItem}>
              <label style={styles.label}>Account Created</label>
              <p style={styles.value}>{new Date(user.created_at).toLocaleDateString()}</p>
            </div>
            <div style={styles.infoItem}>
              <label style={styles.label}>Admin Status</label>
              <p style={styles.value}>{user.is_admin ? '✓ Admin' : 'Regular User'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Comprehensive styling
const styles = {
  container: {
    padding: '20px',
    maxWidth: '1000px',
    margin: '0 auto',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '2px solid #4CAF50',
    paddingBottom: '15px',
    marginBottom: '30px'
  },
  title: {
    color: '#333',
    margin: 0,
    fontSize: '24px'
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
  content: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '30px'
  },
  section: {
    backgroundColor: '#f9f9f9',
    padding: '20px',
    borderRadius: '8px',
    border: '1px solid #e0e0e0'
  },
  sectionTitle: {
    color: '#333',
    marginTop: 0,
    marginBottom: '20px',
    fontSize: '18px',
    fontWeight: 'bold'
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '20px'
  },
  infoItem: {
    display: 'flex',
    flexDirection: 'column' as const
  },
  label: {
    fontWeight: 'bold',
    color: '#555',
    marginBottom: '8px',
    fontSize: '14px'
  },
  value: {
    color: '#333',
    margin: 0,
    padding: '10px',
    backgroundColor: 'white',
    borderRadius: '4px',
    border: '1px solid #ddd'
  },
  input: {
    padding: '10px',
    border: '1px solid #4CAF50',
    borderRadius: '4px',
    fontSize: '14px',
    fontFamily: 'inherit'
  },
  photosGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px'
  },
  photoCard: {
    backgroundColor: 'white',
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '20px',
    textAlign: 'center' as const
  },
  photoLabel: {
    margin: '0 0 15px 0',
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#333'
  },
  photoPreview: {
    marginBottom: '15px'
  },
  photoImage: {
    maxWidth: '100%',
    maxHeight: '250px',
    borderRadius: '4px',
    marginBottom: '10px'
  },
  photoText: {
    color: '#4CAF50',
    margin: 0,
    fontSize: '12px',
    fontWeight: 'bold'
  },
  photoPlaceholder: {
    height: '200px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: '4px',
    color: '#999',
    marginBottom: '15px',
    border: '2px dashed #ddd'
  },
  fileInputLabel: {
    cursor: 'pointer',
    display: 'inline-block'
  },
  fileInput: {
    display: 'none'
  },
  fileInputButton: {
    padding: '10px 20px',
    backgroundColor: '#2196F3',
    color: 'white',
    borderRadius: '4px',
    fontWeight: 'bold',
    cursor: 'pointer',
    display: 'inline-block',
    transition: 'background-color 0.2s'
  },
  spinner: {
    padding: '40px',
    textAlign: 'center' as const,
    color: '#999',
    fontSize: '16px'
  },
  error: {
    padding: '15px',
    backgroundColor: '#ffebee',
    color: '#c62828',
    borderRadius: '4px',
    marginBottom: '20px',
    border: '1px solid #ef5350'
  },
  info: {
    padding: '20px',
    textAlign: 'center' as const,
    color: '#666'
  }
};

export default UserProfile;
