import React from 'react';

interface UserDeletionWarningProps {
  isOpen: boolean;
  userCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

const UserDeletionWarning: React.FC<UserDeletionWarningProps> = ({
  isOpen,
  userCount,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1001,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '30px',
          maxWidth: '450px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          textAlign: 'left',
          borderLeft: '4px solid #f44336',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginBottom: '20px', color: '#333', textAlign: 'center' }}>⚠️ Warning</h2>
        <p style={{ marginBottom: '15px', color: '#666', lineHeight: '1.5', fontSize: '16px' }}>
          You are about to delete <strong>{userCount} user{userCount !== 1 ? 's' : ''}</strong>. This will permanently remove:
        </p>

        <div style={{ marginBottom: '20px', backgroundColor: '#fff3cd', padding: '12px', borderRadius: '4px', borderLeft: '3px solid #ffc107' }}>
          <ul style={{ margin: '0', paddingLeft: '20px', color: '#333', fontSize: '14px' }}>
            <li>All user profiles and account information</li>
            <li>All comments written by and received by these users</li>
            <li>All photographs stored in S3</li>
            <li>All class assignments</li>
            <li style={{ fontWeight: 'bold', marginTop: '10px' }}>This action CANNOT be undone</li>
          </ul>
        </div>

        <p style={{ marginBottom: '20px', color: '#c62828', fontSize: '14px', fontWeight: 'bold' }}>
          Please confirm you want to proceed with permanent deletion of {userCount} user{userCount !== 1 ? 's' : ''}.
        </p>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '10px 20px',
              backgroundColor: '#ddd',
              color: '#333',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '10px 20px',
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Yes, Delete Users
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserDeletionWarning;
