import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import api from '../api';
import { User, Profile } from '../types';

interface UserWithProfile {
  user: User;
  profile: Profile | null;
}

const UserProfile: React.FC<{ userId?: number | string }> = ({ userId }) => {
  const { currentUser } = useAppContext();
  const [data, setData] = useState<UserWithProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState<'then' | 'now' | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Partial<Profile>>({});

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
    <div className="max-w-[1000px] mx-auto px-5 py-8">
      {/* Header */}
      <div className="flex justify-between items-center border-b-2 border-[#4CAF50] pb-4 mb-8">
        <h2 className="text-3xl font-bold text-[#333333]">{displayName}'s Profile</h2>
        {isOwnProfile && (
          <button
            onClick={() => setEditMode(!editMode)}
            className={`px-5 py-2 rounded font-bold text-white transition-opacity hover:opacity-90 ${
              editMode ? 'bg-[#f44336]' : 'bg-[#2196F3]'
            }`}
          >
            {editMode ? 'Cancel' : '✏️ Edit Profile'}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-[#FFEBEE] text-[#C62828] border border-[#EF5350] rounded px-4 py-3 mb-5 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-8">
        {/* Personal Information Section */}
        <div className="bg-white rounded-lg border border-[#E0E0E0] shadow-[0_1px_3px_rgba(0,0,0,0.1)] p-6">
          <h3 className="text-lg font-bold text-[#333333] mb-6">📋 Personal Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-[#555555] mb-2">Email</label>
              <div className="px-3 py-2 bg-white border border-[#DDDDDD] rounded-lg text-[#333333]">
                {user.email}
              </div>
            </div>

            {profile && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-[#555555] mb-2">First Name</label>
                  {editMode && isOwnProfile ? (
                    <input
                      type="text"
                      value={editData.first_name || ''}
                      onChange={(e) => setEditData({ ...editData, first_name: e.target.value })}
                      className="w-full px-3 py-2 border border-[#4CAF50] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4CAF50]"
                    />
                  ) : (
                    <div className="px-3 py-2 bg-white border border-[#DDDDDD] rounded-lg text-[#333333]">
                      {profile.first_name || 'Not provided'}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#555555] mb-2">Last Name</label>
                  {editMode && isOwnProfile ? (
                    <input
                      type="text"
                      value={editData.last_name || ''}
                      onChange={(e) => setEditData({ ...editData, last_name: e.target.value })}
                      className="w-full px-3 py-2 border border-[#4CAF50] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4CAF50]"
                    />
                  ) : (
                    <div className="px-3 py-2 bg-white border border-[#DDDDDD] rounded-lg text-[#333333]">
                      {profile.last_name || 'Not provided'}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#555555] mb-2">Nickname (School)</label>
                  {editMode && isOwnProfile ? (
                    <input
                      type="text"
                      value={editData.nickname_school || ''}
                      onChange={(e) => setEditData({ ...editData, nickname_school: e.target.value })}
                      className="w-full px-3 py-2 border border-[#4CAF50] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4CAF50]"
                    />
                  ) : (
                    <div className="px-3 py-2 bg-white border border-[#DDDDDD] rounded-lg text-[#333333]">
                      {profile.nickname_school || 'Not provided'}
                    </div>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-[#555555] mb-2">Bio</label>
                  {editMode && isOwnProfile ? (
                    <textarea
                      value={editData.bio || ''}
                      onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                      className="w-full px-3 py-2 border border-[#4CAF50] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4CAF50] min-h-[100px] resize-vertical"
                    />
                  ) : (
                    <div className="px-3 py-2 bg-white border border-[#DDDDDD] rounded-lg text-[#333333]">
                      {profile.bio || 'No bio provided.'}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {editMode && (
            <button
              onClick={handleProfileUpdate}
              disabled={loading}
              className={`mt-6 px-5 py-2 rounded font-bold text-white transition-opacity ${
                loading
                  ? 'bg-[#CCCCCC] cursor-not-allowed'
                  : 'bg-[#4CAF50] hover:opacity-90 cursor-pointer'
              }`}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>

        {/* Photo Section */}
        {profile && (
          <div className="bg-white rounded-lg border border-[#E0E0E0] shadow-[0_1px_3px_rgba(0,0,0,0.1)] p-6">
            <h3 className="text-lg font-bold text-[#333333] mb-6">📸 Then & Now</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Then Photo */}
              <div className="bg-white border border-[#E0E0E0] rounded-lg p-5 text-center">
                <h4 className="text-base font-bold text-[#333333] mb-4">School Photo (Then)</h4>
                {profile.then_photo_url ? (
                  <div className="mb-4">
                    <img
                      src={profile.then_photo_url}
                      alt="Then"
                      className="max-w-full max-h-[250px] rounded-lg mx-auto mb-2"
                    />
                    <p className="text-[#4CAF50] text-xs font-bold">Photo uploaded ✓</p>
                  </div>
                ) : (
                  <div className="h-[200px] flex items-center justify-center bg-[#F9F9F9] border-2 border-dashed border-[#DDDDDD] rounded-lg text-[#999999] text-sm mb-4">
                    Add photo
                  </div>
                )}
                <label className="cursor-pointer inline-block">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files && handlePhotoUpload('then', e.target.files[0])}
                    disabled={uploadingPhoto === 'then'}
                    className="hidden"
                  />
                  <span className="px-4 py-2 bg-[#2196F3] text-white rounded font-bold text-sm hover:opacity-90 transition-opacity inline-block cursor-pointer">
                    {uploadingPhoto === 'then' ? 'Uploading...' : 'Choose File'}
                  </span>
                </label>
              </div>

              {/* Now Photo */}
              <div className="bg-white border border-[#E0E0E0] rounded-lg p-5 text-center">
                <h4 className="text-base font-bold text-[#333333] mb-4">Current Photo (Now)</h4>
                {profile.now_photo_url ? (
                  <div className="mb-4">
                    <img
                      src={profile.now_photo_url}
                      alt="Now"
                      className="max-w-full max-h-[250px] rounded-lg mx-auto mb-2"
                    />
                    <p className="text-[#4CAF50] text-xs font-bold">Photo uploaded ✓</p>
                  </div>
                ) : (
                  <div className="h-[200px] flex items-center justify-center bg-[#F9F9F9] border-2 border-dashed border-[#DDDDDD] rounded-lg text-[#999999] text-sm mb-4">
                    Add photo
                  </div>
                )}
                <label className="cursor-pointer inline-block">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files && handlePhotoUpload('now', e.target.files[0])}
                    disabled={uploadingPhoto === 'now'}
                    className="hidden"
                  />
                  <span className="px-4 py-2 bg-[#2196F3] text-white rounded font-bold text-sm hover:opacity-90 transition-opacity inline-block cursor-pointer">
                    {uploadingPhoto === 'now' ? 'Uploading...' : 'Choose File'}
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Metadata Section */}
        <div className="bg-white rounded-lg border border-[#E0E0E0] shadow-[0_1px_3px_rgba(0,0,0,0.1)] p-6">
          <h3 className="text-lg font-bold text-[#333333] mb-6">ℹ️ Account Info</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-[#555555] mb-2">Account Created</label>
              <div className="px-3 py-2 bg-white border border-[#DDDDDD] rounded-lg text-[#333333]">
                {new Date(user.created_at).toLocaleDateString()}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#555555] mb-2">Admin Status</label>
              <div className="px-3 py-2 bg-white border border-[#DDDDDD] rounded-lg text-[#333333]">
                {user.is_admin ? '✓ Admin' : 'Regular User'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
