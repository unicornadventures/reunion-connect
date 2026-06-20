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

  return (
    <header className="sticky top-0 z-[100] bg-white border-b-2 border-[#4CAF50] shadow-[0_2px_4px_rgba(0,0,0,0.1)] h-[60px] flex items-center px-5">
      <div className="max-w-[1200px] w-full mx-auto flex items-center justify-between">
        <Link
          to="/admin/schools"
          className="text-xl font-bold text-[#4CAF50] hover:opacity-80 transition-opacity flex items-center gap-2"
        >
          🎓 Admin Panel
        </Link>

        <nav className="hidden md:flex items-center gap-[30px]">
          <Link
            to="/admin/schools"
            className="text-sm font-medium text-[#333333] hover:text-[#4CAF50] transition-colors duration-200"
          >
            🏫 Schools
          </Link>
          <Link
            to="/admin/classes"
            className="text-sm font-medium text-[#333333] hover:text-[#4CAF50] transition-colors duration-200"
          >
            📚 Classes
          </Link>
          <Link
            to="/admin/users"
            className="text-sm font-medium text-[#333333] hover:text-[#4CAF50] transition-colors duration-200"
          >
            👥 Users
          </Link>
        </nav>

        <button
          onClick={handleLogout}
          className="text-xs text-[#999999] hover:text-[#f44336] transition-colors duration-200 font-medium"
        >
          Sign out
        </button>
      </div>
    </header>
  );
};

export default AdminHeader;
