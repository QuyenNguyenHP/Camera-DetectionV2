import React, {FormEvent, useState} from 'react';

export type LoginTemplateSubmitPayload = {
  username: string;
  password: string;
};

export type LoginTemplateProps = {
  logoSrc?: string;
  logoAlt?: string;
  badgeText?: string;
  title?: string;
  subtitle?: string;
  usernameLabel?: string;
  passwordLabel?: string;
  submitText?: string;
  defaultUsername?: string;
  loginEndpoint?: string;
  redirectTo?: string;
  autoFocusPassword?: boolean;
  fullPage?: boolean;
  minHeight?: string | number;
  onSubmit?: (payload: LoginTemplateSubmitPayload) => Promise<void> | void;
  loginErrorFallback?: string;
  footerContent?: React.ReactNode;
};

const shellStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  margin: 0,
  padding: 24,
  color: '#edf4ff',
  fontFamily: '"DM Sans", system-ui, sans-serif',
  background:
    'radial-gradient(circle at 50% 0, rgba(41, 82, 154, 0.72) 0, transparent 40%), #060b15',
};

const cardStyle: React.CSSProperties = {
  width: 'min(100%, 420px)',
  padding: '42px 38px 36px',
  border: '1px solid rgba(76, 104, 148, 0.42)',
  borderRadius: 24,
  background: 'rgba(13, 20, 35, 0.96)',
  boxShadow: '0 28px 80px rgba(0, 0, 0, 0.42)',
};

const logoStyle: React.CSSProperties = {
  display: 'block',
  width: 84,
  height: 84,
  objectFit: 'contain',
  margin: '0 auto 14px',
};

const badgeStyle: React.CSSProperties = {
  display: 'block',
  textAlign: 'center',
  color: '#2376e4',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.28em',
};

const titleStyle: React.CSSProperties = {
  margin: '20px 0 10px',
  textAlign: 'center',
  fontFamily: 'Manrope, "DM Sans", sans-serif',
  fontSize: 32,
  fontWeight: 700,
  lineHeight: 1.12,
  letterSpacing: '-0.03em',
};

const subtitleStyle: React.CSSProperties = {
  margin: '0 0 30px',
  textAlign: 'center',
  color: '#95a7ca',
  fontSize: 15,
  lineHeight: 1.55,
};

const formStyle: React.CSSProperties = {
  display: 'grid',
  gap: 18,
};

const fieldStyle: React.CSSProperties = {
  display: 'grid',
  gap: 10,
  color: '#d8e4fb',
  fontSize: 13,
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 46,
  border: '1px solid #31476f',
  borderRadius: 13,
  background: '#0a101b',
  padding: '12px 14px',
  color: '#f5f8ff',
  font: 'inherit',
  outline: 'none',
  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.02)',
};

const errorStyle: React.CSSProperties = {
  minHeight: 18,
  color: '#ff8994',
  fontSize: 13,
  textAlign: 'center',
};

const buttonStyle: React.CSSProperties = {
  border: 0,
  borderRadius: 13,
  background: '#2f75dd',
  color: '#07101c',
  padding: '14px 16px',
  fontWeight: 800,
  fontSize: 15,
  cursor: 'pointer',
  marginTop: 14,
};

export const LoginTemplate: React.FC<LoginTemplateProps> = ({
  logoSrc,
  logoAlt = 'Brand logo',
  badgeText = 'VIDEO CREATOR',
  title = 'Welcome back',
  subtitle = 'Sign in to continue to your workspace.',
  usernameLabel = 'Username',
  passwordLabel = 'Password',
  submitText = 'Sign in',
  defaultUsername = 'admin',
  loginEndpoint = '/api/login',
  redirectTo = '/',
  autoFocusPassword = true,
  fullPage = true,
  minHeight = '100vh',
  onSubmit,
  loginErrorFallback = 'Sign in failed. Please try again.',
  footerContent,
}) => {
  const [username, setUsername] = useState(defaultUsername);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const payload = {username, password};

      if (onSubmit) {
        await onSubmit(payload);
      } else {
        const response = await fetch(loginEndpoint, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(payload),
        });

        const result = (await response.json().catch(() => ({}))) as {error?: string};
        if (!response.ok) {
          throw new Error(result.error || loginErrorFallback);
        }

        if (typeof window !== 'undefined') {
          window.location.href = redirectTo;
        }
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : loginErrorFallback);
    } finally {
      setSubmitting(false);
    }
  };

  const containerStyle: React.CSSProperties = fullPage
    ? {...shellStyle, minHeight}
    : {
        ...shellStyle,
        minHeight,
        padding: 0,
        background: 'transparent',
      };

  return (
    <div style={containerStyle}>
      <section style={cardStyle}>
        {logoSrc ? <img src={logoSrc} alt={logoAlt} style={logoStyle} /> : null}
        <span style={badgeStyle}>{badgeText}</span>
        <h1 style={titleStyle}>{title}</h1>
        <p style={subtitleStyle}>{subtitle}</p>

        <form style={formStyle} onSubmit={handleSubmit}>
          <label style={fieldStyle}>
            <span>{usernameLabel}</span>
            <input
              autoComplete="username"
              autoFocus={!autoFocusPassword}
              name="username"
              required
              style={inputStyle}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>

          <label style={fieldStyle}>
            <span>{passwordLabel}</span>
            <input
              autoComplete="current-password"
              autoFocus={autoFocusPassword}
              name="password"
              required
              style={inputStyle}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          <div aria-live="polite" role="alert" style={errorStyle}>
            {error}
          </div>

          <button
            disabled={submitting}
            style={{
              ...buttonStyle,
              opacity: submitting ? 0.55 : 1,
              cursor: submitting ? 'wait' : 'pointer',
            }}
            type="submit"
          >
            {submitText}
          </button>

          {footerContent}
        </form>
      </section>
    </div>
  );
};
