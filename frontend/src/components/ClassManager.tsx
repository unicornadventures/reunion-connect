import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { adminClassAPI, schoolAPI } from '../apiClient';

const ClassManager: React.FC = () => {
  const { currentUser } = useAppContext();
  const [classes, setClasses] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [newYear, setNewYear] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

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

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this class?')) return;
    try {
      await adminClassAPI.deleteClass(id, String(currentUser?.id));
      fetchClasses();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete class.');
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setNewYear('');
    setSelectedSchoolId(null);
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
        <input
          type="number"
          placeholder="Year (e.g., 2025)"
          value={newYear}
          onChange={(e) => setNewYear(e.target.value)}
          required
          style={{ padding: '8px', marginRight: '10px', width: '150px' }}
        />
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
    </div>
  );
};

export default ClassManager;