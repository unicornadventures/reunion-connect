import React from 'react';
import { useAppContext } from '../context/AppContext';
import { CurrentUser } from '../types';

const WelcomePage: React.FC<{ currentUser: CurrentUser }> = ({ currentUser }) => {
  const { logout } = useAppContext();

  return (
    <div style={styles.pageContainer}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>🎓 Class Reunion</h1>
          <p style={styles.subtitle}>Connect with Your Class</p>
        </div>
        <button onClick={logout} style={styles.logoutButton}>
          Logout ({currentUser.first_name})
        </button>
      </header>

      <div style={styles.contentContainer}>
        <section style={styles.welcomeSection}>
          <h2 style={styles.sectionTitle}>Welcome back, {currentUser.first_name}! 👋</h2>
          <p style={styles.sectionText}>
            We're excited to see you here. Use the navigation menu to explore the Class Reunion platform.
          </p>
        </section>

        <section style={styles.quickStatsSection}>
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statIcon}>📧</div>
              <h3>Account</h3>
              <p>{currentUser.email}</p>
              <small style={styles.statDetail}>Member since {new Date(currentUser.created_at).toLocaleDateString()}</small>
            </div>

            <div style={styles.statCard}>
              <div style={styles.statIcon}>👤</div>
              <h3>Profile</h3>
              <p>{currentUser.first_name} {currentUser.last_name}</p>
              <small style={styles.statDetail}>View and edit your profile</small>
            </div>

            <div style={styles.statCard}>
              <div style={styles.statIcon}>💬</div>
              <h3>Comments</h3>
              <p>Share memories</p>
              <small style={styles.statDetail}>Leave comments for classmates</small>
            </div>

            {currentUser.is_admin && (
              <div style={styles.statCard}>
                <div style={styles.statIcon}>⚙️</div>
                <h3>Admin</h3>
                <p>Manage content</p>
                <small style={styles.statDetail}>Schools, Classes, Users</small>
              </div>
            )}
          </div>
        </section>

        <section style={styles.navigationSection}>
          <h3 style={styles.navigationTitle}>Quick Navigation</h3>
          <div style={styles.navigationGrid}>
            <div style={styles.navItem}>
              <h4 style={styles.navItemTitle}>👤 Profile</h4>
              <p>View and edit your personal profile, upload photos, and update your information.</p>
            </div>
            <div style={styles.navItem}>
              <h4 style={styles.navItemTitle}>💬 Comments</h4>
              <p>Leave comments on your profile and see memories shared by classmates.</p>
            </div>
            {currentUser.is_admin && (
              <>
                <div style={styles.navItem}>
                  <h4 style={styles.navItemTitle}>🏫 Manage Schools</h4>
                  <p>Create and manage schools in the system.</p>
                </div>
                <div style={styles.navItem}>
                  <h4 style={styles.navItemTitle}>📚 Manage Classes</h4>
                  <p>Create and manage class years for schools.</p>
                </div>
              </>
            )}
          </div>
        </section>

        <section style={styles.infoSection}>
          <h3 style={styles.infoTitle}>About Class Reunion</h3>
          <p style={styles.infoText}>
            Class Reunion is a platform to reconnect with your classmates, share memories, and stay in touch.
            Upload photos from different years, leave comments, and explore who's on the platform from your class.
          </p>
        </section>
      </div>
    </div>
  );
};

const styles = {
  pageContainer: {
    minHeight: '100vh',
    backgroundColor: '#f9f9f9',
  },
  header: {
    backgroundColor: 'white',
    padding: '20px 40px',
    borderBottom: '2px solid #4CAF50',
    display: 'flex' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  title: {
    margin: 0,
    color: '#4CAF50',
    fontSize: '32px',
  },
  subtitle: {
    margin: '5px 0 0 0',
    color: '#666',
    fontSize: '14px',
  },
  logoutButton: {
    padding: '10px 20px',
    backgroundColor: '#f44336',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold' as const,
  },
  contentContainer: {
    maxWidth: '1200px',
    margin: '40px auto',
    padding: '0 20px',
  },
  welcomeSection: {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '8px',
    marginBottom: '30px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  sectionTitle: {
    color: '#333',
    margin: '0 0 15px 0',
    fontSize: '24px',
  },
  sectionText: {
    color: '#666',
    margin: 0,
    lineHeight: '1.6',
  },
  quickStatsSection: {
    marginBottom: '30px',
  },
  statsGrid: {
    display: 'grid' as const,
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' as const,
    gap: '20px',
  },
  statCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    textAlign: 'center' as const,
  },
  statIcon: {
    fontSize: '32px',
    marginBottom: '10px',
  },
  statDetail: {
    color: '#999',
    display: 'block' as const,
    marginTop: '8px',
  },
  navigationSection: {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '8px',
    marginBottom: '30px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  navigationTitle: {
    color: '#333',
    margin: '0 0 20px 0',
    fontSize: '20px',
  },
  navigationGrid: {
    display: 'grid' as const,
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' as const,
    gap: '20px',
  },
  navItem: {
    padding: '15px',
    backgroundColor: '#f5f5f5',
    borderRadius: '4px',
    borderLeft: '4px solid #4CAF50',
  },
  navItemTitle: {
    margin: '0 0 8px 0',
    color: '#333',
    fontSize: '16px',
  },
  infoSection: {
    backgroundColor: '#e8f5e9',
    padding: '30px',
    borderRadius: '8px',
    marginBottom: '30px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  infoTitle: {
    color: '#2e7d32',
    margin: '0 0 15px 0',
    fontSize: '20px',
  },
  infoText: {
    color: '#555',
    margin: 0,
    lineHeight: '1.6',
  },
};

export default WelcomePage;
