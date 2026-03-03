import { Link } from 'react-router-dom';
import { useState } from 'react';

const colors = {
  purple: '#7C3AED',
  purpleDark: '#6D28D9',
  purpleDeep: '#4C1D95',
  brown: '#92400E',
  brownDark: '#78350F',
  offwhite: '#FFF8F0',
  offwhiteSoft: '#FFFBF5',
  yellow: '#F59E0B',
  yellowBright: '#EAB308',
  white: '#FFFFFF',
  textDark: '#1F1218',
  textMuted: '#6B5B6E',
  border: 'rgba(124, 58, 237, 0.15)',
};

const fonts = {
  heading: "'Sora', system-ui, sans-serif",
  body: "'Inter', system-ui, sans-serif",
  mono: "'JetBrains Mono', monospace",
};

export function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.offwhite, fontFamily: fonts.body, color: colors.textDark }}>
      <Navbar mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />
      <Hero />
      <HowItWorks />
      <MeetTheSquad />
      <MissionControlPreview />
      <Pricing />
      <ReadyToBuild />
      <Footer />
    </div>
  );
}

function Navbar({ mobileMenuOpen, setMobileMenuOpen }: { mobileMenuOpen: boolean; setMobileMenuOpen: (v: boolean) => void }) {
  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      backgroundColor: 'rgba(255, 248, 240, 0.92)', backdropFilter: 'blur(12px)',
      borderBottom: `1px solid ${colors.border}`,
    }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto', padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64,
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <span style={{ fontSize: 28 }}>🦑</span>
          <span style={{ fontFamily: fonts.heading, fontWeight: 800, fontSize: 20, color: colors.purpleDark, letterSpacing: '-0.02em' }}>
            SquidJob
          </span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }} className="landing-nav-links">
          <a href="#how-it-works" style={navLinkStyle}>How It Works</a>
          <a href="#squad" style={navLinkStyle}>Squad</a>
          <a href="#pricing" style={navLinkStyle}>Pricing</a>
          <Link to="/login" style={{ ...navLinkStyle, fontWeight: 600, color: colors.purple }}>Login</Link>
          <Link to="/register" style={{
            padding: '8px 20px', borderRadius: 8,
            backgroundColor: colors.purple, color: colors.white,
            fontWeight: 600, fontSize: 14, textDecoration: 'none',
            transition: 'background-color 150ms',
          }}>
            Get Started
          </Link>
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={{
            display: 'none', background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: colors.textDark,
          }}
          className="landing-mobile-toggle"
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      {mobileMenuOpen && (
        <div style={{
          padding: '16px 24px 24px', backgroundColor: colors.offwhite,
          borderBottom: `1px solid ${colors.border}`,
          display: 'flex', flexDirection: 'column', gap: 16,
        }} className="landing-mobile-menu">
          <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} style={navLinkStyle}>How It Works</a>
          <a href="#squad" onClick={() => setMobileMenuOpen(false)} style={navLinkStyle}>Squad</a>
          <a href="#pricing" onClick={() => setMobileMenuOpen(false)} style={navLinkStyle}>Pricing</a>
          <Link to="/login" onClick={() => setMobileMenuOpen(false)} style={{ ...navLinkStyle, fontWeight: 600, color: colors.purple }}>Login</Link>
          <Link to="/register" onClick={() => setMobileMenuOpen(false)} style={{
            padding: '10px 20px', borderRadius: 8, textAlign: 'center' as const,
            backgroundColor: colors.purple, color: colors.white,
            fontWeight: 600, fontSize: 14, textDecoration: 'none',
          }}>
            Get Started
          </Link>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .landing-nav-links { display: none !important; }
          .landing-mobile-toggle { display: block !important; }
        }
      `}</style>
    </nav>
  );
}

function Hero() {
  return (
    <section style={{
      padding: '80px 24px 100px', textAlign: 'center',
      background: `linear-gradient(180deg, ${colors.offwhite} 0%, rgba(124, 58, 237, 0.06) 100%)`,
    }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 16px', borderRadius: 20,
          backgroundColor: 'rgba(124, 58, 237, 0.08)', border: `1px solid rgba(124, 58, 237, 0.15)`,
          fontSize: 13, fontWeight: 600, color: colors.purple, marginBottom: 28,
        }}>
          🚀 Built for Builders
        </div>

        <h1 style={{
          fontFamily: fonts.heading, fontSize: 'clamp(36px, 6vw, 64px)',
          fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.03em',
          color: colors.textDark, marginBottom: 20,
        }}>
          Your AI Squad,{' '}
          <span style={{
            background: `linear-gradient(135deg, ${colors.purple}, ${colors.yellow})`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Your Mission
          </span>
        </h1>

        <p style={{
          fontSize: 'clamp(16px, 2.5vw, 20px)', lineHeight: 1.6,
          color: colors.textMuted, maxWidth: 600, margin: '0 auto 36px',
        }}>
          Build, manage, and deploy autonomous AI agent teams. Define missions, assign specialists, and let your squad ship while you sleep.
        </p>

        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/register" style={{
            padding: '14px 32px', borderRadius: 10,
            backgroundColor: colors.purple, color: colors.white,
            fontWeight: 700, fontSize: 16, textDecoration: 'none',
            boxShadow: '0 4px 14px rgba(124, 58, 237, 0.35)',
            transition: 'transform 150ms, box-shadow 150ms',
          }}>
            Get Early Access — $99/mo
          </Link>
          <a href="#how-it-works" style={{
            padding: '14px 32px', borderRadius: 10,
            backgroundColor: 'transparent', color: colors.purple,
            fontWeight: 600, fontSize: 16, textDecoration: 'none',
            border: `2px solid ${colors.purple}`,
          }}>
            See How It Works ↓
          </a>
        </div>

        <div style={{ marginTop: 40, display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap' }}>
          {['🤖 AI Agents', '🧠 Memory Graph', '⚡ Real-time Ops', '🔐 BYOK Secure'].map(badge => (
            <span key={badge} style={{
              fontSize: 13, fontWeight: 500, color: colors.textMuted,
              padding: '4px 12px', borderRadius: 6,
              backgroundColor: 'rgba(124, 58, 237, 0.05)',
            }}>
              {badge}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { num: '01', icon: '🎯', title: 'Define Your Mission', desc: 'Set your goals, timelines, and deliverables. Tell the system what success looks like.' },
    { num: '02', icon: '🦑', title: 'Build Your Squad', desc: 'Assemble a team of AI specialists — writers, researchers, developers, designers — each with unique skills.' },
    { num: '03', icon: '🚀', title: 'Chat, Delegate, Ship', desc: 'Talk to your squad in natural language. They plan, execute, and deliver autonomously while you stay in control.' },
  ];

  return (
    <section id="how-it-works" style={{ padding: '80px 24px', backgroundColor: colors.white }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <span style={{
            fontSize: 12, fontWeight: 700, textTransform: 'uppercase' as const,
            letterSpacing: '0.1em', color: colors.purple,
          }}>
            How It Works
          </span>
          <h2 style={{
            fontFamily: fonts.heading, fontSize: 'clamp(28px, 4vw, 40px)',
            fontWeight: 800, color: colors.textDark, marginTop: 12,
          }}>
            Three Steps to Mission Launch
          </h2>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 32,
        }}>
          {steps.map(step => (
            <div key={step.num} style={{
              padding: 32, borderRadius: 16,
              backgroundColor: colors.offwhiteSoft,
              border: `1px solid ${colors.border}`,
              transition: 'transform 200ms, box-shadow 200ms',
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 14,
                backgroundColor: 'rgba(124, 58, 237, 0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, marginBottom: 20,
              }}>
                {step.icon}
              </div>
              <div style={{
                fontSize: 12, fontWeight: 700, color: colors.purple,
                fontFamily: fonts.mono, marginBottom: 8,
              }}>
                STEP {step.num}
              </div>
              <h3 style={{
                fontFamily: fonts.heading, fontSize: 20, fontWeight: 700,
                color: colors.textDark, marginBottom: 10,
              }}>
                {step.title}
              </h3>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: colors.textMuted }}>
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MeetTheSquad() {
  const agents = [
    { name: 'Jarvis', role: 'Squad Lead', emoji: '🧠', color: colors.purple, desc: 'Orchestrates the team, delegates tasks, and keeps the mission on track.' },
    { name: 'Loki', role: 'Writer', emoji: '✍️', color: '#059669', desc: 'Crafts content, copy, emails, and documentation with style.' },
    { name: 'Fury', role: 'Researcher', emoji: '🔍', color: colors.brown, desc: 'Deep dives into topics, gathers data, and surfaces insights.' },
    { name: 'Vision', role: 'SEO Specialist', emoji: '📊', color: colors.yellow, desc: 'Optimizes content for search, tracks rankings, and drives organic growth.' },
    { name: 'Wanda', role: 'Designer', emoji: '🎨', color: '#EC4899', desc: 'Creates visual assets, UI mockups, and brand-consistent designs.' },
    { name: 'Friday', role: 'Developer', emoji: '💻', color: '#0EA5E9', desc: 'Writes code, builds features, debugs, and ships production-ready software.' },
    { name: 'Hawk', role: 'QA Analyst', emoji: '🧪', color: '#F97316', desc: 'Tests everything, finds edge cases, and ensures quality at every step.' },
    { name: 'Widow', role: 'Data Analyst', emoji: '📈', color: '#8B5CF6', desc: 'Crunches numbers, builds dashboards, and turns data into decisions.' },
  ];

  return (
    <section id="squad" style={{
      padding: '80px 24px',
      background: `linear-gradient(180deg, ${colors.white} 0%, rgba(124, 58, 237, 0.04) 100%)`,
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <span style={{
            fontSize: 12, fontWeight: 700, textTransform: 'uppercase' as const,
            letterSpacing: '0.1em', color: colors.purple,
          }}>
            Meet The Squad
          </span>
          <h2 style={{
            fontFamily: fonts.heading, fontSize: 'clamp(28px, 4vw, 40px)',
            fontWeight: 800, color: colors.textDark, marginTop: 12,
          }}>
            AI Specialists, Ready to Deploy
          </h2>
          <p style={{
            fontSize: 16, color: colors.textMuted, maxWidth: 540,
            margin: '12px auto 0', lineHeight: 1.6,
          }}>
            Each agent is fine-tuned for their specialty. Mix and match to build the perfect team for your mission.
          </p>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 20,
        }}>
          {agents.map(agent => (
            <div key={agent.name} style={{
              padding: 24, borderRadius: 14,
              backgroundColor: colors.white,
              border: `1px solid ${colors.border}`,
              transition: 'transform 200ms, box-shadow 200ms',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  backgroundColor: `${agent.color}15`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22,
                }}>
                  {agent.emoji}
                </div>
                <div>
                  <div style={{ fontFamily: fonts.heading, fontWeight: 700, fontSize: 15, color: colors.textDark }}>
                    {agent.name}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: agent.color }}>
                    {agent.role}
                  </div>
                </div>
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.5, color: colors.textMuted }}>
                {agent.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MissionControlPreview() {
  return (
    <section style={{ padding: '80px 24px', backgroundColor: colors.purpleDeep }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
        <span style={{
          fontSize: 12, fontWeight: 700, textTransform: 'uppercase' as const,
          letterSpacing: '0.1em', color: 'rgba(255,255,255,0.6)',
        }}>
          Mission Control
        </span>
        <h2 style={{
          fontFamily: fonts.heading, fontSize: 'clamp(28px, 4vw, 40px)',
          fontWeight: 800, color: colors.white, marginTop: 12, marginBottom: 16,
        }}>
          Your Command Center
        </h2>
        <p style={{
          fontSize: 16, color: 'rgba(255,255,255,0.65)',
          maxWidth: 540, margin: '0 auto 48px', lineHeight: 1.6,
        }}>
          A real-time dashboard to monitor agents, track missions, manage standups, and review deliverables — all in one place.
        </p>

        <div style={{
          backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.1)',
          padding: 24, maxWidth: 900, margin: '0 auto',
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 16,
          }}>
            {[
              { label: 'Active Agents', value: '12', icon: '🤖' },
              { label: 'Tasks Completed', value: '1,847', icon: '✅' },
              { label: 'Uptime', value: '99.9%', icon: '⚡' },
              { label: 'Missions Active', value: '8', icon: '🎯' },
            ].map(stat => (
              <div key={stat.label} style={{
                padding: 20, borderRadius: 12,
                backgroundColor: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>{stat.icon}</div>
                <div style={{
                  fontFamily: fonts.heading, fontSize: 28, fontWeight: 800,
                  color: colors.white, marginBottom: 4,
                }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{stat.label}</div>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 20, padding: 16, borderRadius: 10,
            backgroundColor: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
            textAlign: 'left',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: 12, fontFamily: fonts.mono }}>
              RECENT ACTIVITY
            </div>
            {[
              { agent: 'Jarvis', action: 'Delegated SEO audit to Vision', time: '2m ago', emoji: '🧠' },
              { agent: 'Friday', action: 'Deployed landing page v2.1', time: '8m ago', emoji: '💻' },
              { agent: 'Loki', action: 'Published blog post draft', time: '15m ago', emoji: '✍️' },
            ].map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 0',
                borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              }}>
                <span style={{ fontSize: 18 }}>{item.emoji}</span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{item.agent}</span>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginLeft: 8 }}>{item.action}</span>
                </div>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: fonts.mono }}>{item.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const features = [
    'Unlimited AI agents',
    'Squad Chat & delegation',
    'Memory Graph',
    'Kanban boards & tasks',
    'Daily standups & reports',
    'Real-time activity feed',
    'Cron job scheduling',
    'Document management',
    'Analytics dashboard',
    'Priority support',
  ];

  return (
    <section id="pricing" style={{ padding: '80px 24px', backgroundColor: colors.white }}>
      <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
        <span style={{
          fontSize: 12, fontWeight: 700, textTransform: 'uppercase' as const,
          letterSpacing: '0.1em', color: colors.purple,
        }}>
          Pricing
        </span>
        <h2 style={{
          fontFamily: fonts.heading, fontSize: 'clamp(28px, 4vw, 40px)',
          fontWeight: 800, color: colors.textDark, marginTop: 12, marginBottom: 16,
        }}>
          One Plan, Full Power
        </h2>
        <p style={{
          fontSize: 16, color: colors.textMuted, lineHeight: 1.6, marginBottom: 40,
        }}>
          No tiers, no limits. Get everything from day one.
        </p>

        <div style={{
          padding: 40, borderRadius: 20,
          backgroundColor: colors.offwhiteSoft,
          border: `2px solid ${colors.purple}`,
          boxShadow: `0 8px 32px rgba(124, 58, 237, 0.12)`,
          textAlign: 'left',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{
              display: 'inline-block', padding: '4px 14px', borderRadius: 20,
              backgroundColor: 'rgba(124, 58, 237, 0.1)',
              fontSize: 12, fontWeight: 700, color: colors.purple,
              marginBottom: 16,
            }}>
              EARLY ACCESS
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4 }}>
              <span style={{ fontFamily: fonts.heading, fontSize: 56, fontWeight: 800, color: colors.textDark }}>$99</span>
              <span style={{ fontSize: 18, color: colors.textMuted, fontWeight: 500 }}>/month</span>
            </div>
          </div>

          <div style={{
            padding: '16px 20px', borderRadius: 12,
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.2)',
            marginBottom: 28,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 16 }}>🔑</span>
              <span style={{ fontWeight: 700, fontSize: 14, color: colors.brown }}>BYOK — Bring Your Own Keys</span>
            </div>
            <p style={{ fontSize: 13, color: colors.textMuted, lineHeight: 1.5 }}>
              Connect your own Claude, OpenAI, or other LLM API keys. You control costs and model selection.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
            {features.map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  width: 20, height: 20, borderRadius: '50%',
                  backgroundColor: 'rgba(50, 215, 75, 0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, color: '#32D74B', flexShrink: 0,
                }}>
                  ✓
                </span>
                <span style={{ fontSize: 14, color: colors.textDark }}>{f}</span>
              </div>
            ))}
          </div>

          <Link to="/register" style={{
            display: 'block', textAlign: 'center',
            padding: '14px 32px', borderRadius: 10,
            backgroundColor: colors.purple, color: colors.white,
            fontWeight: 700, fontSize: 16, textDecoration: 'none',
            boxShadow: '0 4px 14px rgba(124, 58, 237, 0.35)',
          }}>
            Get Early Access
          </Link>
        </div>
      </div>
    </section>
  );
}

function ReadyToBuild() {
  return (
    <section style={{
      padding: '80px 24px',
      background: `linear-gradient(135deg, ${colors.purpleDeep} 0%, ${colors.purpleDark} 50%, ${colors.brownDark} 100%)`,
      textAlign: 'center',
    }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <h2 style={{
          fontFamily: fonts.heading, fontSize: 'clamp(28px, 4vw, 40px)',
          fontWeight: 800, color: colors.white, marginBottom: 16,
        }}>
          Ready to Build Your Squad?
        </h2>
        <p style={{
          fontSize: 16, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, marginBottom: 36,
        }}>
          Join the builders who are shipping faster with AI agent teams. Set up your mission control in minutes.
        </p>
        <Link to="/register" style={{
          display: 'inline-block',
          padding: '16px 40px', borderRadius: 12,
          backgroundColor: colors.yellow, color: colors.textDark,
          fontWeight: 700, fontSize: 17, textDecoration: 'none',
          boxShadow: '0 4px 20px rgba(245, 158, 11, 0.3)',
        }}>
          🦑 Start Your Mission
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{
      padding: '40px 24px', backgroundColor: colors.offwhite,
      borderTop: `1px solid ${colors.border}`,
    }}>
      <div style={{
        maxWidth: 1100, margin: '0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>🦑</span>
          <span style={{ fontFamily: fonts.heading, fontWeight: 700, fontSize: 15, color: colors.purpleDark }}>
            SquidJob
          </span>
        </div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <a href="#how-it-works" style={footerLinkStyle}>How It Works</a>
          <a href="#squad" style={footerLinkStyle}>Squad</a>
          <a href="#pricing" style={footerLinkStyle}>Pricing</a>
          <Link to="/login" style={footerLinkStyle}>Login</Link>
          <Link to="/register" style={footerLinkStyle}>Sign Up</Link>
        </div>
        <p style={{ fontSize: 12, color: colors.textMuted, width: '100%', textAlign: 'center', marginTop: 8 }}>
          © {new Date().getFullYear()} SquidJob. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

const navLinkStyle: React.CSSProperties = {
  fontSize: 14, fontWeight: 500, color: '#6B5B6E',
  textDecoration: 'none', transition: 'color 150ms',
};

const footerLinkStyle: React.CSSProperties = {
  fontSize: 13, color: '#6B5B6E', textDecoration: 'none',
};
