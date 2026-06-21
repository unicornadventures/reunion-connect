import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import api from '../api';
import ConfirmModal from './ConfirmModal';
import UserDeletionWarning from './UserDeletionWarning';

interface User {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

interface School {
  id: number;
  name: string;
}

interface Class {
  id: number;
  year: number;
}

const STORAGE_KEY = 'usersManagerState';

interface StoredState {
  selectedSchoolId: number | null;
  selectedClassId: number | null;
  searchLastName: string;
  currentPage: number;
}

const selectClass = 'border border-[#E2E8F0] rounded px-4 py-3 text-sm focus:outline-none focus:border-[#E8A93E] focus:ring-1 focus:ring-[#E8A93E] transition-colors bg-white w-full';

const UsersManager: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAppContext();
  const isInitialMount = React.useRef(true);
  const restoredStateRef = React.useRef<StoredState | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [searchLastName, setSearchLastName] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 10;
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; userId: number | null }>({ isOpen: false, userId: null });
  const [userDeletionWarning, setUserDeletionWarning] = useState<{ isOpen: boolean; userId: number | null }>({ isOpen: false, userId: null });

  const saveState = (state: StoredState) => sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const restoreState = (): StoredState | null => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  };

  useEffect(() => {
    fetchSchools();
    if (isInitialMount.current) {
      isInitialMount.current = false;
      const savedState = restoreState();
      if (savedState) {
        restoredStateRef.current = savedState;
        setSelectedSchoolId(savedState.selectedSchoolId);
        setSearchLastName(savedState.searchLastName);
        setCurrentPage(savedState.currentPage);
      }
    }
  }, []);

  useEffect(() => {
    if (selectedSchoolId) {
      const restoreClassId = restoredStateRef.current?.selectedClassId ?? null;
      fetchClassesForSchool(selectedSchoolId, restoredStateRef.current ? restoreClassId : undefined);
      restoredStateRef.current = null;
      saveState({ selectedSchoolId, selectedClassId, searchLastName, currentPage });
    }
  }, [selectedSchoolId]);

  useEffect(() => {
    if (selectedClassId) fetchUsers();
  }, [selectedClassId, currentPage, searchLastName]);

  useEffect(() => {
    saveState({ selectedSchoolId, selectedClassId, searchLastName, currentPage });
  }, [selectedClassId, currentPage, searchLastName]);

  const fetchSchools = async () => {
    try {
      const response = await api.get('/schools');
      setSchools(response.data.schools || []);
    } catch {
      setError('Failed to fetch schools.');
    }
  };

  const fetchClassesForSchool = async (schoolId: number, restoreClassId?: number | null) => {
    try {
      const response = await api.get(`/schools/${schoolId}/classes`);
      setClasses(response.data.classes || []);
      if (restoreClassId !== undefined) {
        setSelectedClassId(restoreClassId);
      } else {
        setSelectedClassId(null);
        setUsers([]);
      }
    } catch {
      setError('Failed to fetch classes.');
    }
  };

  const fetchUsers = async () => {
    if (!selectedClassId) return;
    setLoading(true);
    try {
      const response = await api.get(`/admin/classes/${selectedClassId}/users`, {
        params: { page: currentPage, pageSize, lastName: searchLastName }
      });
      setUsers(response.data.users || []);
      setTotalUsers(response.data.total || 0);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch users.');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = () => {
    setDeleteModal({ isOpen: false, userId: null });
    setUserDeletionWarning({ isOpen: true, userId: deleteModal.userId });
  };

  const handleConfirmUserDeletion = async () => {
    if (userDeletionWarning.userId === null) return;
    try {
      await api.delete(`/admin/users/${userDeletionWarning.userId}`);
      setUserDeletionWarning({ isOpen: false, userId: null });
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete user.');
      setUserDeletionWarning({ isOpen: false, userId: null });
    }
  };

  const totalPages = Math.ceil(totalUsers / pageSize);

  return (
    <div className="max-w-[1200px] mx-auto px-5 py-8">
      <h1 className="font-display text-4xl font-bold text-[#0E2240] uppercase tracking-tight mb-6">
        Users Management
      </h1>

      {error && (
        <div className="bg-[#FFEBEE] text-[#C62828] border border-[#EF5350] rounded px-4 py-3 text-sm mb-6">
          {error}
        </div>
      )}

      {/* Filter panel */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-6 mb-6">
        <p className="text-xs font-semibold text-[#94A3B8] tracking-[0.15em] uppercase mb-4">Filter Users</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-[#0E2240] mb-1.5">School</label>
            <select
              value={selectedSchoolId || ''}
              onChange={e => setSelectedSchoolId(e.target.value ? parseInt(e.target.value) : null)}
              className={selectClass}
            >
              <option value="" disabled>— Select school —</option>
              {schools.map(school => (
                <option key={school.id} value={school.id}>{school.name}</option>
              ))}
            </select>
          </div>

          {selectedSchoolId && classes.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-[#0E2240] mb-1.5">Class year</label>
              <select
                value={selectedClassId || ''}
                onChange={e => setSelectedClassId(e.target.value ? parseInt(e.target.value) : null)}
                className={selectClass}
              >
                <option value="" disabled>— Select year —</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>Class of {c.year}</option>
                ))}
              </select>
            </div>
          )}

          {selectedClassId && (
            <div>
              <label className="block text-sm font-semibold text-[#0E2240] mb-1.5">Search by last name</label>
              <input
                type="text"
                placeholder="Enter last name"
                value={searchLastName}
                onChange={e => { setSearchLastName(e.target.value); setCurrentPage(1); }}
                className="border border-[#E2E8F0] rounded px-4 py-3 text-sm w-full focus:outline-none focus:border-[#E8A93E] focus:ring-1 focus:ring-[#E8A93E] transition-colors placeholder:text-[#CBD5E1]"
              />
            </div>
          )}
        </div>
      </div>

      {selectedClassId && (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-[#94A3B8] tracking-[0.15em] uppercase">
              Users ({totalUsers}){searchLastName && ` — "${searchLastName}"`}
            </p>
          </div>

          {loading ? (
            <div className="text-center text-[#94A3B8] text-sm py-8">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-lg py-10 text-center text-sm text-[#94A3B8]">
              No users found.
            </div>
          ) : (
            <>
              <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden mb-5">
                {users.map((user, idx) => (
                  <div
                    key={user.id}
                    className={`flex items-center justify-between px-5 py-4 ${idx < users.length - 1 ? 'border-b border-[#E2E8F0]' : ''}`}
                  >
                    <button
                      onClick={() => navigate(`/admin/user/${user.id}`)}
                      className="text-left bg-transparent border-none cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      <div className="text-sm font-semibold text-[#0E2240]">
                        {user.last_name}, {user.first_name}
                      </div>
                      <div className="text-xs text-[#94A3B8] mt-0.5">{user.email}</div>
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/admin/user/${user.id}`)}
                        className="px-3 py-1.5 bg-[#E2E8F0] text-[#0E2240] rounded text-xs font-semibold hover:opacity-80 cursor-pointer transition-opacity border-none"
                      >
                        View
                      </button>
                      <button
                        onClick={() => setDeleteModal({ isOpen: true, userId: user.id })}
                        className="px-3 py-1.5 bg-[#f44336] text-white rounded text-xs font-semibold hover:opacity-90 cursor-pointer transition-opacity border-none"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className={`px-4 py-2 rounded text-sm font-semibold border-none transition-opacity ${
                      currentPage === 1
                        ? 'bg-[#E2E8F0] text-[#94A3B8] cursor-not-allowed'
                        : 'bg-[#0E2240] text-white hover:opacity-90 cursor-pointer'
                    }`}
                  >
                    Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-9 h-9 rounded text-sm font-semibold border-none cursor-pointer transition-opacity ${
                          page === currentPage
                            ? 'bg-[#0E2240] text-white'
                            : 'bg-[#E2E8F0] text-[#64748B] hover:opacity-80'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className={`px-4 py-2 rounded text-sm font-semibold border-none transition-opacity ${
                      currentPage === totalPages
                        ? 'bg-[#E2E8F0] text-[#94A3B8] cursor-not-allowed'
                        : 'bg-[#0E2240] text-white hover:opacity-90 cursor-pointer'
                    }`}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        title="Delete User"
        message="Are you sure you want to delete this user?"
        details={['All user profiles and data', 'All comments written by and about this user', 'All S3 photographs']}
        confirmText="Delete"
        cancelText="Cancel"
        isDangerous={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModal({ isOpen: false, userId: null })}
      />

      <UserDeletionWarning
        isOpen={userDeletionWarning.isOpen}
        userCount={1}
        onConfirm={handleConfirmUserDeletion}
        onCancel={() => setUserDeletionWarning({ isOpen: false, userId: null })}
      />
    </div>
  );
};

export default UsersManager;
