import { useState } from 'react'
import { motion } from 'framer-motion'
import { API_BASE_URLS } from '../config/api'

export default function AuthModal({ isOpen, onClose, onSuccess, language = 'english' }) {
  const isGu = language === 'gujarati'
  const [mode, setMode] = useState('login') // 'login' | 'register'
  
  // Form fields
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  
  // State
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  if (!isOpen) return null

  const resetForm = () => {
    setUsername('')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setError(null)
    setSuccessMsg(null)
  }

  const switchMode = (newMode) => {
    setMode(newMode)
    setError(null)
    setSuccessMsg(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)

    if (mode === 'register') {
      if (!username.trim() || !email.trim() || !password) {
        setError(isGu ? 'કૃપા કરીને બધી વિગતો ભરો.' : 'Please fill in all required fields.')
        return
      }
      if (password.length < 6) {
        setError(isGu ? 'પાસવર્ડ ઓછામાં ઓછો ૬ અક્ષરનો હોવો જોઈએ.' : 'Password must be at least 6 characters.')
        return
      }
      if (password !== confirmPassword) {
        setError(isGu ? 'પાસવર્ડ મેળ ખાતો નથી.' : 'Passwords do not match.')
        return
      }
    } else {
      if (!email.trim() || !password) {
        setError(isGu ? 'કૃપા કરીને ઈમેઈલ અને પાસવર્ડ દાખલ કરો.' : 'Please provide your email/username and password.')
        return
      }
    }

    setLoading(true)
    const endpoint = mode === 'register' 
      ? `${API_BASE_URLS[0]}/auth/register` 
      : `${API_BASE_URLS[0]}/auth/login`

    const payload = mode === 'register'
      ? { username: username.trim(), email: email.trim(), password }
      : { email: email.trim(), password }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || (isGu ? 'પ્રમાણીકરણ નિષ્ફળ થયું.' : 'Authentication failed.'))
      }

      setSuccessMsg(mode === 'register' 
        ? (isGu ? 'ખાતું સફળતાપૂર્વક બન્યું!' : 'Account registered successfully!') 
        : (isGu ? 'સફળતાપૂર્વક લૉગિન થયું!' : 'Welcome back!'))

      setTimeout(() => {
        onSuccess({
          user: data.user,
          token: data.token,
          isNewRegistration: mode === 'register'
        })
        resetForm()
        onClose()
      }, 700)

    } catch (err) {
      console.error('Auth error:', err)
      setError(err.message || (isGu ? 'સર્વર સાથે સંપર્ક થઈ શક્યો નથી.' : 'Could not reach server. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-modal-backdrop" onClick={onClose}>
      <motion.div 
        className="auth-modal-card"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
      >
        <button className="auth-close-btn" onClick={onClose} aria-label="Close modal">
          &times;
        </button>

        {/* Brand Header */}
        <div className="auth-header">
          <div className="auth-brand-badge">🌿 AgroSense</div>
          <h2>
            {mode === 'login' 
              ? (isGu ? 'તમારા ગાર્ડનમાં પ્રવેશ કરો' : 'Access Your Garden') 
              : (isGu ? 'નવું ખાતું બનાવો' : 'Join AgroSense')}
          </h2>
          <p className="auth-subtitle">
            {mode === 'login'
              ? (isGu ? 'તમારા વ્યક્તિગત છોડ અને સ્કેન હિસ્ટ્રી જોવા માટે લૉગિન કરો.' : 'Sign in to access your tracked plants, personalized care, and scan history.')
              : (isGu ? 'તમારા છોડના આરોગ્યનો કાયમી રેકોર્ડ રાખવા માટે નોંધણી કરો.' : 'Create an account to keep your personal plant collection synced securely.')}
          </p>
        </div>

        {/* Tab switchers */}
        <div className="auth-tab-switch">
          <button 
            type="button"
            className={`auth-tab-btn ${mode === 'login' ? 'active' : ''}`}
            onClick={() => switchMode('login')}
          >
            {isGu ? 'લૉગિન' : 'Sign In'}
          </button>
          <button 
            type="button"
            className={`auth-tab-btn ${mode === 'register' ? 'active' : ''}`}
            onClick={() => switchMode('register')}
          >
            {isGu ? 'નવું ખાતું (Register)' : 'Create Account'}
          </button>
        </div>

        {error && (
          <div className="auth-alert error">
            <span className="auth-alert-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="auth-alert success">
            <span className="auth-alert-icon">✅</span>
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'register' && (
            <div className="auth-field">
              <label htmlFor="reg-username">
                {isGu ? 'વપરાશકર્તા નામ' : 'Username'}
              </label>
              <input 
                id="reg-username"
                type="text"
                placeholder={isGu ? 'દા.ત. RajanGardener' : 'e.g. GardenHero'}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="auth-email">
              {mode === 'login' 
                ? (isGu ? 'ઈમેઈલ અથવા વપરાશકર્તા નામ' : 'Email or Username') 
                : (isGu ? 'ઈમેઈલ સરનામું' : 'Email Address')}
            </label>
            <input 
              id="auth-email"
              type={mode === 'login' ? 'text' : 'email'}
              placeholder={mode === 'login' ? 'user@example.com' : 'you@urbanfarm.org'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete={mode === 'login' ? 'username' : 'email'}
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="auth-pass">
              {isGu ? 'પાસવર્ડ' : 'Password'}
            </label>
            <input 
              id="auth-pass"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
            />
          </div>

          {mode === 'register' && (
            <div className="auth-field">
              <label htmlFor="reg-pass-confirm">
                {isGu ? 'પાસવર્ડની પુષ્ટિ કરો' : 'Confirm Password'}
              </label>
              <input 
                id="reg-pass-confirm"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
          )}

          <button 
            type="submit" 
            className="auth-submit-btn" 
            disabled={loading}
          >
            {loading ? (
              <span className="auth-btn-spinner"></span>
            ) : mode === 'login' ? (
              isGu ? 'પ્રવેશ કરો (Log In)' : 'Sign In to AgroSense'
            ) : (
              isGu ? 'ખાતું બનાવો (Create Account)' : 'Create Free Account'
            )}
          </button>
        </form>

        <div className="auth-footer-prompt">
          {mode === 'login' ? (
            <p>
              {isGu ? 'નવું ખાતું જોઈએ છે? ' : "Don't have an account? "}
              <button type="button" className="auth-link-text" onClick={() => switchMode('register')}>
                {isGu ? 'અહીં નોંધણી કરો' : 'Sign up free'}
              </button>
            </p>
          ) : (
            <p>
              {isGu ? 'પહેલેથી જ ખાતું છે? ' : 'Already registered? '}
              <button type="button" className="auth-link-text" onClick={() => switchMode('login')}>
                {isGu ? 'અહીં લૉગિન કરો' : 'Sign in'}
              </button>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  )
}
