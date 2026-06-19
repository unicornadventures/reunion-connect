import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { CurrentUser } from '../types';
import api from '@/api';

interface AppContextType {
  currentUser: CurrentUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (user: CurrentUser) => void;
  logout: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const isAuthenticated = !!currentUser;

  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await api.get('/auth/me');

        if (response.data && response.data.user) {
          setCurrentUser(response.data.user);
        }
      } catch (err) {
        setCurrentUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  const login = (user: CurrentUser) => {
    setCurrentUser(user);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error('Logout request failed:', err);
    } finally {
      setCurrentUser(null);
    }
  };

  return (
    <AppContext.Provider value={{ currentUser, isAuthenticated, loading, login, logout }}>
      {loading ? (
        <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
          🔄 Securing session context...
        </div>
      ) : (
        children
      )}
    </AppContext.Provider>
  );
};

export default AppProvider;

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};