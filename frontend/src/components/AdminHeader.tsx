import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

const AdminHeader: React.FC = () => {
  const navigate = useNavigate();
  const { logout, currentUser } = useAppContext();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getInitials = () => {
    const firstName = currentUser?.first_name || '';
    const lastName = currentUser?.last_name || '';
    const firstInitial = firstName.charAt(0).toUpperCase();
    const lastInitial = lastName.charAt(0).toUpperCase();
    return (firstInitial + lastInitial) || '?';
  };

  return (
    <header className="sticky top-0 z-[100] bg-[#0E2240] h-16 flex items-center px-5">
      <div className="max-w-[1200px] w-full mx-auto flex items-center justify-between">
        <Link
          to="/admin/schools"
          className="font-display text-xl font-bold text-[#E8A93E] tracking-tight hover:opacity-90 transition-opacity"
        >
          ReunionConnect
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {currentUser?.is_admin && (
            <>
              <Link
                to="/admin/schools"
                className="text-sm font-medium text-white/70 hover:text-[#E8A93E] transition-colors duration-200"
              >
                Schools
              </Link>
              <Link
                to="/admin/classes"
                className="text-sm font-medium text-white/70 hover:text-[#E8A93E] transition-colors duration-200"
              >
                Classes
              </Link>
              <Link
                to="/admin/users"
                className="text-sm font-medium text-white/70 hover:text-[#E8A93E] transition-colors duration-200"
              >
                Users
              </Link>
              <Link
                to="/admin/events"
                className="text-sm font-medium text-white/70 hover:text-[#E8A93E] transition-colors duration-200"
              >
                Events
              </Link>
            </>
          )}
          {(currentUser?.is_admin || currentUser?.is_class_admin) && (
            <Link
              to="/admin/comments"
              className="text-sm font-medium text-white/70 hover:text-[#E8A93E] transition-colors duration-200"
            >
              Comments
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-white/70">
            <div className="w-8 h-8 rounded-full bg-[#E8A93E] flex items-center justify-center text-[#0E2240] text-xs font-bold flex-shrink-0">
              {getInitials()}
            </div>
            <span className="hidden sm:inline">Admin</span>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-white/40 hover:text-white/70 transition-colors duration-200 font-medium ml-2"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;
