import React, { useState, useEffect } from 'react';
import { adminClassAPI, classAPI, schoolAPI } from '../apiClient';
import ConfirmModal from './ConfirmModal';

const ClassManager: React.FC = () => {
  const [allYears, setAllYears] = useState<{ id: number; year: number }[]>([]);
  const [linkedClasses, setLinkedClasses] = useState<{ id: number; year: number }[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | null>(null);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState('');
  const [addingYear, setAddingYear] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: number; year: number } | null>(null);

  useEffect(() => {
    Promise.all([
      schoolAPI.getSchools(),
      classAPI.getAllClasses(),
    ])
      .then(([schoolsRes, classesRes]) => {
        setSchools(schoolsRes.data.schools || []);
        setAllYears(classesRes.data.classes || []);
      })
      .catch(() => setError('Failed to load data.'))
      .finally(() => setLoadingSchools(false));
  }, []);

  useEffect(() => {
    if (!selectedSchoolId) { setLinkedClasses([]); return; }
    setLoadingClasses(true);
    adminClassAPI.getClasses(selectedSchoolId)
      .then(res => setLinkedClasses(res.data.classes || []))
      .catch(() => setError('Failed to fetch classes.'))
      .finally(() => setLoadingClasses(false));
  }, [selectedSchoolId]);

  const handleSchoolChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setError(null);
    setSelectedYear('');
    setSelectedSchoolId(e.target.value ? parseInt(e.target.value) : null);
  };

  const availableYears = allYears.filter(c => !linkedClasses.some(lc => lc.id === c.id));

  const handleAddYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedYear) return;
    const year = parseInt(selectedYear);
    setAddingYear(true);
    setError(null);
    try {
      const res = await adminClassAPI.createClass(selectedSchoolId!, year);
      setLinkedClasses(prev => [...prev, res.data.class].sort((a, b) => b.year - a.year));
      setSelectedYear('');
    } catch (err: any) {
      setError(err?.response?.data?.error || `Failed to add class year ${year}.`);
    } finally {
      setAddingYear(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete || !selectedSchoolId) return;
    try {
      await adminClassAPI.unlinkClass(selectedSchoolId, pendingDelete.id);
      setLinkedClasses(prev => prev.filter(c => c.id !== pendingDelete.id));
    } catch {
      setError(`Failed to remove class year ${pendingDelete.year}.`);
    } finally {
      setPendingDelete(null);
    }
  };

  const selectClass = 'border border-[#E2E8F0] rounded px-4 py-3 text-sm focus:outline-none focus:border-[#E8A93E] focus:ring-1 focus:ring-[#E8A93E] transition-colors bg-white';

  if (loadingSchools) {
    return (
      <div className="max-w-[1200px] mx-auto px-5 py-8">
        <div className="text-center text-[#94A3B8] text-sm">Loading...</div>
      </div>
    );
  }

  const selectedSchool = schools.find(s => s.id === selectedSchoolId);
  const sortedClasses = linkedClasses.slice().sort((a, b) => b.year - a.year);

  return (
    <div className="max-w-[1200px] mx-auto px-5 py-8">
      <h1 className="font-display text-4xl font-bold text-[#0E2240] uppercase tracking-tight mb-6">
        Class Management
      </h1>

      {error && (
        <div className="bg-[#FFEBEE] text-[#C62828] border border-[#EF5350] rounded px-4 py-3 text-sm mb-6">
          {error}
        </div>
      )}

      {/* School selector */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-6 mb-6">
        <label className="block text-sm font-semibold text-[#0E2240] mb-1.5">Select school</label>
        <select value={selectedSchoolId || ''} onChange={handleSchoolChange} className={`${selectClass} min-w-[260px]`}>
          <option value="">— Select a school —</option>
          {schools.map(school => (
            <option key={school.id} value={school.id}>{school.name}</option>
          ))}
        </select>

        {!selectedSchoolId && (
          <p className="text-sm text-[#94A3B8] mt-3">Select a school to view and manage its class years.</p>
        )}
      </div>

      {selectedSchoolId && (
        <>
          {/* Add year form */}
          <div className="bg-white border border-[#E2E8F0] rounded-lg p-6 mb-6">
            <form onSubmit={handleAddYear} className="flex items-end gap-4 flex-wrap">
              <div>
                <label className="block text-sm font-semibold text-[#0E2240] mb-1.5">Add class year</label>
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(e.target.value)}
                  className={`${selectClass} w-[180px]`}
                  disabled={availableYears.length === 0}
                >
                  <option value="">— Select year —</option>
                  {availableYears.map(c => (
                    <option key={c.id} value={c.year}>{c.year}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={addingYear || !selectedYear}
                className={`px-5 py-3 rounded text-sm font-semibold border-none transition-opacity ${
                  addingYear || !selectedYear
                    ? 'bg-[#E2E8F0] text-[#94A3B8] cursor-not-allowed'
                    : 'bg-[#0E2240] text-white hover:opacity-90 cursor-pointer'
                }`}
              >
                {addingYear ? 'Adding...' : 'Add year'}
              </button>
            </form>
            {availableYears.length === 0 && linkedClasses.length > 0 && (
              <p className="text-xs text-[#94A3B8] mt-3">All available class years are already linked to this school.</p>
            )}
          </div>

          {/* Classes list */}
          {loadingClasses ? (
            <div className="text-center text-[#94A3B8] text-sm py-8">
              Loading classes for {selectedSchool?.name}...
            </div>
          ) : (
            <div>
              <p className="text-xs font-semibold text-[#94A3B8] tracking-[0.15em] uppercase mb-3">
                {selectedSchool?.name} — {linkedClasses.length} class year{linkedClasses.length !== 1 ? 's' : ''}
              </p>
              {linkedClasses.length === 0 ? (
                <div className="bg-white border border-[#E2E8F0] rounded-lg py-10 text-center text-sm text-[#94A3B8]">
                  No classes linked to this school yet.
                </div>
              ) : (
                <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden">
                  <div className="grid grid-cols-2 sm:grid-cols-4">
                    {sortedClasses.map(c => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0] border-r border-[#E2E8F0]"
                      >
                        <span className="text-sm font-semibold text-[#0E2240]">{c.year}</span>
                        <button
                          onClick={() => setPendingDelete({ id: c.id, year: c.year })}
                          title={`Remove class year ${c.year}`}
                          className="text-[#94A3B8] hover:text-[#f44336] text-lg leading-none bg-transparent border-none cursor-pointer transition-colors px-1"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <ConfirmModal
        isOpen={!!pendingDelete}
        title={`Remove Class Year ${pendingDelete?.year}`}
        message={`Removing class year ${pendingDelete?.year} from ${selectedSchool?.name} is permanent and cannot be undone.`}
        details={[
          'All members assigned to this class year at this school will lose their class assignment',
          'Member accounts will not be deleted',
        ]}
        confirmText="Remove Class Year"
        isDangerous
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};

export default ClassManager;
