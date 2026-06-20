import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { adminClassAPI, schoolAPI } from '../apiClient';
import ConfirmModal from './ConfirmModal';

const ClassManager: React.FC = () => {
  const { currentUser } = useAppContext();
  const [classes, setClasses] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [newYear, setNewYear] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: number | null }>({ isOpen: false, id: null });

  useEffect(() => {
    if (currentUser?.id) {
      Promise.all([fetchClasses(), fetchSchools()]).finally(() => setLoading(false));
    }
  }, [currentUser?.id]);

  const fetchClasses = async () => {
    try {
      const response = await adminClassAPI.getClasses(String(currentUser?.id));
      setClasses(response.data.classes);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch classes.');
    }
  };

  const fetchSchools = async () => {
    try {
      const response = await schoolAPI.getSchools();
      setSchools(response.data.schools);
    } catch (err: any) {
      console.error('Failed to fetch schools:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchoolId) {
      setError("Please select a school.");
      return;
    }
    try {
      if (editingId) {
        await adminClassAPI.updateClass(editingId, selectedSchoolId, parseInt(newYear), String(currentUser?.id));
        setEditingId(null);
      } else {
        await adminClassAPI.createClass(selectedSchoolId, parseInt(newYear), String(currentUser?.id));
      }
      setNewYear('');
      setSelectedSchoolId(null);
      fetchClasses();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save class.');
    }
  };

  const handleEdit = (classEntity: any) => {
    setEditingId(classEntity.id);
    setSelectedSchoolId(classEntity.school_id);
    setNewYear(String(classEntity.year));
  };

  const handleDelete = (id: number) => {
    setDeleteModal({ isOpen: true, id });
  };

  const handleConfirmDelete = async (cascadeUsers?: boolean) => {
    if (deleteModal.id === null) return;
    try {
      await adminClassAPI.deleteClass(deleteModal.id, String(currentUser?.id), cascadeUsers);
      setDeleteModal({ isOpen: false, id: null });
      fetchClasses();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete class.');
      setDeleteModal({ isOpen: false, id: null });
    }
  };

  const handleCancelDelete = () => {
    setDeleteModal({ isOpen: false, id: null });
  };

  const handleCancel = () => {
    setEditingId(null);
    setNewYear('');
    setSelectedSchoolId(null);
  };

  // Generate available years (current year back to 1950)
  const generateAvailableYears = () => {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let year = currentYear; year >= 1950; year--) {
      years.push(year);
    }
    return years;
  };

  // Filter out years that already exist in the classes list
  const getFilteredYears = () => {
    const availableYears = generateAvailableYears();
    const usedYears = new Set(classes.map((c) => c.year));
    return availableYears.filter((year) => !usedYears.has(year));
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading application data...</div>;

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ marginBottom: '30px' }}>Class Management</h2>

      {error && <div style={{ padding: '12px', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '4px', marginBottom: '20px' }}>{error}</div>}

      <form onSubmit={handleSubmit} style={{ marginBottom: '30px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
        <h3 style={{ marginBottom: '15px' }}>{editingId ? 'Edit Class' : 'Add New Class'}</h3>

        <label style={{ display: 'block', marginBottom: '10px' }}>Select School:</label>
        <select
          value={selectedSchoolId || ''}
          onChange={(e) => setSelectedSchoolId(parseInt(e.target.value))}
          required
          style={{ padding: '8px', marginRight: '10px' }}
        >
          <option value="" disabled>-- Select School --</option>
          {Array.isArray(schools) && schools.map((school) => (
            <option key={school.id} value={school.id}>
              {school.name}
            </option>
          ))}
        </select>

        <label style={{ display: 'block', marginBottom: '10px', marginTop: '15px' }}>Year:</label>
        <select
          value={newYear}
          onChange={(e) => setNewYear(e.target.value)}
          required
          style={{ padding: '8px', marginRight: '10px', width: '150px' }}
        >
          <option value="" disabled>-- Select Year --</option>
          {getFilteredYears().map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        <button type="submit" style={{ padding: '8px 15px', backgroundColor: '#4CAF50', color: 'white', border: 'none', cursor: 'pointer', marginRight: '10px' }}>
          {editingId ? 'Update' : 'Add'} Class
        </button>
        {editingId && (
          <button type="button" onClick={handleCancel} style={{ padding: '8px 15px', backgroundColor: '#666', color: 'white', border: 'none', cursor: 'pointer' }}>
            Cancel
          </button>
        )}
      </form>

      <h3 style={{ marginTop: '30px' }}>Registered Classes ({classes.length})</h3>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {Array.isArray(classes) && classes.map((classEntity) => (
          <li key={classEntity.id} style={{ padding: '10px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              {classEntity.school_name} - Year {classEntity.year}
            </div>
            <div>
              <button onClick={() => handleEdit(classEntity)} style={{ padding: '5px 10px', marginRight: '10px', backgroundColor: '#2196F3', color: 'white', border: 'none', cursor: 'pointer' }}>
                Edit
              </button>
              <button onClick={() => handleDelete(classEntity.id)} style={{ padding: '5px 10px', backgroundColor: '#f44336', color: 'white', border: 'none', cursor: 'pointer' }}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        title="Delete Class"
        message="Are you sure you want to delete this class? This action cannot be undone."
        details={[
          'All user assignments to this class',
          'All comments and data associated with class members'
        ]}
        confirmText="Delete"
        cancelText="Cancel"
        isDangerous={true}
        showCheckbox={true}
        checkboxLabel="Also delete all users assigned to this class"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
};

export default ClassManager;