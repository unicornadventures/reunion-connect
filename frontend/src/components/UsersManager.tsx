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

interface PaginatedUsers {
  users: User[];
  total: number;
  page: number;
  pageSize: number;
}

const UsersManager: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAppContext();
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

  useEffect(() => {
    fetchSchools();
  }, []);

  useEffect(() => {
    if (selectedSchoolId) {
      fetchClassesForSchool(selectedSchoolId);
    }
  }, [selectedSchoolId]);

  useEffect(() => {
    if (selectedClassId) {
      fetchUsers();
    }
  }, [selectedClassId, currentPage, searchLastName]);

  const fetchSchools = async () => {
    try {
      const response = await api.get('/schools');
      setSchools(response.data.schools || []);
      setError(null);
    } catch (err: any) {
      setError('Failed to fetch schools.');
    }
  };

  const fetchClassesForSchool = async (schoolId: number) => {
    try {
      const response = await api.get('/classes');
      const allClasses = response.data.classes || [];
      const filtered = allClasses.filter((c: any) => c.school_id === schoolId);
      setClasses(filtered);
      setSelectedClassId(null);
      setUsers([]);
      setError(null);
    } catch (err: any) {
      setError('Failed to fetch classes.');
    }
  };

  const fetchUsers = async () => {
    if (!selectedClassId) return;

    setLoading(true);
    try {
      const response = await api.get(`/admin/classes/${selectedClassId}/users`, {
        params: {
          page: currentPage,
          pageSize,
          lastName: searchLastName,
        },
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

  const handleDelete = (userId: number) => {
    setDeleteModal({ isOpen: true, userId });
  };

  const handleConfirmDelete = () => {
    setDeleteModal({ isOpen: false, userId: null });
    setUserDeletionWarning({ isOpen: true, userId: deleteModal.userId });
  };

  const handleCancelDelete = () => {
    setDeleteModal({ isOpen: false, userId: null });
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

  const handleCancelUserDeletion = () => {
    setUserDeletionWarning({ isOpen: false, userId: null });
  };

  const totalPages = Math.ceil(totalUsers / pageSize);

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ marginBottom: '30px' }}>Users Management</h2>

      {error && <div style={{ padding: '12px', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '4px', marginBottom: '20px' }}>{error}</div>}

      <div style={{ marginBottom: '30px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px', backgroundColor: '#f9f9f9' }}>
        <h3 style={{ marginBottom: '15px' }}>Filter Users</h3>

        <label style={{ display: 'block', marginBottom: '10px' }}>Select School:</label>
        <select
          value={selectedSchoolId || ''}
          onChange={(e) => setSelectedSchoolId(e.target.value ? parseInt(e.target.value) : null)}
          style={{ padding: '8px', marginRight: '10px', marginBottom: '15px' }}
        >
          <option value="" disabled>-- Select School --</option>
          {schools.map((school) => (
            <option key={school.id} value={school.id}>
              {school.name}
            </option>
          ))}
        </select>

        {selectedSchoolId && classes.length > 0 && (
          <>
            <label style={{ display: 'block', marginBottom: '10px' }}>Select Class Year:</label>
            <select
              value={selectedClassId || ''}
              onChange={(e) => setSelectedClassId(e.target.value ? parseInt(e.target.value) : null)}
              style={{ padding: '8px', marginRight: '10px', marginBottom: '15px' }}
            >
              <option value="" disabled>-- Select Year --</option>
              {classes.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>
                  Class of {classItem.year}
                </option>
              ))}
            </select>
          </>
        )}

        {selectedClassId && (
          <>
            <label style={{ display: 'block', marginBottom: '10px' }}>Search by Last Name:</label>
            <input
              type="text"
              placeholder="Enter last name"
              value={searchLastName}
              onChange={(e) => {
                setSearchLastName(e.target.value);
                setCurrentPage(1);
              }}
              style={{ padding: '8px', marginRight: '10px', marginBottom: '15px', width: '300px' }}
            />
          </>
        )}
      </div>

      {selectedClassId && (
        <>
          <h3 style={{ marginBottom: '15px' }}>
            Users ({totalUsers}) {searchLastName && `- Last Name: "${searchLastName}"`}
          </h3>

          {loading ? (
            <div style={{ textAlign: 'center', color: '#999999' }}>Loading users...</div>
          ) : users.length === 0 ? (
            <div style={{ padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '4px', textAlign: 'center', color: '#999999' }}>
              No users found.
            </div>
          ) : (
            <>
              <ul style={{ listStyle: 'none', padding: 0, marginBottom: '20px' }}>
                {users.map((user) => (
                  <li key={user.id} style={{ padding: '12px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ cursor: 'pointer', color: '#2196F3' }} onClick={() => navigate(`/admin/user/${user.id}`)}>
                      <strong>{user.last_name}, {user.first_name}</strong>
                      <div style={{ fontSize: '12px', color: '#999999' }}>{user.email}</div>
                    </div>
                    <div>
                      <button
                        onClick={() => navigate(`/admin/user/${user.id}`)}
                        style={{ padding: '5px 10px', marginRight: '10px', backgroundColor: '#2196F3', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        style={{ padding: '5px 10px', backgroundColor: '#f44336', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '20px' }}>
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: currentPage === 1 ? '#ddd' : '#2196F3',
                      color: 'white',
                      border: 'none',
                      cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                      borderRadius: '4px',
                    }}
                  >
                    Previous
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        style={{
                          padding: '8px 12px',
                          backgroundColor: page === currentPage ? '#4CAF50' : '#ddd',
                          color: page === currentPage ? 'white' : '#333',
                          border: 'none',
                          cursor: 'pointer',
                          borderRadius: '4px',
                        }}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: currentPage === totalPages ? '#ddd' : '#2196F3',
                      color: 'white',
                      border: 'none',
                      cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                      borderRadius: '4px',
                    }}
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
        onCancel={handleCancelDelete}
      />

      <UserDeletionWarning
        isOpen={userDeletionWarning.isOpen}
        userCount={1}
        onConfirm={handleConfirmUserDeletion}
        onCancel={handleCancelUserDeletion}
      />
    </div>
  );
};

export default UsersManager;
