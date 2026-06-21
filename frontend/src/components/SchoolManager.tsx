import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { adminSchoolAPI } from '../apiClient';
import ConfirmModal from './ConfirmModal';
import UserDeletionWarning from './UserDeletionWarning';

const SchoolManager: React.FC = () => {
  const { currentUser } = useAppContext();
  const [schools, setSchools] = useState<any[]>([]);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolLocation, setNewSchoolLocation] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: number | null }>({ isOpen: false, id: null });
  const [userDeletionWarning, setUserDeletionWarning] = useState<{ isOpen: boolean; schoolId: number | null; userCount: number }>({ isOpen: false, schoolId: null, userCount: 0 });
  const [pendingCascadeDelete, setPendingCascadeDelete] = useState(false);

  useEffect(() => {
    fetchSchools();
  }, []);

  const fetchSchools = async () => {
    setLoading(true);
    try {
      const response = await adminSchoolAPI.getSchools();
      setSchools(response.data.schools);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching schools:', err);
      setError(err.response?.data?.error || err.message || 'Failed to fetch schools.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await adminSchoolAPI.createSchool(newSchoolName, newSchoolLocation);
        setEditingId(null);
      } else {
        await adminSchoolAPI.createSchool(newSchoolName, newSchoolLocation);
      }
      setNewSchoolName('');
      setNewSchoolLocation('');
      fetchSchools();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save school.');
    }
  };

  const handleEdit = (school: any) => {
    setEditingId(school.id);
    setNewSchoolName(school.name);
    setNewSchoolLocation(school.location || '');
  };

  const handleDelete = (id: number) => {
    setDeleteModal({ isOpen: true, id });
  };

  const handleConfirmDelete = async () => {
    if (deleteModal.id === null) return;
    try {
      await adminSchoolAPI.deleteSchool(deleteModal.id);
      setSchools(prev => prev.filter(s => s.id !== deleteModal.id));
      setDeleteModal({ isOpen: false, id: null });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete school.');
      setDeleteModal({ isOpen: false, id: null });
    }
  };

  const handleConfirmUserDeletion = async () => {
    setUserDeletionWarning({ isOpen: false, schoolId: null, userCount: 0 });
    setPendingCascadeDelete(false);
  };

  const handleCancelUserDeletion = () => {
    setUserDeletionWarning({ isOpen: false, schoolId: null, userCount: 0 });
    setPendingCascadeDelete(false);
  };

  const handleCancelDelete = () => {
    setDeleteModal({ isOpen: false, id: null });
  };

  const handleCancel = () => {
    setEditingId(null);
    setNewSchoolName('');
    setNewSchoolLocation('');
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading schools...</div>;

  return (
    <div style={{ padding: '20px' }}>
      <h2>School Management</h2>

      {error && <div style={{ padding: '12px', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '4px', marginBottom: '20px' }}>{error}</div>}

      <form onSubmit={handleSubmit} style={{ marginBottom: '30px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
        <h3>{editingId ? 'Edit School' : 'Add New School'}</h3>
        <input
          type="text"
          placeholder="School Name"
          value={newSchoolName}
          onChange={(e) => setNewSchoolName(e.target.value)}
          required
          style={{ padding: '8px', marginRight: '10px', width: '30%' }}
        />
        <input
          type="text"
          placeholder="Location"
          value={newSchoolLocation}
          onChange={(e) => setNewSchoolLocation(e.target.value)}
          style={{ padding: '8px', marginRight: '10px', width: '30%' }}
        />
        <button type="submit" style={{ padding: '8px 15px', backgroundColor: '#4CAF50', color: 'white', border: 'none', cursor: 'pointer', marginRight: '10px' }}>
          {editingId ? 'Update' : 'Add'} School
        </button>
        {editingId && (
          <button type="button" onClick={handleCancel} style={{ padding: '8px 15px', backgroundColor: '#666', color: 'white', border: 'none', cursor: 'pointer' }}>
            Cancel
          </button>
        )}
      </form>

      <h3>Registered Schools ({schools.length})</h3>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {schools.map((school) => (
          <li key={school.id} style={{ padding: '10px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>{school.name}</strong> - {school.location || 'N/A'}
            </div>
            <div>
              <button onClick={() => handleEdit(school)} style={{ padding: '5px 10px', marginRight: '10px', backgroundColor: '#2196F3', color: 'white', border: 'none', cursor: 'pointer' }}>
                Edit
              </button>
              <button onClick={() => handleDelete(school.id)} style={{ padding: '5px 10px', backgroundColor: '#f44336', color: 'white', border: 'none', cursor: 'pointer' }}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        title={`Delete ${schools.find(s => s.id === deleteModal.id)?.name || 'School'}`}
        message="This is permanent and cannot be undone."
        details={[
          'All class years for this school',
          'All members assigned to those classes',
          'All member profiles and account information',
          'All comments written by or about those members',
          'All photographs uploaded by those members',
          'All events associated with those classes',
        ]}
        confirmText="Delete School"
        cancelText="Cancel"
        isDangerous={true}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />

      <UserDeletionWarning
        isOpen={userDeletionWarning.isOpen}
        userCount={userDeletionWarning.userCount || 1}
        onConfirm={handleConfirmUserDeletion}
        onCancel={handleCancelUserDeletion}
      />
    </div>
  );
};

export default SchoolManager;