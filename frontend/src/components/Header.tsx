import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

const Header: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAppContext();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-[100] bg-white border-b-2 border-[#4CAF50] shadow-[0_2px_4px_rgba(0,0,0,0.1)] h-[60px] flex items-center px-5">
      <div className="max-w-[1200px] w-full mx-auto flex items-center justify-between">
        <Link
          to="/"
          className="text-xl font-bold text-[#4CAF50] hover:opacity-80 transition-opacity flex items-center gap-2"
        >
          🎓 ReunionConnect
        </Link>

        <nav className="hidden md:flex items-center gap-[30px]">
          <Link
            to="/"
            className="text-sm font-medium text-[#333333] hover:text-[#4CAF50] transition-colors duration-200"
          >
            🎓 Home
          </Link>
          <Link
            to="/directory"
            className="text-sm font-medium text-[#333333] hover:text-[#4CAF50] transition-colors duration-200"
          >
            📖 Directory
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            to="/profile"
            className="flex items-center gap-2 text-sm font-medium text-[#333333] hover:text-[#4CAF50] transition-colors duration-200"
          >
            <div className="w-8 h-8 rounded-full bg-[#4CAF50] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              YO
            </div>
            <span className="hidden sm:inline">My Profile</span>
          </Link>
          <button
            onClick={handleLogout}
            className="text-xs text-[#999999] hover:text-[#f44336] transition-colors duration-200 font-medium ml-2"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
