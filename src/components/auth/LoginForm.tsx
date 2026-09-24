import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight, Loader2, Info, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface LoginFormProps {
  onSwitchToSignUp: () => void;
  onSwitchToForgotPassword: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onSwitchToSignUp,
  onSwitchToForgotPassword
}) => {
  const { signIn, loginAsDemo, authError, clearError, isConfigured } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Client validation errors
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      newErrors.email = 'Please enter your email.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address.';
    }

    if (!password) {
      newErrors.password = 'Please enter your password.';
    } else if (password.length < 6) {
      newErrors.password = 'Password must contain at least 6 characters.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await signIn({
        email,
        password,
        rememberMe
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: '440px', margin: '0 auto' }}>
      {/* Form Header */}
      <div style={{ marginBottom: '24px', textAlign: 'left' }}>
        <h2 style={{
          fontSize: '1.75rem',
          fontWeight: 800,
          color: '#1E293B',
          letterSpacing: '-0.02em',
          marginBottom: '6px'
        }}>
          Welcome Back
        </h2>
        <p style={{ color: '#64748B', fontSize: '0.92rem', margin: 0 }}>
          Log in to continue your personalized AI learning journey.
        </p>
      </div>

      {/* Supabase Configuration Banner (if credentials are still default placeholders) */}
      {!isConfigured && (
        <div style={{
          marginBottom: '18px',
          padding: '12px 14px',
          borderRadius: '12px',
          background: '#FFFBEB',
          border: '1px solid #FCD34D',
          color: '#92400E',
          fontSize: '0.82rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px'
        }}>
          <Info size={16} style={{ flexShrink: 0, marginTop: '2px', color: '#D97706' }} />
          <span>
            <strong>Supabase Setup Required:</strong> Add your project URL and public anon key to <code>.env</code> to connect real Supabase Auth.
          </span>
        </div>
      )}

      {/* Auth Error Alert */}
      {authError && (
        <div style={{
          marginBottom: '18px',
          padding: '12px 14px',
          borderRadius: '12px',
          background: '#FEF2F2',
          border: '1px solid #FECACA',
          color: '#DC2626',
          fontSize: '0.86rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'pulse-soft 0.2s ease'
        }}>
          <AlertCircle size={17} color="#DC2626" style={{ flexShrink: 0 }} />
          <span>{authError}</span>
        </div>
      )}

      {/* Main Login Form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }} noValidate>
        {/* Email Field */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.85rem',
            fontWeight: 700,
            color: '#1E293B',
            marginBottom: '6px'
          }}>
            Email Address
          </label>
          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: errors.email ? '#EF4444' : '#94A3B8',
              display: 'flex',
              alignItems: 'center',
              pointerEvents: 'none'
            }}>
              <Mail size={18} />
            </div>
            <input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                if (authError) clearError();
              }}
              style={{
                width: '100%',
                padding: '12px 16px 12px 42px',
                borderRadius: '12px',
                border: errors.email ? '1.5px solid #EF4444' : '1.5px solid var(--border-medium)',
                fontSize: '0.92rem',
                fontFamily: 'var(--font-family)',
                outline: 'none',
                backgroundColor: errors.email ? '#FEF2F2' : '#FFFFFF',
                transition: 'border-color 0.15s ease'
              }}
            />
          </div>
          {errors.email && (
            <p style={{ color: '#DC2626', fontSize: '0.78rem', marginTop: '4px', fontWeight: 600 }}>
              {errors.email}
            </p>
          )}
        </div>

        {/* Password Field */}
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '6px'
          }}>
            <label style={{
              fontSize: '0.85rem',
              fontWeight: 700,
              color: '#1E293B'
            }}>
              Password
            </label>
            <button
              type="button"
              onClick={onSwitchToForgotPassword}
              style={{
                border: 'none',
                background: 'transparent',
                color: '#4F46E5',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0
              }}
            >
              Forgot password?
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: errors.password ? '#EF4444' : '#94A3B8',
              display: 'flex',
              alignItems: 'center',
              pointerEvents: 'none'
            }}>
              <Lock size={18} />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                if (authError) clearError();
              }}
              style={{
                width: '100%',
                padding: '12px 42px 12px 42px',
                borderRadius: '12px',
                border: errors.password ? '1.5px solid #EF4444' : '1.5px solid var(--border-medium)',
                fontSize: '0.92rem',
                fontFamily: 'var(--font-family)',
                outline: 'none',
                backgroundColor: errors.password ? '#FEF2F2' : '#FFFFFF',
                transition: 'border-color 0.15s ease'
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '4px'
              }}
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && (
            <p style={{ color: '#DC2626', fontSize: '0.78rem', marginTop: '4px', fontWeight: 600 }}>
              {errors.password}
            </p>
          )}
        </div>

        {/* Remember Me Checkbox */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            id="rememberMe"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            style={{
              width: '16px',
              height: '16px',
              accentColor: '#4F46E5',
              cursor: 'pointer'
            }}
          />
          <label
            htmlFor="rememberMe"
            style={{
              fontSize: '0.84rem',
              color: '#475569',
              fontWeight: 500,
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            Remember me
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn btn-primary"
          style={{
            width: '100%',
            padding: '13px',
            fontSize: '0.96rem',
            borderRadius: '12px',
            marginTop: '4px',
            opacity: isSubmitting ? 0.85 : 1,
            cursor: isSubmitting ? 'not-allowed' : 'pointer'
          }}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
              <span>Signing you in...</span>
            </>
          ) : (
            <>
              <span>Login</span>
              <ArrowRight size={18} />
            </>
          )}
        </button>

        {/* Divider */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          margin: '4px 0',
          color: '#94A3B8',
          fontSize: '0.8rem'
        }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#E2E8F0' }} />
          <span>OR FOR PRESENTATION / DEMO</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#E2E8F0' }} />
        </div>

        {/* One-Click Presentation Demo Login Button */}
        <button
          type="button"
          disabled={isSubmitting}
          onClick={async () => {
            setIsSubmitting(true);
            try {
              await loginAsDemo();
            } finally {
              setIsSubmitting(false);
            }
          }}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '12px',
            border: '1.5px solid #FCD34D',
            background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
            color: '#92400E',
            fontWeight: 800,
            fontSize: '0.92rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.15)',
            transition: 'all 0.2s ease'
          }}
        >
          <Sparkles size={17} color="#D97706" />
          <span>Quick Demo Login (Sally Sharma • Class 10 CBSE)</span>
        </button>

        <div style={{
          padding: '8px 12px',
          borderRadius: '8px',
          backgroundColor: '#F8FAFC',
          border: '1px solid #E2E8F0',
          fontSize: '0.74rem',
          color: '#64748B',
          textAlign: 'center'
        }}>
          Demo Email: <strong>sally.demo@example.com</strong> • Password: <strong>Demo@123</strong>
        </div>
      </form>

      {/* Sign Up Link */}
      <div style={{
        marginTop: '24px',
        textAlign: 'center',
        paddingTop: '18px',
        borderTop: '1px solid var(--border-subtle)'
      }}>
        <p style={{ fontSize: '0.88rem', color: '#64748B', margin: 0 }}>
          Don't have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToSignUp}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#4F46E5',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '0.88rem',
              padding: 0
            }}
          >
            Sign Up
          </button>
        </p>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
