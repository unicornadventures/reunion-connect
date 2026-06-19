import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import api from '../api';
import { User, Profile } from '../types';

interface UserWithProfile {
  user: User;
  profile: Profile | null;
}

const UserProfile: React.FC<{ userId?: number | string }> = ({ userId }) => {
  const navigate = useNavigate();
  const { currentUser } = useAppContext();
  const [data, setData] = useState<UserWithProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState<'then' | 'now' | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Partial<Profile>>({});
  const [bio, setBio] = useState('');

  const profileUserId = userId || currentUser?.user_id;
  const isOwnProfile = profileUserId === currentUser?.user_id;

  const fetchProfile = async () => {
    if (!isOwnProfile && !currentUser?.is_admin) {
      setError('You can only view your own profile.');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await api.get(`/users/${profileUserId}`);
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
    if (currentUser?.user_id) {
      fetchProfile();
    }
  }, [profileUserId, currentUser?.user_id]);

  const handlePhotoUpload = async (photoType: 'then' | 'now', file: File) => {
    if (!file || !isOwnProfile) return;

    setUploadingPhoto(photoType);
    try {
      // 1. Get presigned URL
      const presignedResponse = await api.post(`/users/${profileUserId}/photo/upload/${photoType}`, {
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
      const updateResponse = await api.put(`/users/${profileUserId}/photo/${photoType}`, {
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
    if (!data?.profile || !isOwnProfile) return;

    setLoading(true);
    try {
      const response = await api.put(`/users/${profileUserId}/profile`, editData);
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
      <div className="max-w-[1000px] mx-auto px-5 py-8">
        <div className="text-center text-[#999999] text-base">Loading profile...</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="max-w-[1000px] mx-auto px-5 py-8">
        <div className="bg-[#FFEBEE] text-[#C62828] border border-[#EF5350] rounded px-4 py-3">
          Error: {error}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-[1000px] mx-auto px-5 py-8">
        <div className="text-center text-[#666666] text-base">User not found.</div>
      </div>
    );
  }

  const { user, profile } = data;
  const displayName = profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}` : user.email;

  return (
    <div className="max-w-[1200px] mx-auto px-5 py-8">
      {/* Back Button */}
      <button
        onClick={() => navigate('/directory')}
        className="text-[#2196F3] text-sm font-bold hover:opacity-80 transition-opacity flex items-center gap-1 mb-6"
      >
        ← Back
      </button>

      {error && (
        <div className="bg-[#FFEBEE] text-[#C62828] border border-[#EF5350] rounded px-4 py-3 mb-5 text-sm">
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {/* Left Sidebar */}
        <div>
          {/* Profile Card */}
          <div className="bg-white rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.1)] p-6 text-center">
            <div className="flex justify-center mb-4">
              <div
                className="flex items-center justify-center rounded-full text-white font-bold text-2xl"
                style={{
                  width: 96,
                  height: 96,
                  background: '#4CAF50',
                }}
              >
                YO
              </div>
            </div>
            <h2 className="text-2xl font-bold text-[#333333]">{displayName}</h2>
            <p className="text-sm text-[#666666] mt-1">
              {profile?.first_name ? `${profile.first_name}'s Job @ Company` : 'Your Job Title @ Company'}
            </p>
            <p className="text-sm text-[#999999] mt-0.5">📍 Your City, ST</p>

            <div className="mt-5 space-y-2">
              <button className="w-full bg-[#4CAF50] text-white font-bold py-[10px] rounded text-sm hover:opacity-90 transition-opacity">
                📧 Send Message
              </button>
              {isOwnProfile && (
                <button
                  onClick={() => setEditMode(!editMode)}
                  className={`w-full font-bold py-[10px] rounded text-sm hover:opacity-90 transition-opacity ${
                    editMode ? 'bg-[#f44336] text-white' : 'bg-[#2196F3] text-white'
                  }`}
                >
                  {editMode ? '✏️ Cancel Editing' : '✏️ Edit Profile'}
                </button>
              )}
            </div>
          </div>

          {/* Contact Info Card */}
          <div className="bg-white rounded-lg border border-[#E0E0E0] shadow-[0_1px_3px_rgba(0,0,0,0.1)] mt-4 overflow-hidden">
            <div className="px-5 py-3 border-b border-[#EEEEEE]">
              <h3 className="text-base font-bold text-[#333333]">Contact Info</h3>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <div className="text-xs font-semibold text-[#999999]">Email</div>
                <div className="text-sm text-[#2196F3]">{user.email}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-[#999999]">Class Year</div>
                <div className="text-sm text-[#333333]">2004</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-[#999999]">Company</div>
                <div className="text-sm text-[#333333]">Your Company</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Content */}
        <div className="md:col-span-2 space-y-6">
          {/* About Section */}
          <div className="bg-white rounded-lg border border-[#E0E0E0] shadow-[0_1px_3px_rgba(0,0,0,0.1)] p-6">
            <h3 className="text-lg font-bold text-[#333333] mb-4">About</h3>
            {editMode && isOwnProfile ? (
              <div>
                <textarea
                  value={editData.bio || ''}
                  onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                  className="w-full border border-[#DDDDDD] rounded-lg px-3 py-3 text-sm focus:outline-none focus:border-[#4CAF50] resize-vertical min-h-[100px]"
                  placeholder="Tell your classmates what you've been up to..."
                />
                <div className="flex gap-3 mt-3">
                  <button
                    onClick={handleProfileUpdate}
                    disabled={loading}
                    className={`bg-[#4CAF50] text-white font-bold py-[10px] px-5 rounded text-sm hover:opacity-90 transition-opacity ${
                      loading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => { setEditMode(false); setBio(profile?.bio || ''); }}
                    className="border border-[#DDDDDD] text-[#555555] font-bold py-[10px] px-5 rounded text-sm hover:bg-[#F9F9F9] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-[#555555] text-sm leading-relaxed">
                {profile?.bio || 'Tell your classmates what you\'ve been up to for the past 20 years!'}
              </p>
            )}
          </div>

          {/* Then & Now Photos */}
          <div className="bg-white rounded-lg border border-[#E0E0E0] shadow-[0_1px_3px_rgba(0,0,0,0.1)] p-6">
            <h3 className="text-lg font-bold text-[#333333] mb-4">📸 Then & Now</h3>
            <div className="grid grid-cols-2 gap-4">
              {['Then (2004)', 'Now (2024)'].map((label) => (
                <div key={label}>
                  <div
                    className="rounded-lg flex items-center justify-center text-[#999999] text-sm border-2 border-dashed border-[#DDDDDD] bg-[#F9F9F9] cursor-pointer hover:border-[#4CAF50] hover:bg-[#E8F5E9] transition-colors duration-200"
                    style={{ height: 180 }}
                  >
                    <div className="text-center">
                      <div className="text-3xl mb-2">📷</div>
                      <div className="text-xs font-semibold">Add photo</div>
                    </div>
                  </div>
                  <div className="text-xs text-center text-[#666666] mt-2 font-semibold">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
