import React from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import Login from './Login';
import Dashboard from './Dashboard';
import SchoolManager from './SchoolManager';
import ClassManager from './ClassManager';
import UserProfile from './UserProfile';
import CommentSection from './CommentSection';

const AppRouter: React.FC = () => {
  const { currentUser, isAuthenticated } = useAppContext();

  if (!isAuthenticated) {
    return <Login />;
  }

  const isAdmin = currentUser?.is_admin || false;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <nav style={{ display: 'flex', gap: '20px', borderBottom: '1px solid #ddd', paddingBottom: '10px', marginBottom: '20px' }}>
        <Link to="/" style={{ fontWeight: 'bold', color: '#4CAF50', textDecoration: 'none' }}>Dashboard</Link>
        {isAdmin && (
          <>
            <Link to="/admin/schools" style={{ textDecoration: 'none', color: '#333' }}>Schools</Link>
            <Link to="/admin/classes" style={{ textDecoration: 'none', color: '#333' }}>Classes</Link>
          </>
        )}
        <Link to="/profile" style={{ textDecoration: 'none', color: '#333' }}>Profile</Link>
        <Link to="/comments" style={{ textDecoration: 'none', color: '#333' }}>Comments</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Dashboard currentUser={currentUser} />} />
        <Route path="/admin/schools" element={isAdmin ? <SchoolManager /> : <Navigate to="/" replace />} />
        <Route path="/admin/classes" element={isAdmin ? <ClassManager /> : <Navigate to="/" replace />} />
        <Route path="/profile" element={<UserProfile userId={currentUser.user_id} />} />
        <Route path="/comments" element={<CommentSection targetUserId={currentUser.user_id} commenterId={currentUser.user_id} />} />
      </Routes>
    </div>
  );
};

export default AppRouter;