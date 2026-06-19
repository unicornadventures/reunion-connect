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

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/users/${userId}`);
      setData(response.data);
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

  const handlePhotoUpload = async (photoType: 'then' | 'now', fileName: string) => {
    try {
      // 1. Request pre-signed URL
      const response = await api.post(`/users/${userId}/photo/upload/${photoType}`, { fileName });
      const presignedUrl = response.data.presignedUrl;
      alert(`Success! Use this URL to upload: ${presignedUrl}`);
    } catch (err: any) {
      setError(`Photo upload request failed: ${err.response?.data?.error || 'Unknown error'}`);
    }
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading profile...</div>;
  if (error) return <div style={{ padding: '20px', color: 'red' }}>Error: {error}</div>;
  if (!data) return <div style={{ padding: '20px' }}>User not found.</div>;

  const { user, profile } = data;
  const displayName = profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}` : user.email;

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ borderBottom: '2px solid #4CAF50', paddingBottom: '10px' }}>{displayName} Profile</h2>

      <div style={{ display: 'flex', gap: '40px' }}>
        <div style={{ flex: 1 }}>
          <h3>Personal Information</h3>
          <p><strong>Email:</strong> {user.email}</p>
          {profile && (
            <>
              <p><strong>Nickname (School):</strong> {profile.nickname_school || 'Not provided'}</p>
              <p><strong>Bio:</strong> {profile.bio || 'No bio provided.'}</p>
            </>
          )}
        </div>

        <div style={{ flex: 1 }}>
          <h3>Photos & Upload</h3>
          {profile && (
            <>
              <p><strong>Then Photo:</strong> {profile.then_photo_url ? 'Photo Available' : 'No photo uploaded.'}</p>
              <p><strong>Now Photo:</strong> {profile.now_photo_url ? 'Photo Available' : 'No photo uploaded.'}</p>
            </>
          )}

          <button
            onClick={() => handlePhotoUpload('then', 'photo_placeholder.jpg')}
            style={{ padding: '10px', marginRight: '10px' }}
          >
            Upload 'Then' Photo
          </button>
          <button
            onClick={() => handlePhotoUpload('now', 'photo_placeholder.jpg')}
            style={{ padding: '10px' }}
          >
            Upload 'Now' Photo
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;