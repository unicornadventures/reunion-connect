import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import api from '../api';
import { User, Profile } from '../types';

interface UserWithProfile {
  user: User;
  profile: Profile | null;
}

interface ClassInfo {
  id: number;
  year: number;
  school_id: number;
}

interface SchoolInfo {
  id: number;
  name: string;
  location?: string;
}

const UserProfile: React.FC<{ userId?: number | string }> = ({ userId }) => {
  const navigate = useNavigate();
  const { currentUser } = useAppContext();
  const [data, setData] = useState<UserWithProfile | null>(null);
  const [classYear, setClassYear] = useState<number | null>(null);
  const [school, setSchool] = useState<SchoolInfo | null>(null);
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState<'then' | 'now' | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Partial<Profile>>({});
  const [bio, setBio] = useState('');
  const [isClassAdmin, setIsClassAdmin] = useState(false);
  const [updatingClassAdmin, setUpdatingClassAdmin] = useState(false);

  const profileUserId = userId ? Number(userId) : currentUser?.user_id;
  const isOwnProfile = profileUserId === currentUser?.user_id;

  const fetchProfile = async () => {
    const canView = isOwnProfile || currentUser?.is_admin;
    if (!canView) {
      setError('You can only view your own profile.');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await api.get(`/users/${profileUserId}`);
      setData(response.data);
      setIsClassAdmin(response.data.user?.is_class_admin || false);
      if (response.data.profile) {
        setEditData(response.data.profile);
      }

      // Fetch class and school info
      const classResponse = await api.get(`/users/${profileUserId}/class`);
      const classData = classResponse.data.class;
      setClassYear(classData.year);
      setClassInfo(classData);

      // Fetch school info
      const schoolResponse = await api.get(`/schools/${classData.school_id}`);
      setSchool(schoolResponse.data.school);

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
      // Upload file directly to backend, which handles S3 upload
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post(`/users/${profileUserId}/photo/${photoType}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setData(prev => prev ? { ...prev, profile: response.data.profile } : null);
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
      setData(prev => prev ? {
        ...prev,
        profile: response.data.profile,
        user: { ...prev.user, email: editData.email || prev.user.email }
      } : null);
      setEditMode(false);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleClassAdmin = async () => {
    if (!currentUser?.is_admin) return;

    setUpdatingClassAdmin(true);
    try {
      const newStatus = !isClassAdmin;
      const response = await api.put(`/admin/users/${profileUserId}`, {
        is_class_admin: newStatus
      });

      setIsClassAdmin(response.data.user?.is_class_admin || false);
      setData(prev => prev ? {
        ...prev,
        user: { ...prev.user, is_class_admin: newStatus }
      } : null);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update class admin status.');
    } finally {
      setUpdatingClassAdmin(false);
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

  if (!isOwnProfile && !currentUser?.is_admin) {
    return (
      <div className="max-w-[1000px] mx-auto px-5 py-8">
        <button
          onClick={() => navigate('/directory')}
          className="text-[#2196F3] text-sm font-bold hover:opacity-80 transition-opacity flex items-center gap-1 mb-6"
        >
          ← Back
        </button>
        <div className="bg-[#FFEBEE] text-[#C62828] border border-[#EF5350] rounded px-4 py-3">
          You can only view your own profile.
        </div>
      </div>
    );
  }

  const { user, profile } = data;
  const displayName = profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}` : user.email;

  return (
    <div className="max-w-[1200px] mx-auto px-5 py-8">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
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
              {profile?.now_photo_url ? (
                <img
                  src={profile.now_photo_url}
                  alt={displayName}
                  className="w-24 h-24 rounded-full object-cover"
                />
              ) : (
                <div
                  className="flex items-center justify-center rounded-full text-white font-bold text-2xl"
                  style={{
                    width: 96,
                    height: 96,
                    background: '#4CAF50',
                  }}
                >
                  {profile?.first_name?.charAt(0)}{profile?.last_name?.charAt(0)}
                </div>
              )}
            </div>
            <h2 className="text-2xl font-bold text-[#333333]">{displayName}</h2>
            {profile?.nickname && (
              <div className="text-sm text-[#666666] mt-1">"{profile.nickname}"</div>
            )}
            {(profile?.former_first_name || profile?.former_last_name) && (
              <div className="text-xs text-[#999999] mt-1">
                Formerly: {[profile.former_first_name, profile.former_last_name].filter(Boolean).join(' ')}
              </div>
            )}

            {isOwnProfile && (
              <div className="mt-5 space-y-2">
                <button
                  onClick={() => setEditMode(!editMode)}
                  className={`w-full font-bold py-[10px] rounded text-sm hover:opacity-90 transition-opacity ${
                    editMode ? 'bg-[#f44336] text-white' : 'bg-[#2196F3] text-white'
                  }`}
                >
                  {editMode ? '✏️ Cancel Editing' : '✏️ Edit Profile'}
                </button>
              </div>
            )}
          </div>

          {/* Class Info Card */}
          {school && classInfo && (
            <div className="bg-white rounded-lg border border-[#E0E0E0] shadow-[0_1px_3px_rgba(0,0,0,0.1)] mt-4 overflow-hidden">
              <div className="px-5 py-3 border-b border-[#EEEEEE]">
                <h3 className="text-base font-bold text-[#333333]">🎓 Class Info</h3>
              </div>
              <div className="p-5 space-y-3">
                <div>
                  <div className="text-xs font-semibold text-[#999999]">School</div>
                  <div className="text-sm text-[#333333] mt-1">{school.name}</div>
                  {school.location && (
                    <div className="text-xs text-[#999999] mt-1">{school.location}</div>
                  )}
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#999999]">Class Year</div>
                  <div className="text-sm text-[#333333] mt-1">{classInfo.year}</div>
                </div>
              </div>
            </div>
          )}

          {/* Contact Info Card & Admin Controls */}
          {(isOwnProfile || currentUser?.is_admin) && (
            <div className="bg-white rounded-lg border border-[#E0E0E0] shadow-[0_1px_3px_rgba(0,0,0,0.1)] mt-4 overflow-hidden">
              <div className="px-5 py-3 border-b border-[#EEEEEE]">
                <h3 className="text-base font-bold text-[#333333]">{isOwnProfile ? 'Contact Info' : 'User Management'}</h3>
              </div>
              <div className="p-5 space-y-3">
                {isOwnProfile && (
                  <div>
                    <div className="text-xs font-semibold text-[#999999]">Email</div>
                    {editMode ? (
                      <input
                        type="email"
                        value={editData.email || user.email}
                        onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                        className="w-full border border-[#DDDDDD] rounded px-2 py-2 text-sm focus:outline-none focus:border-[#4CAF50] mt-1"
                        placeholder="your@email.com"
                      />
                    ) : (
                      <div className="text-sm text-[#2196F3]">{user.email}</div>
                    )}
                  </div>
                )}

                {/* Class Admin Checkbox - Only visible to super admins */}
                {currentUser?.is_admin && !isOwnProfile && (
                  <div className="border-t border-[#EEEEEE] pt-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isClassAdmin}
                        onChange={handleToggleClassAdmin}
                        disabled={updatingClassAdmin}
                        className="w-4 h-4 cursor-pointer"
                      />
                      <span className="text-sm text-[#333333] font-medium">Make Class Admin</span>
                      {updatingClassAdmin && (
                        <span className="text-xs text-[#999999]">Updating...</span>
                      )}
                    </label>
                    <p className="text-xs text-[#999999] mt-2">Class admins can moderate comments from users in their class year.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Content */}
        <div className="md:col-span-2 space-y-6">
          {/* About Section */}
          <div className="bg-white rounded-lg border border-[#E0E0E0] shadow-[0_1px_3px_rgba(0,0,0,0.1)] p-6">
            <h3 className="text-lg font-bold text-[#333333] mb-4">About</h3>
            {editMode && isOwnProfile ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-[#999999] block mb-1">First Name</label>
                    <input
                      type="text"
                      value={editData.first_name || ''}
                      onChange={(e) => setEditData({ ...editData, first_name: e.target.value })}
                      className="w-full border border-[#DDDDDD] rounded px-2 py-2 text-sm focus:outline-none focus:border-[#4CAF50]"
                      placeholder="First name"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#999999] block mb-1">Last Name</label>
                    <input
                      type="text"
                      value={editData.last_name || ''}
                      onChange={(e) => setEditData({ ...editData, last_name: e.target.value })}
                      className="w-full border border-[#DDDDDD] rounded px-2 py-2 text-sm focus:outline-none focus:border-[#4CAF50]"
                      placeholder="Last name"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#999999] block mb-1">Nickname</label>
                  <input
                    type="text"
                    value={editData.nickname || ''}
                    onChange={(e) => setEditData({ ...editData, nickname: e.target.value })}
                    className="w-full border border-[#DDDDDD] rounded px-2 py-2 text-sm focus:outline-none focus:border-[#4CAF50]"
                    placeholder="What did everyone call you?"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#999999] block mb-1">Former Name <span className="font-normal">(if your name has changed)</span></label>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={editData.former_first_name || ''}
                      onChange={(e) => setEditData({ ...editData, former_first_name: e.target.value })}
                      className="w-full border border-[#DDDDDD] rounded px-2 py-2 text-sm focus:outline-none focus:border-[#4CAF50]"
                      placeholder="Former first name"
                    />
                    <input
                      type="text"
                      value={editData.former_last_name || ''}
                      onChange={(e) => setEditData({ ...editData, former_last_name: e.target.value })}
                      className="w-full border border-[#DDDDDD] rounded px-2 py-2 text-sm focus:outline-none focus:border-[#4CAF50]"
                      placeholder="Former last name"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#999999] block mb-1">Bio</label>
                  <textarea
                    value={editData.bio || ''}
                    onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                    className="w-full border border-[#DDDDDD] rounded-lg px-3 py-3 text-sm focus:outline-none focus:border-[#4CAF50] resize-vertical min-h-[100px]"
                    placeholder="Tell your classmates what you've been up to..."
                  />
                </div>
                <div className="flex gap-3">
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
              {[
                { key: 'then', label: `Then (${classYear || 'Class Year'})`, url: profile?.then_photo_url },
                { key: 'now', label: `Now (${new Date().getFullYear()})`, url: profile?.now_photo_url }
              ].map((photo) => (
                <div key={photo.key}>
                  {isOwnProfile && (
                    <input
                      type="file"
                      id={`photo-${photo.key}`}
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handlePhotoUpload(photo.key as 'then' | 'now', file);
                        }
                      }}
                      className="hidden"
                      disabled={uploadingPhoto !== null}
                    />
                  )}
                  <label htmlFor={`photo-${photo.key}`} style={{ cursor: isOwnProfile ? 'pointer' : 'default' }}>
                    {photo.url ? (
                      <div className={`rounded-lg overflow-hidden ${isOwnProfile ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}>
                        <img
                          src={photo.url}
                          alt={photo.label}
                          className="w-full h-[180px] object-cover"
                        />
                      </div>
                    ) : (
                      <div
                        className={`rounded-lg flex items-center justify-center text-[#999999] text-sm border-2 border-dashed border-[#DDDDDD] bg-[#F9F9F9] ${isOwnProfile ? 'cursor-pointer hover:border-[#4CAF50] hover:bg-[#E8F5E9] transition-colors duration-200' : ''}`}
                        style={{ height: 180 }}
                      >
                        <div className="text-center">
                          <div className="text-3xl mb-2">📷</div>
                          <div className="text-xs font-semibold">
                            {uploadingPhoto === photo.key ? 'Uploading...' : isOwnProfile ? 'Add photo' : 'No photo'}
                          </div>
                        </div>
                      </div>
                    )}
                  </label>
                  <div className="text-xs text-center text-[#666666] mt-2 font-semibold">{photo.label}</div>
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
