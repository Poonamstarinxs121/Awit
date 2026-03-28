'use client';

import { useEffect, useState } from 'react';
import { Box, ExternalLink, Wifi, WifiOff, Settings } from 'lucide-react';
import HelpBanner from '@/components/HelpBanner';
import Link from 'next/link';

interface HubStatus {
  configured: boolean;
  hubUrl: string | null;
  nodeId: string | null;
  lastHeartbeat: string | null;
}

export default function OfficePage() {
  const [hubStatus, setHubStatus] = useState<HubStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);

  useEffect(() => {
    fetch('/api/hub/status')
      .then(r => r.json())
      .then(d => { setHubStatus(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const officeUrl = hubStatus?.configured && hubStatus.hubUrl && hubStatus.nodeId
    ? `${hubStatus.hubUrl}/fleet/nodes/${hubStatus.nodeId}/office`
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, margin: '0 0 6px' }}>
          Office
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>
          3D view of this node's agents in the Hub
        </p>
      </div>

      <HelpBanner
        pageKey="office"
        title="3D Office View"
        description="The 3D Office is hosted on your Hub and shows a visual representation of this node's agents. Make sure this node is connected to your Hub to view it here."
        tips={[
          'The office renders in your Hub and is embedded here via iframe',
          'If you see a blank frame, try opening it directly in Hub',
          'Requires NODE_HUB_URL, NODE_ID, and NODE_HUB_API_KEY to be set in .env',
        ]}
      />

      {loading ? (
        <div style={{ color: 'var(--text-muted)', padding: '40px 0', textAlign: 'center' }}>
          Checking hub connection...
        </div>
      ) : !hubStatus?.configured ? (
        <div style={{
          padding: 32,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          textAlign: 'center',
        }}>
          <WifiOff size={36} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
            Hub Not Connected
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 440, margin: '0 auto 24px', lineHeight: 1.7 }}>
            The 3D Office is hosted on your SquidJob Hub. Connect this node to your Hub first by setting the following environment variables in your <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--border)', padding: '1px 5px', borderRadius: 3 }}>.env</code> file:
          </div>
          <div style={{
            background: 'var(--background)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '14px 20px',
            textAlign: 'left',
            maxWidth: 440,
            margin: '0 auto 20px',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--text-secondary)',
            lineHeight: 2,
          }}>
            <div>NODE_HUB_URL=https://your-hub.onrender.com</div>
            <div>NODE_HUB_API_KEY=sqn_xxxxxxxxxxxxxxxx</div>
            <div>NODE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx</div>
          </div>
          <Link href="/settings" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 18px',
            background: 'var(--accent)',
            color: 'white',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            textDecoration: 'none',
          }}>
            <Settings size={14} />
            View Settings
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Wifi size={14} style={{ color: 'var(--positive)' }} />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Connected to{' '}
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                  {hubStatus.hubUrl?.replace(/^https?:\/\//, '')}
                </span>
              </span>
            </div>
            {officeUrl && (
              <a
                href={officeUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  color: 'var(--accent)',
                  textDecoration: 'none',
                  fontWeight: 500,
                }}
              >
                <ExternalLink size={12} />
                Open in Hub
              </a>
            )}
          </div>

          {officeUrl && !iframeError ? (
            <div style={{
              border: '1px solid var(--border)',
              borderRadius: 12,
              overflow: 'hidden',
              background: 'var(--background)',
              height: 'calc(100vh - 260px)',
              minHeight: 500,
            }}>
              <iframe
                src={officeUrl}
                style={{ width: '100%', height: '100%', border: 'none' }}
                title="3D Office"
                onError={() => setIframeError(true)}
              />
            </div>
          ) : (
            <div style={{
              padding: 40,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              textAlign: 'center',
            }}>
              <Box size={36} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                Unable to embed Office view
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
                Open the 3D Office directly in your Hub browser.
              </div>
              {officeUrl && (
                <a
                  href={officeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '9px 18px',
                    background: 'var(--accent)',
                    color: 'white',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  <ExternalLink size={14} />
                  Open 3D Office in Hub
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
