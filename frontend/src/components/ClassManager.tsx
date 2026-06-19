import React, { useState, useEffect } from 'react';
import api from '@/api';


const ClassManager: React.FC = () => {
  const [classes, setClasses] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]); // 🚨 Added separate state for schools
  const [newYear, setNewYear] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch both datasets on initialization
    Promise.all([fetchClasses(), fetchSchools()])
      .finally(() => setLoading(false));
  }, []);

  const fetchClasses = async () => {
    try {
      const response = await api.get(`/classes`);
      // Defensive handling: check if wrapped or default to empty array
      const data = Array.isArray(response.data) ? response.data : (response.data?.classes || []);
      setClasses(data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch classes.');
    }
  };

  // 🚨 Added to fetch available schools for the form dropdown selection
  const fetchSchools = async () => {
    try {
      const response = await api.get(`/schools`);
      const data = Array.isArray(response.data) ? response.data : (response.data?.schools || []);
      setSchools(data);
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
      await api.post(`/classes`, {
        school_id: selectedSchoolId,
        year: parseInt(newYear),
      });
      // Success: Clear form and refresh classes layout list
      setNewYear('');
      fetchClasses();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create class.');
    }
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading application data...</div>;
  if (error) return <div style={{ padding: '20px', color: 'red' }}>Error: {error}</div>;

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ marginBottom: '30px' }}>Class Management</h2>
      
      {/* Creation Form */}
      <form onSubmit={handleSubmit} style={{ marginBottom: '30px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
        <h3 style={{ marginBottom: '15px' }}>Add New Class</h3>
        
        <label style={{ display: 'block', marginBottom: '10px' }}>Select School:</label>
        <select
          value={selectedSchoolId || ''}
          onChange={(e) => setSelectedSchoolId(parseInt(e.target.value))}
          required
          style={{ padding: '8px', marginRight: '10px' }}
        >
          <option value="" disabled>-- Select School --</option>
          {/* 🚨 FIXED: Now mapping over the safe schools array */}
          {Array.isArray(schools) && schools.map((school) => (
            <option key={school.school_id} value={school.school_id}>
              {school.school_name}
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
        <button type="submit" style={{ padding: '8px 15px', backgroundColor: '#4CAF50', color: 'white', border: 'none', cursor: 'pointer' }}>
          Add Class
        </button>
      </form>

      {/* Class List */}
      <h3 style={{ marginTop: '30px' }}>Registered Classes ({classes.length})</h3>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {/* 🚨 FIXED: Safe array verification fallback */}
        {Array.isArray(classes) && classes.map((classEntity) => (
          <li key={classEntity.class_id} style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
            {classEntity.school_name} - Year {classEntity.year}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ClassManager;