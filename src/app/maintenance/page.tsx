'use client';
import { useEffect, useState } from 'react';

export default function MaintenancePage() {
  const [message, setMessage] = useState('We\'re upgrading our servers. Please check back shortly!');
  const [dots, setDots] = useState('');

  useEffect(() => {
    // Fetch custom maintenance message
    fetch('/api/maintenance/status')
      .then(res => res.json())
      .then(data => {
        if (data.message) setMessage(data.message);
        // If maintenance is off, redirect back to home
        if (!data.maintenance) {
          window.location.href = '/';
        }
      })
      .catch(() => {});

    // Animated dots
    const dotInterval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);

    // Auto-check every 30 seconds if maintenance is over
    const checkInterval = setInterval(() => {
      fetch('/api/maintenance/status')
        .then(res => res.json())
        .then(data => {
          if (!data.maintenance) {
            window.location.href = '/';
          }
        })
        .catch(() => {});
    }, 30000);

    return () => {
      clearInterval(dotInterval);
      clearInterval(checkInterval);
    };
  }, []);

  return (
    <html lang="en">
      <head>
        <title>Maintenance Mode | AnimeZone</title>
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <body style={{ margin: 0, padding: 0, background: '#0a0a14' }}>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
          color: '#fff',
          padding: '24px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Top-right Admin Login button */}
          <a
            href="/admin/login"
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              zIndex: 30,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: 'rgba(255, 255, 255, 0.65)',
              fontSize: '13px',
              fontWeight: 500,
              textDecoration: 'none',
              backdropFilter: 'blur(10px)',
              transition: 'all 0.2s ease',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Admin Login
          </a>

          {/* Animated background gradient orbs */}
          <div style={{
            position: 'absolute',
            top: '-20%',
            left: '-10%',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)',
            animation: 'float1 8s ease-in-out infinite',
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute',
            bottom: '-15%',
            right: '-5%',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(236,72,153,0.12) 0%, transparent 70%)',
            animation: 'float2 10s ease-in-out infinite',
            pointerEvents: 'none',
          }} />

          {/* Main content card */}
          <div style={{
            position: 'relative',
            zIndex: 10,
            textAlign: 'center',
            maxWidth: '540px',
            width: '100%',
          }}>
            {/* Animated gear/wrench icon */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(236,72,153,0.1) 100%)',
              border: '2px solid rgba(139,92,246,0.2)',
              marginBottom: '32px',
              animation: 'pulse 3s ease-in-out infinite',
            }}>
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="url(#grad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 8s linear infinite' }}>
                <defs>
                  <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{ stopColor: '#8b5cf6' }} />
                    <stop offset="100%" style={{ stopColor: '#ec4899' }} />
                  </linearGradient>
                </defs>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </div>

            {/* Title */}
            <h1 style={{
              fontSize: 'clamp(28px, 5vw, 40px)',
              fontWeight: 800,
              margin: '0 0 16px',
              background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.02em',
            }}>
              Under Maintenance
            </h1>

            {/* Subtitle */}
            <p style={{
              fontSize: '17px',
              color: 'rgba(255,255,255,0.6)',
              margin: '0 0 12px',
              lineHeight: 1.7,
            }}>
              {message}
            </p>

            {/* Loading indicator */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(139,92,246,0.1)',
              border: '1px solid rgba(139,92,246,0.2)',
              borderRadius: '100px',
              padding: '10px 24px',
              marginTop: '24px',
              fontSize: '14px',
              color: 'rgba(255,255,255,0.7)',
            }}>
              <span style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#8b5cf6',
                animation: 'blink 1.4s ease-in-out infinite',
              }} />
              Working on it{dots}
            </div>

            {/* Auto refresh note */}
            <p style={{
              fontSize: '12px',
              color: 'rgba(255,255,255,0.3)',
              marginTop: '40px',
              marginBottom: '12px',
            }}>
              This page will automatically refresh when we&apos;re back online.
            </p>

            {/* Discreet Admin Login */}
            <div>
              <a
                href="/admin/login"
                style={{
                  fontSize: '12px',
                  color: 'rgba(139,92,246,0.65)',
                  textDecoration: 'none',
                  transition: 'color 0.2s',
                }}
              >
                Admin Portal →
              </a>
            </div>
          </div>

          {/* CSS Animations */}
          <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
            
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            @keyframes pulse {
              0%, 100% { transform: scale(1); opacity: 1; }
              50% { transform: scale(1.05); opacity: 0.8; }
            }
            @keyframes blink {
              0%, 100% { opacity: 0.3; }
              50% { opacity: 1; }
            }
            @keyframes float1 {
              0%, 100% { transform: translate(0, 0); }
              50% { transform: translate(40px, 30px); }
            }
            @keyframes float2 {
              0%, 100% { transform: translate(0, 0); }
              50% { transform: translate(-30px, -40px); }
            }
          `}</style>
        </div>
      </body>
    </html>
  );
}
