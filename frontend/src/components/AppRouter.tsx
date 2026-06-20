import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import Login from './Login';
import Registration from './Registration';
import ForgotPassword from './ForgotPassword';
import ResetPassword from './ResetPassword';
import VerifyEmail from './VerifyEmail';
import Header from './Header';
import AdminHeader from './AdminHeader';
import WelcomePage from './WelcomePage';
import SchoolManager from './SchoolManager';
import ClassManager from './ClassManager';
import UsersManager from './UsersManager';
import AdminUserProfile from './AdminUserProfile';
import UserProfile from './UserProfile';
import CommentSection from './CommentSection';
import DirectoryPage from './DirectoryPage';
import UserCommentsPage from './UserCommentsPage';
import EventsPage from './EventsPage';

const AppRouter: React.FC = () => {
  const { currentUser, isAuthenticated } = useAppContext();

  const isSuperAdmin = currentUser?.is_admin || false;
  const isClassAdmin = currentUser?.is_class_admin || false;

  // Public auth routes (accessible when not authenticated)
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Registration />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Authenticated routes
  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      {isSuperAdmin ? <AdminHeader /> : <Header />}

      <div className="max-w-[1200px] mx-auto">
        <Routes>
          <Route path="/" element={<WelcomePage currentUser={currentUser} />} />
          <Route path="/directory" element={!isSuperAdmin ? <DirectoryPage /> : <Navigate to="/" replace />} />
          <Route path="/events" element={!isSuperAdmin ? <EventsPage /> : <Navigate to="/" replace />} />
          <Route path="/user/:userId" element={!isSuperAdmin ? <UserCommentsPage /> : <Navigate to="/" replace />} />
          <Route path="/admin/user/:userId" element={isSuperAdmin ? <AdminUserProfile /> : <Navigate to="/" replace />} />
          <Route path="/admin/schools" element={isSuperAdmin ? <SchoolManager /> : <Navigate to="/" replace />} />
          <Route path="/admin/classes" element={isSuperAdmin ? <ClassManager /> : <Navigate to="/" replace />} />
          <Route path="/admin/users" element={isSuperAdmin ? <UsersManager /> : <Navigate to="/" replace />} />
          <Route path="/profile" element={!isSuperAdmin ? <UserProfile /> : <Navigate to="/" replace />} />
          <Route path="/comments" element={!isSuperAdmin ? <CommentSection /> : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
};

export default AppRouter;