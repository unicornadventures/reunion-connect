import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import Login from './Login';
import Header from './Header';
import WelcomePage from './WelcomePage';
import SchoolManager from './SchoolManager';
import ClassManager from './ClassManager';
import UserProfile from './UserProfile';
import CommentSection from './CommentSection';
import DirectoryPage from './DirectoryPage';
import UserCommentsPage from './UserCommentsPage';
import EventsPage from './EventsPage';

const AppRouter: React.FC = () => {
  const { currentUser, isAuthenticated } = useAppContext();

  if (!isAuthenticated) {
    return <Login />;
  }

  const isSuperAdmin = currentUser?.is_admin || false;
  const isClassAdmin = currentUser?.is_class_admin || false;

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      {!isSuperAdmin && <Header />}

      <div className="max-w-[1200px] mx-auto">{isSuperAdmin && (
        <nav className="sticky top-0 z-[100] bg-white border-b-2 border-[#4CAF50] shadow-[0_2px_4px_rgba(0,0,0,0.1)] h-[60px] flex items-center px-5 mb-6">
          <div className="flex items-center gap-8">
            <span className="text-xl font-bold text-[#4CAF50]">🎓 Class Reunion - Admin</span>
            <div className="flex gap-6">
              <a href="/admin/schools" className="text-sm font-medium text-[#333333] hover:text-[#4CAF50]">Schools</a>
              <a href="/admin/classes" className="text-sm font-medium text-[#333333] hover:text-[#4CAF50]">Classes</a>
            </div>
          </div>
        </nav>
      )}
        <Routes>
          <Route path="/" element={<WelcomePage currentUser={currentUser} />} />
          <Route path="/directory" element={!isSuperAdmin ? <DirectoryPage /> : <Navigate to="/" replace />} />
          <Route path="/events" element={!isSuperAdmin ? <EventsPage /> : <Navigate to="/" replace />} />
          <Route path="/user/:userId" element={!isSuperAdmin ? <UserCommentsPage /> : <Navigate to="/" replace />} />
          <Route path="/admin/schools" element={isSuperAdmin ? <SchoolManager /> : <Navigate to="/" replace />} />
          <Route path="/admin/classes" element={isSuperAdmin ? <ClassManager /> : <Navigate to="/" replace />} />
          <Route path="/profile" element={!isSuperAdmin ? <UserProfile /> : <Navigate to="/" replace />} />
          <Route path="/comments" element={!isSuperAdmin ? <CommentSection /> : <Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
};

const styles = {
  nav: {
    backgroundColor: 'white',
    borderBottom: '2px solid #4CAF50',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    position: 'sticky' as const,
    top: 0,
    zIndex: 100,
  },
  navContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 20px',
    display: 'flex' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    height: '60px',
  },
  navBrand: {
    fontSize: '20px',
    fontWeight: 'bold' as const,
    color: '#4CAF50',
    textDecoration: 'none',
  },
  navLinks: {
    display: 'flex' as const,
    gap: '30px',
  },
  navLink: {
    textDecoration: 'none',
    color: '#333',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'color 0.2s',
    cursor: 'pointer',
  },
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
  },
};

export default AppRouter;