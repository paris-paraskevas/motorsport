'use client';
import { useEffect } from 'react';

// Root global error boundary. Next App Router invokes this ONLY when the root
// layout (or template) itself throws, so it replaces the root layout entirely
// and MUST render its own <html> and <body>. App CSS, fonts and component
// libraries may not be available here, so everything is styled inline with the
// Paddock token hex values (globals.css: --bg #07070a, --surface #14141a,
// --text #f5f5f7, --text-muted #a1a1aa, --text-faint #84848e, --border #2a2a35).
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[paddock] global error', error);
  }, [error]);

  return (
    <html lang="en" className="dark" style={{ colorScheme: 'dark' }}>
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          backgroundColor: '#07070a',
          color: '#f5f5f7',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            width: '100%',
            maxWidth: '640px',
            boxSizing: 'border-box',
            border: '1px solid #2a2a35',
            borderRadius: '24px',
            backgroundColor: '#14141a',
            padding: '40px',
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0.18,
              pointerEvents: 'none',
              background:
                'radial-gradient(circle at 0% 0%, #ef4444 0%, transparent 45%), radial-gradient(circle at 100% 100%, #f59e0b 0%, transparent 45%)',
            }}
          />
          <div style={{ position: 'relative' }}>
            <div
              style={{
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.18em',
                color: '#84848e',
                fontWeight: 600,
                marginBottom: '12px',
              }}
            >
              Red flag
            </div>
            <div
              style={{
                fontSize: '40px',
                lineHeight: 1.1,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                marginBottom: '16px',
              }}
            >
              Something broke
            </div>
            <p
              style={{
                color: '#a1a1aa',
                fontSize: '16px',
                lineHeight: 1.6,
                maxWidth: '28rem',
                margin: 0,
              }}
            >
              Paddock hit an unexpected error. We&apos;ve logged it. Try again,
              or head back to the grid.
            </p>

            {error.digest && (
              <p
                style={{
                  marginTop: '16px',
                  color: '#84848e',
                  fontSize: '12px',
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                }}
              >
                Reference: {error.digest}
              </p>
            )}

            <div
              style={{
                marginTop: '32px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <button
                type="button"
                onClick={() => reset()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#07070a',
                  backgroundColor: '#f5f5f7',
                  border: 'none',
                  borderRadius: '9999px',
                  padding: '8px 16px',
                  cursor: 'pointer',
                }}
              >
                Try again
              </button>
              <a
                href="/"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#f5f5f7',
                  backgroundColor: '#14141a',
                  border: '1px solid #2a2a35',
                  borderRadius: '9999px',
                  padding: '8px 16px',
                  textDecoration: 'none',
                }}
              >
                Home
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
