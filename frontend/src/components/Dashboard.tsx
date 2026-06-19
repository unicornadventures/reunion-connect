import React from 'react';
import { useAppContext } from '../context/AppContext';
import { User } from '../types';
import SchoolManager from './SchoolManager';
import ClassManager from './ClassManager';
import UserProfile from './UserProfile';

const Dashboard: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  const { logout } = useAppContext();

  return (
    <div style={{ padding: '20px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
        <h1 style={{color: '#4CAF50'}}>Class Reunion Dashboard</h1>
        <button onClick={logout} style={{ padding: '8px 15px', cursor: 'pointer' }}>
          Logout ({currentUser.first_name})
        </button>
      </header>
      <div style={{ marginTop: '20px' }}>
        <h2 style={{ color: '#333' }}>Welcome, {currentUser.first_name}!</h2>
        <p>Your ID: {currentUser.user_id}</p>
        <p>Email: {currentUser.email}</p>
        <p>Status: Authenticated</p>
        
        <div style={{ marginTop: '40px', display: 'flex', gap: '20px' }}>
          <div style={{ flex: 1 }}>
            <h3 style={{borderBottom: '1px solid #eee', paddingBottom: '10px'}}>School Management</h3>
            <SchoolManager />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{borderBottom: '1px solid #eee', paddingBottom: '10px'}}>Class Management</h3>
            <ClassManager />
          </div>
        </div>
        
        <div style={{ marginTop: '40px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
            <h3 style={{color: '#333'}}>My Profile</h3>
            <UserProfile userId={currentUser.user_id} />
        </div>
      </div >
    </div>
  );
};

export default Dashboard;