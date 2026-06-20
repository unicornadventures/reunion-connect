import React from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  details?: string[];
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
  showCheckbox?: boolean;
  checkboxLabel?: string;
  onConfirm: (cascadeUsers?: boolean) => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  details,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDangerous = false,
  showCheckbox = false,
  checkboxLabel = 'Also delete related users',
  onConfirm,
  onCancel,
}) => {
  const [cascadeUsers, setCascadeUsers] = React.useState(false);

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
        zIndex: 1000,
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
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginBottom: '15px', color: '#333', textAlign: 'center' }}>{title}</h2>
        <p style={{ marginBottom: '15px', color: '#666', lineHeight: '1.5' }}>{message}</p>

        {details && details.length > 0 && (
          <div style={{ marginBottom: '20px', backgroundColor: '#f5f5f5', padding: '12px', borderRadius: '4px' }}>
            <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', color: '#333', fontSize: '14px' }}>This will delete:</p>
            <ul style={{ margin: '0', paddingLeft: '20px', color: '#666', fontSize: '14px' }}>
              {details.map((detail, index) => (
                <li key={index}>{detail}</li>
              ))}
            </ul>
          </div>
        )}

        {showCheckbox && (
          <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="checkbox"
              id="cascade-users-checkbox"
              checked={cascadeUsers}
              onChange={(e) => setCascadeUsers(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor="cascade-users-checkbox" style={{ cursor: 'pointer', fontSize: '14px', color: '#333' }}>
              {checkboxLabel}
            </label>
          </div>
        )}

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
            {cancelText}
          </button>
          <button
            onClick={() => onConfirm(cascadeUsers)}
            style={{
              padding: '10px 20px',
              backgroundColor: isDangerous ? '#f44336' : '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
