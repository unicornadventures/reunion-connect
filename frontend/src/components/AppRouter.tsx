import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import Login from './Login';
import Header from './Header';
import AdminHeader from './AdminHeader';
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
      {isSuperAdmin ? <AdminHeader /> : <Header />}

      <div className="max-w-[1200px] mx-auto">
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

export default AppRouter;