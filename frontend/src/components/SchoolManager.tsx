import React, { useState, useEffect } from 'react';
import { schoolAPI } from '../apiClient';

const SchoolManager: React.FC = () => {
  const [schools, setSchools] = useState<any[]>([]);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolLocation, setNewSchoolLocation] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSchools();
  }, []);

  const fetchSchools = async () => {
    try {
      const response = await schoolAPI.getSchools();
      setSchools(response.data.schools);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch schools.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await schoolAPI.createSchool(newSchoolName, newSchoolLocation);
      // Success: Clear form and refresh list
      setNewSchoolName('');
      setNewSchoolLocation('');
      fetchSchools();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create school.');
    }
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading schools...</div>;
  if (error) return <div style={{ padding: '20px', color: 'red' }}>Error: {error}</div>;

  return (
    <div style={{ padding: '20px' }}>
      <h2>School Management</h2>
      
      {/* Creation Form */}
      <form onSubmit={handleSubmit} style={{ marginBottom: '30px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
        <h3>Add New School</h3>
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
        <button type="submit" style={{ padding: '8px 15px', backgroundColor: '#4CAF50', color: 'white', border: 'none', cursor: 'pointer' }}>
          Add School
        </button>
      </form>

      {/* School List */}
      <h3>Registered Schools ({schools.length})</h3>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {schools.map((school) => (
          <li key={school.school_id} style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
            <strong>{school.name}</strong> - {school.location || 'N/A'}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SchoolManager;