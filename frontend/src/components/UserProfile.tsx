import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import api from '../api';
import { User, Profile, GalleryPhoto } from '../types';
import { galleryAPI } from '../apiClient';

interface UserWithProfile {
  user: User;
  profile: Profile | null;
}

interface ClassInfo {
  id: number;
  year: number;
  school_id?: number;
  school_name?: string;
}

interface SchoolInfo {
  id: number;
  name: string;
  location?: string;
}

const inputClass = 'w-full border border-[#E2E8F0] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#E8A93E] focus:ring-1 focus:ring-[#E8A93E] transition-colors placeholder:text-[#CBD5E1]';
const labelClass = 'text-xs font-semibold text-[#94A3B8] block mb-1';

const UserProfile: React.FC<{ userId?: number | string }> = ({ userId }) => {
  const navigate = useNavigate();
  const { currentUser, updateCurrentUser } = useAppContext();
  const [data, setData] = useState<UserWithProfile | null>(null);
  const [classYear, setClassYear] = useState<number | null>(null);
  const [school, setSchool] = useState<SchoolInfo | null>(null);
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState<'then' | 'now' | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Partial<Profile>>({});
  const [isClassAdmin, setIsClassAdmin] = useState(false);
  const [updatingClassAdmin, setUpdatingClassAdmin] = useState(false);
  const [galleryPhotos, setGalleryPhotos] = useState<GalleryPhoto[]>([]);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);

  const profileUserId = userId ? Number(userId) : currentUser?.user_id;
  const isOwnProfile = profileUserId === currentUser?.user_id;

  const fetchProfile = async () => {
    const canView = isOwnProfile || currentUser?.is_admin;
    if (!canView) { setError('You can only view your own profile.'); setLoading(false); return; }

    setLoading(true);
    try {
      const response = await api.get(`/users/${profileUserId}`);
      setData(response.data);
      setIsClassAdmin(response.data.user?.is_class_admin || false);
      if (response.data.profile) {
        setEditData(response.data.profile);
        setEditTags(response.data.profile.tags || []);
      }
      if (isOwnProfile) {
        updateCurrentUser({
          profile: response.data.profile,
          first_name: response.data.profile?.first_name || '',
          last_name: response.data.profile?.last_name || ''
        } as any);
      }

      const classResponse = await api.get(`/users/${profileUserId}/class`);
      const classData = classResponse.data.class;
      setClassYear(classData.year);
      setClassInfo(classData);

      if (classData.school_id) {
        const schoolResponse = await api.get(`/schools/${classData.school_id}`);
        setSchool(schoolResponse.data.school);
      }

      try {
        const galleryResponse = await galleryAPI.list(profileUserId!, currentUser!.user_id);
        setGalleryPhotos(galleryResponse.data.photos || []);
      } catch {
        setGalleryPhotos([]);
      }

      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser?.user_id) fetchProfile();
  }, [profileUserId, currentUser?.user_id]);

  const handlePhotoUpload = async (photoType: 'then' | 'now', file: File) => {
    if (!file || !isOwnProfile) return;
    setUploadingPhoto(photoType);
    try {
      // Step 1: get presigned upload URL from our API
      const response = await api.post(`/users/${profileUserId}/photo/${photoType}`, undefined, {
        params: { requesterId: currentUser?.user_id }
      });
      const { presignedUrl } = response.data;

      // Step 2: PUT the file directly to S3 using the presigned URL
      const putRes = await fetch(presignedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': 'image/jpeg' }
      });
      if (!putRes.ok) throw new Error(`S3 upload failed: ${putRes.status}`);

      // Step 3: refresh profile to reflect the new photo key
      await fetchProfile();
      setError(null);
    } catch (err: any) {
      setError(`Photo upload failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setUploadingPhoto(null);
    }
  };

  const handlePhotoDelete = async (photoType: 'then' | 'now') => {
    if (!isOwnProfile) return;
    setUploadingPhoto(photoType);
    try {
      await api.delete(`/users/${profileUserId}/photo/${photoType}`, {
        params: { requesterId: currentUser?.user_id }
      });
      await fetchProfile();
      setError(null);
    } catch (err: any) {
      setError(`Photo delete failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setUploadingPhoto(null);
    }
  };

  const handleProfileUpdate = async () => {
    if (!data?.profile || !isOwnProfile) return;
    setLoading(true);
    try {
      const response = await api.put(`/users/${profileUserId}/profile`, { ...editData, tags: editTags });
      setData(prev => prev ? {
        ...prev,
        profile: response.data.profile,
        user: { ...prev.user, email: editData.email || prev.user.email }
      } : null);
      setEditTags(response.data.profile?.tags || editTags);
      setEditMode(false);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleGalleryUpload = async (file: File) => {
    if (!file || !isOwnProfile || !profileUserId) return;
    if (galleryPhotos.length >= 9) { setError('Gallery limit of 9 photos reached.'); return; }
    setUploadingGallery(true);
    try {
      const initRes = await galleryAPI.upload(profileUserId, currentUser!.user_id);
      const { presignedUrl, id, key } = initRes.data;
      const putRes = await fetch(presignedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': 'image/jpeg' }
      });
      if (!putRes.ok) throw new Error(`S3 upload failed: ${putRes.status}`);
      setGalleryPhotos(prev => [...prev, { id, url: key, created_at: new Date().toISOString() }]);
      const refreshed = await galleryAPI.list(profileUserId, currentUser!.user_id);
      setGalleryPhotos(refreshed.data.photos || []);
      setError(null);
    } catch (err: any) {
      setError(`Gallery upload failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setUploadingGallery(false);
    }
  };

  const handleGalleryDelete = async (photoId: number) => {
    if (!isOwnProfile || !profileUserId) return;
    try {
      await galleryAPI.delete(profileUserId, photoId, currentUser!.user_id);
      setGalleryPhotos(prev => prev.filter(p => p.id !== photoId));
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete gallery photo.');
    }
  };

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (!trimmed || editTags.length >= 10 || editTags.includes(trimmed)) return;
    setEditTags([...editTags, trimmed]);
    setTagInput('');
  };

  const removeTag = (tag: string) => setEditTags(editTags.filter(t => t !== tag));

  const handleToggleClassAdmin = async () => {
    if (!currentUser?.is_admin) return;
    setUpdatingClassAdmin(true);
    try {
      const newStatus = !isClassAdmin;
      const response = await api.put(`/admin/users/${profileUserId}`, { is_class_admin: newStatus });
      setIsClassAdmin(response.data.user?.is_class_admin || false);
      setData(prev => prev ? { ...prev, user: { ...prev.user, is_class_admin: newStatus } } : null);
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
        <div className="text-center text-[#94A3B8] text-sm">Loading profile...</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="max-w-[1000px] mx-auto px-5 py-8">
        <div className="bg-[#FFEBEE] text-[#C62828] border border-[#EF5350] rounded px-4 py-3 text-sm">
          {error}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-[1000px] mx-auto px-5 py-8">
        <div className="text-center text-[#64748B] text-sm">User not found.</div>
      </div>
    );
  }

  if (!isOwnProfile && !currentUser?.is_admin) {
    return (
      <div className="max-w-[1000px] mx-auto px-5 py-8">
        <button onClick={() => navigate('/directory')}
          className="text-sm text-[#64748B] hover:text-[#0E2240] bg-transparent border-none cursor-pointer transition-colors mb-6">
          ← Back
        </button>
        <div className="bg-[#FFEBEE] text-[#C62828] border border-[#EF5350] rounded px-4 py-3 text-sm">
          You can only view your own profile.
        </div>
      </div>
    );
  }

  const { user, profile } = data;
  const displayName = profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}` : user.email;

  return (
    <div className="max-w-[1200px] mx-auto px-5 py-8">
      <button onClick={() => navigate(-1)}
        className="text-sm text-[#64748B] hover:text-[#0E2240] bg-transparent border-none cursor-pointer transition-colors mb-6">
        ← Back
      </button>

      {error && (
        <div className="bg-[#FFEBEE] text-[#C62828] border border-[#EF5350] rounded px-4 py-3 text-sm mb-5">
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {/* Left sidebar */}
        <div>
          {/* Profile card */}
          <div className="bg-white rounded-lg border border-[#E2E8F0] p-6 text-center">
            <div className="flex justify-center mb-4">
              {profile?.now_photo_url ? (
                <img src={profile.now_photo_url} alt={displayName}
                  className="w-24 h-24 rounded-full object-cover" />
              ) : (
                <div className="flex items-center justify-center rounded-full bg-[#0E2240] text-[#E8A93E] font-bold text-2xl"
                  style={{ width: 96, height: 96 }}>
                  {profile?.first_name?.charAt(0)}{profile?.last_name?.charAt(0)}
                </div>
              )}
            </div>
            <h2 className="font-display text-xl font-bold text-[#0E2240] uppercase tracking-tight">
              {displayName}
            </h2>
            {profile?.nickname && (
              <div className="text-sm text-[#64748B] mt-1">"{profile.nickname}"</div>
            )}
            {(profile?.former_first_name || profile?.former_last_name) && (
              <div className="text-xs text-[#94A3B8] mt-1">
                Formerly: {[profile.former_first_name, profile.former_last_name].filter(Boolean).join(' ')}
              </div>
            )}

            {isOwnProfile && (
              <div className="mt-5">
                <button
                  onClick={() => setEditMode(!editMode)}
                  className={`w-full font-semibold py-2.5 rounded text-sm hover:opacity-90 transition-opacity border-none cursor-pointer ${
                    editMode ? 'bg-[#f44336] text-white' : 'bg-[#0E2240] text-white'
                  }`}
                >
                  {editMode ? 'Cancel editing' : 'Edit profile'}
                </button>
              </div>
            )}
          </div>

          {/* Class info card */}
          {school && classInfo && (
            <div className="bg-white rounded-lg border border-[#E2E8F0] mt-4 overflow-hidden">
              <div className="px-5 py-3 border-b border-[#E2E8F0]">
                <p className="text-[10px] font-semibold text-[#94A3B8] tracking-[0.15em] uppercase">Class Info</p>
              </div>
              <div className="p-5 space-y-3">
                <div>
                  <div className={labelClass}>School</div>
                  <div className="text-sm text-[#0E2240] font-medium">{school.name}</div>
                  {school.location && <div className="text-xs text-[#94A3B8] mt-0.5">{school.location}</div>}
                </div>
                <div>
                  <div className={labelClass}>Class Year</div>
                  <div className="font-display text-2xl font-bold text-[#0E2240]">{classInfo.year}</div>
                </div>
              </div>
            </div>
          )}

          {/* Contact / admin card */}
          {(isOwnProfile || currentUser?.is_admin) && (
            <div className="bg-white rounded-lg border border-[#E2E8F0] mt-4 overflow-hidden">
              <div className="px-5 py-3 border-b border-[#E2E8F0]">
                <p className="text-[10px] font-semibold text-[#94A3B8] tracking-[0.15em] uppercase">
                  {isOwnProfile ? 'Contact Info' : 'User Management'}
                </p>
              </div>
              <div className="p-5 space-y-3">
                {isOwnProfile && (
                  <div>
                    <div className={labelClass}>Email</div>
                    {editMode ? (
                      <input
                        type="email"
                        value={editData.email || user.email}
                        onChange={e => setEditData({ ...editData, email: e.target.value })}
                        className={inputClass}
                        placeholder="your@email.com"
                      />
                    ) : (
                      <div className="text-sm text-[#0E2240]">{user.email}</div>
                    )}
                  </div>
                )}

                {currentUser?.is_admin && !isOwnProfile && (
                  <div className="border-t border-[#E2E8F0] pt-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isClassAdmin}
                        onChange={handleToggleClassAdmin}
                        disabled={updatingClassAdmin}
                        className="w-4 h-4 cursor-pointer accent-[#0E2240]"
                      />
                      <span className="text-sm text-[#0E2240] font-medium">Make Class Admin</span>
                      {updatingClassAdmin && <span className="text-xs text-[#94A3B8]">Updating...</span>}
                    </label>
                    <p className="text-xs text-[#94A3B8] mt-2">Class admins can moderate comments from users in their class year.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right content */}
        <div className="md:col-span-2 space-y-6">
          {/* About section */}
          <div className="bg-white rounded-lg border border-[#E2E8F0] p-6">
            <h3 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-[0.12em] mb-4">About</h3>
            {editMode && isOwnProfile ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>First Name</label>
                    <input type="text" value={editData.first_name || ''}
                      onChange={e => setEditData({ ...editData, first_name: e.target.value })}
                      className={inputClass} placeholder="First name" />
                  </div>
                  <div>
                    <label className={labelClass}>Last Name</label>
                    <input type="text" value={editData.last_name || ''}
                      onChange={e => setEditData({ ...editData, last_name: e.target.value })}
                      className={inputClass} placeholder="Last name" />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Nickname</label>
                  <input type="text" value={editData.nickname || ''}
                    onChange={e => setEditData({ ...editData, nickname: e.target.value })}
                    className={inputClass} placeholder="What did everyone call you?" />
                </div>
                <div>
                  <label className={labelClass}>Former Name <span className="font-normal">(if your name has changed)</span></label>
                  <div className="grid grid-cols-2 gap-3">
                    <input type="text" value={editData.former_first_name || ''}
                      onChange={e => setEditData({ ...editData, former_first_name: e.target.value })}
                      className={inputClass} placeholder="Former first name" />
                    <input type="text" value={editData.former_last_name || ''}
                      onChange={e => setEditData({ ...editData, former_last_name: e.target.value })}
                      className={inputClass} placeholder="Former last name" />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Bio</label>
                  <textarea
                    value={editData.bio || ''}
                    onChange={e => setEditData({ ...editData, bio: e.target.value })}
                    className={`${inputClass} resize-vertical min-h-[100px] py-3`}
                    placeholder="Tell your classmates what you've been up to..."
                  />
                </div>
                <div>
                  <label className={labelClass}>Tags <span className="font-normal">(up to 10 — clubs, sports, dorm hall, etc.)</span></label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {editTags.map(tag => (
                      <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#0E2240]/10 text-[#0E2240] rounded text-xs font-medium">
                        {tag}
                        <button type="button" onClick={() => removeTag(tag)} className="text-[#0E2240]/60 hover:text-[#0E2240] bg-transparent border-none cursor-pointer leading-none p-0">×</button>
                      </span>
                    ))}
                  </div>
                  {editTags.length < 10 && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); }}}
                        className={inputClass}
                        placeholder="Add a tag and press Enter"
                        maxLength={40}
                      />
                      <button type="button" onClick={addTag}
                        className="px-3 py-2 bg-[#0E2240] text-white text-sm font-semibold rounded hover:opacity-90 border-none cursor-pointer flex-shrink-0">
                        Add
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <button onClick={handleProfileUpdate} disabled={loading}
                    className={`bg-[#0E2240] text-white font-semibold py-2.5 px-5 rounded text-sm hover:opacity-90 transition-opacity border-none cursor-pointer ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    {loading ? 'Saving...' : 'Save changes'}
                  </button>
                  <button onClick={() => setEditMode(false)}
                    className="border border-[#E2E8F0] text-[#64748B] font-semibold py-2.5 px-5 rounded text-sm hover:bg-[#F6F8FC] transition-colors cursor-pointer bg-transparent">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm text-[#64748B] leading-relaxed mb-4">
                  {profile?.bio || "Tell your classmates what you've been up to for the past 20 years!"}
                </p>
                {profile?.tags && profile.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {profile.tags.map(tag => (
                      <span key={tag} className="px-2.5 py-1 bg-[#F6F8FC] border border-[#E2E8F0] text-[#0E2240] rounded-full text-xs font-medium">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Then & Now photos */}
          <div className="bg-white rounded-lg border border-[#E2E8F0] p-6">
            <h3 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-[0.12em] mb-4">Then & Now</h3>
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
                      onChange={e => { const file = e.target.files?.[0]; if (file) handlePhotoUpload(photo.key as 'then' | 'now', file); }}
                      className="hidden"
                      disabled={uploadingPhoto !== null}
                    />
                  )}
                  <label htmlFor={`photo-${photo.key}`} style={{ cursor: isOwnProfile ? 'pointer' : 'default' }}>
                    {photo.url ? (
                      <div className={`relative rounded-lg overflow-hidden group ${isOwnProfile ? 'hover:opacity-80 transition-opacity' : ''}`}>
                        <div className="absolute top-2 left-2 z-10 bg-[#0E2240]/80 px-2 py-0.5 rounded">
                          <span className="font-display text-[10px] font-bold text-[#E8A93E] uppercase tracking-wide">
                            {photo.key === 'then' ? 'Then' : 'Now'}
                          </span>
                        </div>
                        {isOwnProfile && (
                          <button
                            type="button"
                            onClick={e => { e.preventDefault(); e.stopPropagation(); handlePhotoDelete(photo.key as 'then' | 'now'); }}
                            disabled={uploadingPhoto !== null}
                            className="absolute top-2 right-2 z-10 w-6 h-6 bg-black/60 text-white rounded-full text-xs font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border-none disabled:cursor-not-allowed"
                          >
                            ×
                          </button>
                        )}
                        <img src={photo.url} alt={photo.label} className="w-full h-[180px] object-cover" />
                      </div>
                    ) : (
                      <div
                        className={`rounded-lg flex items-center justify-center text-[#94A3B8] text-sm border-2 border-dashed border-[#E2E8F0] bg-[#F6F8FC] ${
                          isOwnProfile ? 'hover:border-[#E8A93E] hover:bg-white transition-colors duration-200' : ''
                        }`}
                        style={{ height: 180 }}
                      >
                        <div className="text-center">
                          <div className="text-xs font-semibold text-[#94A3B8]">
                            {uploadingPhoto === photo.key ? 'Uploading...' : isOwnProfile ? 'Click to add photo' : 'No photo'}
                          </div>
                        </div>
                      </div>
                    )}
                  </label>
                  <div className="text-[10px] text-center text-[#94A3B8] tracking-[0.12em] uppercase font-semibold mt-2">
                    {photo.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Photo Gallery */}
          <div className="bg-white rounded-lg border border-[#E2E8F0] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-[0.12em]">
                Gallery ({galleryPhotos.length}/9)
              </h3>
              {isOwnProfile && galleryPhotos.length < 9 && (
                <>
                  <input
                    type="file"
                    id="gallery-upload"
                    accept="image/*"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleGalleryUpload(f); e.target.value = ''; }}
                    className="hidden"
                    disabled={uploadingGallery}
                  />
                  <label htmlFor="gallery-upload"
                    className={`px-3 py-1.5 text-xs font-semibold rounded border border-[#E2E8F0] text-[#64748B] hover:bg-[#F6F8FC] transition-colors ${uploadingGallery ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                    {uploadingGallery ? 'Uploading...' : '+ Add photo'}
                  </label>
                </>
              )}
            </div>
            {galleryPhotos.length === 0 ? (
              <div className="py-8 text-center text-[#94A3B8] text-sm bg-[#F6F8FC] rounded-lg border border-dashed border-[#E2E8F0]">
                {isOwnProfile ? 'No gallery photos yet. Add up to 9 photos.' : 'No gallery photos.'}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {galleryPhotos.map(photo => (
                  <div key={photo.id} className="relative group aspect-square rounded-lg overflow-hidden bg-[#F6F8FC]">
                    {photo.url ? (
                      <img
                        src={photo.url}
                        alt="Gallery"
                        className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => setLightboxPhoto(photo.url)}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#94A3B8] text-xs">No image</div>
                    )}
                    {isOwnProfile && (
                      <button
                        onClick={() => handleGalleryDelete(photo.id)}
                        className="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white rounded-full text-xs font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border-none"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <button
            onClick={() => setLightboxPhoto(null)}
            className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center text-xl font-bold border-none cursor-pointer transition-colors"
          >
            ×
          </button>
          <img
            src={lightboxPhoto}
            alt="Gallery photo"
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default UserProfile;
