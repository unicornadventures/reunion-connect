import React, { useState, useEffect } from 'react';
import { adminClassAPI, schoolAPI } from '../apiClient';
import ConfirmModal from './ConfirmModal';

const ClassManager: React.FC = () => {
  const [classes, setClasses] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | null>(null);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newYear, setNewYear] = useState('');
  const [addingYear, setAddingYear] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: number; year: number } | null>(null);

  useEffect(() => {
    schoolAPI.getSchools()
      .then(res => setSchools(res.data.schools || []))
      .catch(() => setError('Failed to fetch schools.'))
      .finally(() => setLoadingSchools(false));
  }, []);

  useEffect(() => {
    if (!selectedSchoolId) {
      setClasses([]);
      return;
    }
    setLoadingClasses(true);
    adminClassAPI.getClasses(selectedSchoolId)
      .then(res => setClasses(res.data.classes || []))
      .catch(() => setError('Failed to fetch classes.'))
      .finally(() => setLoadingClasses(false));
  }, [selectedSchoolId]);

  const handleSchoolChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setError(null);
    setNewYear('');
    setSelectedSchoolId(e.target.value ? parseInt(e.target.value) : null);
  };

  const handleDeleteClass = (classId: number, year: number) => {
    setPendingDelete({ id: classId, year });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await adminClassAPI.deleteClass(pendingDelete.id);
      setClasses(prev => prev.filter(c => c.id !== pendingDelete.id));
    } catch {
      setError(`Failed to delete class year ${pendingDelete.year}.`);
    } finally {
      setPendingDelete(null);
    }
  };

  const handleAddYear = async (e: React.FormEvent) => {
    e.preventDefault();
    const year = parseInt(newYear);
    if (!year || year < 1900 || year > 2100) {
      setError('Enter a valid year between 1900 and 2100.');
      return;
    }
    if (classes.some(c => c.year === year)) {
      setError(`Class year ${year} already exists for this school.`);
      return;
    }
    setAddingYear(true);
    setError(null);
    try {
      const res = await adminClassAPI.createClass(selectedSchoolId!, year);
      setClasses(prev => [...prev, res.data.class].sort((a, b) => b.year - a.year));
      setNewYear('');
    } catch {
      setError(`Failed to add class year ${year}.`);
    } finally {
      setAddingYear(false);
    }
  };

  if (loadingSchools) return <div style={{ padding: '20px' }}>Loading schools...</div>;

  const selectedSchool = schools.find(s => s.id === selectedSchoolId);
  const sortedClasses = classes.slice().sort((a, b) => b.year - a.year);

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ marginBottom: '30px' }}>Class Management</h2>

      {error && (
        <div style={{ padding: '12px', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '4px', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Select School:</label>
        <select
          value={selectedSchoolId || ''}
          onChange={handleSchoolChange}
          style={{ padding: '8px 12px', minWidth: '250px', fontSize: '14px' }}
        >
          <option value="">-- Select a school --</option>
          {schools.map(school => (
            <option key={school.id} value={school.id}>{school.name}</option>
          ))}
        </select>
      </div>

      {!selectedSchoolId && (
        <div style={{ color: '#666', fontStyle: 'italic' }}>Select a school to view its class years.</div>
      )}

      {selectedSchoolId && (
        <>
          <form onSubmit={handleAddYear} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '24px' }}>
            <label style={{ fontWeight: 600 }}>Add Class Year:</label>
            <input
              type="number"
              value={newYear}
              onChange={e => setNewYear(e.target.value)}
              placeholder="e.g. 2026"
              min="1900"
              max="2100"
              style={{ padding: '8px 12px', width: '120px', fontSize: '14px' }}
            />
            <button
              type="submit"
              disabled={addingYear || !newYear}
              style={{ padding: '8px 16px', backgroundColor: '#1976d2', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
            >
              {addingYear ? 'Adding...' : 'Add'}
            </button>
          </form>

          {loadingClasses ? (
            <div>Loading classes for {selectedSchool?.name}...</div>
          ) : (
            <>
              <h3 style={{ marginBottom: '12px' }}>
                {selectedSchool?.name} — {classes.length} class year{classes.length !== 1 ? 's' : ''}
              </h3>
              {classes.length === 0 ? (
                <div style={{ color: '#666', fontStyle: 'italic' }}>No classes found for this school.</div>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, columns: 4, columnGap: '16px' }}>
                  {sortedClasses.map(c => (
                    <li key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee', breakInside: 'avoid' }}>
                      <span>{c.year}</span>
                      <button
                        onClick={() => handleDeleteClass(c.id, c.year)}
                        title="Delete class year"
                        style={{ background: 'none', border: 'none', color: '#c62828', cursor: 'pointer', fontSize: '16px', padding: '0 4px', lineHeight: 1 }}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}
      <ConfirmModal
        isOpen={!!pendingDelete}
        title={`Delete Class Year ${pendingDelete?.year}`}
        message={`Deleting class year ${pendingDelete?.year} is permanent and cannot be undone.`}
        details={[
          'All members assigned to this class year',
          'All profiles and account information for those members',
          'All comments written by or about those members',
          'All photographs uploaded by those members',
        ]}
        confirmText="Delete Class Year"
        isDangerous
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};

export default ClassManager;
