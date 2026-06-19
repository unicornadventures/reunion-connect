import React from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import Login from './Login';
import WelcomePage from './WelcomePage';
import SchoolManager from './SchoolManager';
import ClassManager from './ClassManager';
import UserProfile from './UserProfile';
import CommentSection from './CommentSection';
import DirectoryPage from './DirectoryPage';
import UserCommentsPage from './UserCommentsPage';

const AppRouter: React.FC = () => {
  const { currentUser, isAuthenticated } = useAppContext();

  if (!isAuthenticated) {
    return <Login />;
  }

  const isSuperAdmin = currentUser?.is_admin || false;
  const isClassAdmin = currentUser?.is_class_admin || false;

  return (
    <div>
      <nav style={styles.nav}>
        <div style={styles.navContent}>
          <Link to="/" style={styles.navBrand}>🎓 Class Reunion</Link>
          <div style={styles.navLinks}>
            {!isSuperAdmin && (
              <>
                <Link to="/directory" style={styles.navLink}>Directory</Link>
                <Link to="/profile" style={styles.navLink}>Profile</Link>
                <Link to="/comments" style={styles.navLink}>Comments</Link>
              </>
            )}
            {isSuperAdmin && (
              <>
                <Link to="/admin/schools" style={styles.navLink}>Schools</Link>
                <Link to="/admin/classes" style={styles.navLink}>Classes</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <div style={styles.container}>
        <Routes>
          <Route path="/" element={<WelcomePage currentUser={currentUser} />} />
          <Route path="/directory" element={!isSuperAdmin ? <DirectoryPage /> : <Navigate to="/" replace />} />
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