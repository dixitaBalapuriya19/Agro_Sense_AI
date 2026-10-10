import React from 'react';
import ThemeToggle from './ThemeToggle';
import { t } from '../translations';

export default function Navbar({ 
  currentPage, 
  setCurrentPage, 
  language, 
  setLanguage, 
  isDark, 
  toggleTheme,
  pendingTasksCount = 0,
  user = null,
  onOpenAuth = () => {},
  onLogout = () => {}
}) {

  // Landing Page Navbar (overlay style)
  if (currentPage === 'home') {
    return (
      <div className="landing-nav">
        <button 
          className="landing-dashboard-chip"
          onClick={() => setCurrentPage('dashboard')}
          style={{
            background: 'var(--ui-panel, rgba(255,255,255,0.85))',
            border: '1px solid var(--ui-border, #e2e8f0)',
            borderRadius: '20px',
            padding: '6px 14px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--ui-text, #1e293b)'
          }}
        >
          <span>{language === 'gujarati' ? 'છોડ ડેશબોર્ડ' : 'Care Dashboard'}</span>
          {pendingTasksCount > 0 && (
            <span style={{
              background: 'var(--color-warning, #d97706)',
              color: '#ffffff',
              fontSize: '11px',
              padding: '1px 6px',
              borderRadius: '10px'
            }}>
              {pendingTasksCount}
            </span>
          )}
        </button>

        {user ? (
          <div className="user-profile-badge">
            <span className="user-avatar-circle" title={user.email || ''}>
              {(user.username || user.email || 'U')[0].toUpperCase()}
            </span>
            <span className="user-name-label">{user.username || 'Gardener'}</span>
            <button 
              className="user-logout-button"
              onClick={onLogout}
              title={language === 'gujarati' ? 'લૉગ આઉટ' : 'Sign out'}
            >
              {language === 'gujarati' ? 'બહાર નીકળો' : 'Sign Out'}
            </button>
          </div>
        ) : (
          <button 
            className="nav-auth-login-btn"
            onClick={onOpenAuth}
          >
            <span className="auth-icon">👤</span>
            <span>{language === 'gujarati' ? 'લૉગિન' : 'Sign In'}</span>
          </button>
        )}

        <div className="language-toggle">
          <button 
            className={`lang-btn ${language === 'english' ? 'active' : ''}`}
            onClick={() => setLanguage('english')}
          >
            eng
          </button>
          <button 
            className={`lang-btn ${language === 'gujarati' ? 'active' : ''}`}
            onClick={() => setLanguage('gujarati')}
          >
            ગુજ
          </button>
        </div>
        <ThemeToggle isDark={isDark} toggle={toggleTheme} />
      </div>
    );
  }

  // App Page Navbar (toolbar style)
  return (
    <nav className="app-toolbar">
      <div className="toolbar-left">
        <button 
          className="app-brand" 
          onClick={() => setCurrentPage('home')}
        >
          {t('plantHealthAI', language)}
        </button>
        <div className="app-nav-links">
          <button 
            className={`nav-link ${currentPage === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentPage('dashboard')}
          >
            {language === 'gujarati' ? 'ડેશબોર્ડ' : 'Dashboard'}
            {pendingTasksCount > 0 && (
              <span className="nav-badge-pill" style={{
                marginLeft: '6px',
                background: 'var(--color-warning, #d97706)',
                color: '#fff',
                fontSize: '10px',
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: '10px'
              }}>
                {pendingTasksCount}
              </span>
            )}
          </button>
          <button 
            className={`nav-link ${currentPage === 'analysis' ? 'active' : ''}`}
            onClick={() => setCurrentPage('analysis')}
          >
            {t('scanPlant', language)}
          </button>
          <button 
            className={`nav-link ${currentPage === 'environmental' ? 'active' : ''}`}
            onClick={() => setCurrentPage('environmental')}
          >
            {t('environmentalData', language)}
          </button>
          <button 
            className={`nav-link ${currentPage === 'basic' ? 'active' : ''}`}
            onClick={() => setCurrentPage('basic')}
          >
            {t('basicCare', language)}
          </button>
          <button 
            className={`nav-link ${currentPage === 'seasonal' ? 'active' : ''}`}
            onClick={() => setCurrentPage('seasonal')}
          >
            {t('seasonalCare', language)}
          </button>
        </div>
      </div>
      
      <div className="toolbar-right">
        {user ? (
          <div className="user-profile-badge">
            <span className="user-avatar-circle" title={user.email || ''}>
              {(user.username || user.email || 'U')[0].toUpperCase()}
            </span>
            <span className="user-name-label">{user.username || 'Gardener'}</span>
            <button 
              className="user-logout-button"
              onClick={onLogout}
              title={language === 'gujarati' ? 'લૉગ આઉટ' : 'Sign out'}
            >
              {language === 'gujarati' ? 'બહાર નીકળો' : 'Sign Out'}
            </button>
          </div>
        ) : (
          <button 
            className="nav-auth-login-btn"
            onClick={onOpenAuth}
          >
            <span className="auth-icon">👤</span>
            <span>{language === 'gujarati' ? 'લૉગિન' : 'Sign In'}</span>
          </button>
        )}

        <div className="language-toggle">
          <button 
            className={`lang-btn ${language === 'english' ? 'active' : ''}`}
            onClick={() => setLanguage('english')}
          >
            eng
          </button>
          <button 
            className={`lang-btn ${language === 'gujarati' ? 'active' : ''}`}
            onClick={() => setLanguage('gujarati')}
          >
            ગુજ
          </button>
        </div>
        <ThemeToggle isDark={isDark} toggle={toggleTheme} />
      </div>
    </nav>
  );
}
