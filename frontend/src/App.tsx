import React from 'react';
import axios from 'axios'; // 🚨 1. Add this import
import AppRouter from './components/AppRouter';

// FORCE COOKIES TO TRANSFER ON ALL CROSS-PORT ENDPOINTS
axios.defaults.withCredentials = true;

const App: React.FC = () => {
  return (
    <div className="App">
      <AppRouter />
    </div>
  );
};

export default App;