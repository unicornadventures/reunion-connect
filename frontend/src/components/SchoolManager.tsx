import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { adminSchoolAPI } from '../apiClient';

const SchoolManager: React.FC = () => {
  const { currentUser } = useAppContext();
  const [schools, setSchools] = useState<any[]>([]);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolLocation, setNewSchoolLocation] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    if (currentUser?.id) {
      fetchSchools();
    }
  }, [currentUser?.id]);

  const fetchSchools = async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    try {
      const response = await adminSchoolAPI.getSchools(String(currentUser.id));
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
        await adminSchoolAPI.updateSchool(editingId, newSchoolName, String(currentUser?.id), newSchoolLocation);
        setEditingId(null);
      } else {
        await adminSchoolAPI.createSchool(newSchoolName, String(currentUser?.id), newSchoolLocation);
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

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this school?')) return;
    try {
      await adminSchoolAPI.deleteSchool(id, String(currentUser?.id));
      fetchSchools();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete school.');
    }
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
    </div>
  );
};

export default SchoolManager;