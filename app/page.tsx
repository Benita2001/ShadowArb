'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const API = '/api';

interface Stats {
  marketsScanned: number;
  usdcSettled: string;
}

const BrandMark = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} viewBox="0 0 32 40" aria-hidden="true">
    <path d="M24 6c-3-2-7-3-11-1-4 2-5 5-3 8 2 3 7 4 10 6 4 2 5 5 3 9-3 4-9 5-13 4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    <path d="M22 4c-1 2-3 3-5 3M10 36c1-2 3-3 5-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.7"/>
    <circle cx="6" cy="34" r="1.1" fill="currentColor" opacity="0.85"/>
  </svg>
);

const FAQ_ITEMS = [
  {
    q: "Doesn't ArcaneVM make this redundant?",
    a: "No. ArcaneVM hides amounts. ERC-5564 hides identity. Commit-reveal proves timing. Three different problems. Three different solutions. When ArcaneVM launches, ShadowArb uses all three simultaneously.",
  },
  {
    q: "How is this different from a mixer?",
    a: "Mixers break compliance. ShadowArb is the opposite — every trade generates an on-chain proof that your strategy was decided before execution. Private AND auditable.",
  },
  {
    q: "Can I use ShadowArb for markets other than prediction markets?",
    a: "Yes. The privacy layer is market-agnostic. Install the SDK, implement the MarketAdapter interface, and your trades are private regardless of venue.",
  },
  {
    q: "How do I get privacy for just one transaction?",
    a: "Call POST /api/privacy and pay 0.001 USDC. You get a fresh ERC-5564 stealth address plus a commit hash posted to Arc.",
  },
];

export default function LandingPage() {
  const navRef = useRef<HTMLElement>(null);
  const [stats, setStats] = useState<Stats>({ marketsScanned: 0, usdcSettled: '$0.00' });
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    const onScroll = () => {
      navRef.current?.classList.toggle('scrolled', window.scrollY > 12);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const refresh = async () => {
      try {
        const res = await fetch(`${API}/stats`);
        if (res.ok) setStats(await res.json());
      } catch {}
    };
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, []);

  void stats;

  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <symbol id="brand-mark" viewBox="0 0 32 40">
            <path d="M24 6c-3-2-7-3-11-1-4 2-5 5-3 8 2 3 7 4 10 6 4 2 5 5 3 9-3 4-9 5-13 4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
            <path d="M22 4c-1 2-3 3-5 3M10 36c1-2 3-3 5-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.7"/>
            <circle cx="6" cy="34" r="1.1" fill="currentColor" opacity="0.85"/>
          </symbol>
        </defs>
      </svg>

      {/* ── Floating Pill Nav ── */}
      <div className="fnav-bar">
        <nav className="fnav">
          <div className="fnav-links">
            <a href="#privacy" className="fnav-link">Privacy</a>
            <a href="#sdk" className="fnav-link">SDK</a>
            <a href="#x402" className="fnav-link">x402</a>
            <a href="#how" className="fnav-link">How it works</a>
            <a href="https://github.com/Benita2001/ShadowArb" className="fnav-link" target="_blank" rel="noopener noreferrer">GitHub</a>
          </div>
          <Link href="/terminal" className="fnav-cta">Get started</Link>
        </nav>
      </div>

      {/* ── Brand Nav ── */}
      <nav className="nav" ref={navRef}>
        <div className="nav-inner">
          <Link className="brand" href="/">
            <BrandMark className="brand-mark" style={{ color: 'var(--accent)' }} />
            <span className="brand-stack">
              <span className="name">SHADOWARB</span>
              <span className="sub">TRADE IN THE DARK</span>
            </span>
          </Link>
          <Link className="btn btn-ghost" href="/terminal">View Live Agent <span className="arrow" /></Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <header className="hero">
        <div className="wrap hero-inner">
          <div className="hero-left">
            <h1>Find your edge<br />in the Dark.</h1>
            <p className="hero-body">The privacy layer for autonomous trading agents with three cryptographic layers — stealth addresses, commit-reveal, ArcaneVM — so your trades stay dark until after it wins.</p>
            <div className="hero-divider" />
            <div className="hero-wordmark">
              <BrandMark className="mark" />
              <span className="stack">
                <span className="name">SHADOWARB</span>
                <span className="sub">TRADE IN THE DARK</span>
              </span>
            </div>
            <div className="hero-cta-row">
              <Link className="btn btn-primary" href="/terminal">View Live Agent <span className="arrow" /></Link>
              <a className="btn btn-ghost" href="https://github.com/Benita2001/ShadowArb" target="_blank" rel="noopener noreferrer">Get SDK <span className="arrow" /></a>
            </div>
          </div>

          <div className="mascot-pane">
            <div className="halo" />
            <img className="mascot-img" src="/assets/mascot-hero.png" alt="ShadowArb ghost-flame mascot with electric green eyes" />
          </div>
        </div>
      </header>

      {/* ── Stats Strip ── */}
      <section id="privacy" className="stats-strip">
        <div className="cell">
          <div className="v">ERC<span className="unit">-5564</span></div>
          <div className="l">Stealth Per Trade</div>
        </div>
        <div className="cell">
          <div className="v">Commit<span className="unit">-</span>Reveal</div>
          <div className="l">On Arc Before Execution</div>
        </div>
        <div className="cell">
          <div className="v">ArcaneVM</div>
          <div className="l">Ready When Arc Ships</div>
        </div>
        <div className="cell">
          <div className="v">x<span className="unit">402</span></div>
          <div className="l">Pay Per Privacy</div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how" className="how">
        <div className="wrap">
          <div className="how-head">
            <div className="eyebrow" style={{ marginBottom: 18 }}>How it works</div>
            <h2>Six steps from signal<br />to <span className="accent">verified privacy.</span></h2>
            <p className="lede">A continuous loop. Scan, detect, cloak, commit, execute, settle. Every trade hides behind a fresh stealth address, every strategy sealed on-chain before it runs. Three privacy layers, zero compromise.</p>
          </div>

          <div className="flow">
            <article className="step">
              <span className="stepnum">01</span>
              <svg className="icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4">
                <circle cx="16" cy="16" r="11"/><circle cx="16" cy="16" r="6"/>
                <circle cx="16" cy="16" r="1.6" fill="currentColor" stroke="none"/>
                <path d="M16 5v3M16 24v3M5 16h3M24 16h3" strokeLinecap="round"/>
                <path d="M16 16l9-4" strokeDasharray="2 2"/>
              </svg>
              <div className="step-tag">STEP 01</div>
              <h3>Scan</h3>
              <p>Scan markets for trading opportunities across Polymarket and Kalshi continuously.</p>
            </article>

            <article className="step">
              <span className="stepnum">02</span>
              <svg className="icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4">
                <circle cx="16" cy="16" r="10"/>
                <path d="M16 4v6M16 22v6M4 16h6M22 16h6" strokeLinecap="round"/>
                <circle cx="16" cy="16" r="2.4"/>
              </svg>
              <div className="step-tag">STEP 02</div>
              <h3>Detect</h3>
              <p>AI identifies genuine price gaps on the same event across platforms. False positives discarded.</p>
            </article>

            <article className="step commit">
              <span className="stepnum" style={{ color: 'rgba(91,255,176,0.08)' }}>03</span>
              <svg className="icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
                <ellipse cx="16" cy="16" rx="11" ry="7"/>
                <circle cx="16" cy="16" r="3"/>
                <path d="M5 16c3-5 7-8 11-8s8 3 11 8" strokeLinecap="round"/>
              </svg>
              <div className="step-tag">STEP 03 · CORE INNOVATION</div>
              <h3>Stealth</h3>
              <p>Fresh <span className="mono" style={{ color: 'var(--accent-2)' }}>ERC-5564</span> stealth address generated for every trade. On-chain, each trade appears unlinked from any other. No persistent identity.</p>
              <div className="hash-strip">0xf3a9…e812<span style={{ color: 'var(--muted)' }}> · single use</span></div>
              <div className="cap">Discarded after settlement. Untraceable by design.</div>
            </article>

            <article className="step">
              <span className="stepnum">04</span>
              <svg className="icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4">
                <rect x="6" y="14" width="20" height="14" rx="1"/>
                <path d="M10 14v-4a6 6 0 0112 0v4"/>
                <circle cx="16" cy="21" r="1.6" fill="currentColor" stroke="none"/>
                <path d="M16 22v3" strokeLinecap="round"/>
              </svg>
              <div className="step-tag">STEP 04</div>
              <h3>Commit</h3>
              <p>Trade intent sealed as a <span className="mono" style={{ color: 'var(--text-2)' }}>keccak256</span> hash on Arc <i>before</i> execution. Strategy stays dark until revealed.</p>
            </article>

            <article className="step">
              <span className="stepnum">05</span>
              <svg className="icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4">
                <path d="M18 3L7 18h7l-3 11 11-15h-7z" strokeLinejoin="round"/>
              </svg>
              <div className="step-tag">STEP 05</div>
              <h3>Execute + Reveal</h3>
              <p>Trade executes from the stealth wallet. After settlement, full details are published on-chain. Commit hash verified.</p>
              <div className="cap" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: 'var(--accent)', marginTop: 14, letterSpacing: '0.06em' }}>COMMIT&nbsp;=&nbsp;REVEAL&nbsp;&nbsp;✓</div>
            </article>

            <article className="step">
              <span className="stepnum">06</span>
              <svg className="icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4">
                <circle cx="16" cy="16" r="11"/>
                <path d="M10 16.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <div className="step-tag">STEP 06</div>
              <h3>Settle</h3>
              <p>USDC settles via ERC-8183 job contract. ERC-8004 reputation updated. ArcaneVM activates when Arc confidential transfers launch.</p>
            </article>
          </div>
        </div>
      </section>

      {/* ── SDK Section ── */}
      <section id="sdk" className="sdk-section">
        <div className="wrap">
          <div className="sdk-inner">
            <div className="sdk-left">
              <div className="eyebrow" style={{ marginBottom: 16 }}>Get the SDK</div>
              <h2 className="sdk-title">Privacy for any<br />trading agent.</h2>
              <p className="sdk-sub">Install once. Every trade is private by design.</p>
              <ul className="sdk-features">
                <li><span className="sdk-check">✓</span> ERC-5564 stealth address per trade</li>
                <li><span className="sdk-check">✓</span> Commit-reveal on Arc, out of the box</li>
                <li><span className="sdk-check">✓</span> ArcaneVM confidential execution, when live</li>
                <li><span className="sdk-check">✓</span> x402 pay-per-signal API included</li>
              </ul>
            </div>
            <div className="sdk-right">
              <div className="sdk-terminal">
                <div className="sdk-term-bar">
                  <span className="sdk-dot" /><span className="sdk-dot" /><span className="sdk-dot" />
                  <span className="sdk-term-label">TERMINAL</span>
                </div>
                <div className="sdk-term-body">
                  <div className="sdk-line">
                    <span className="sdk-prompt">$</span>
                    <span className="sdk-cmd">npm install @shadowarb/sdk</span>
                  </div>
                  <div className="sdk-line sdk-output">
                    <span style={{ color: 'var(--accent)' }}>+</span> @shadowarb/sdk@1.0.0
                  </div>
                  <div className="sdk-line sdk-output" style={{ color: 'var(--muted)', marginTop: 20 }}>
                    <span style={{ color: 'var(--accent)', marginRight: 8 }}>//</span>then in your agent:
                  </div>
                  <div className="sdk-line sdk-output">
                    <span style={{ color: 'var(--accent-2)' }}>import</span>
                    <span style={{ color: 'var(--text)' }}> {'{ ShadowAgent }'} </span>
                    <span style={{ color: 'var(--accent-2)' }}>from</span>
                    <span style={{ color: 'var(--yellow)' }}> &apos;@shadowarb/sdk&apos;</span>
                  </div>
                  <div className="sdk-line sdk-output" style={{ marginTop: 6 }}>
                    <span style={{ color: 'var(--muted-2)' }}>const</span>
                    <span style={{ color: 'var(--text)' }}> agent </span>
                    <span style={{ color: 'var(--muted-2)' }}>=</span>
                    <span style={{ color: 'var(--accent-2)' }}> new</span>
                    <span style={{ color: 'var(--text)' }}> ShadowAgent(config)</span>
                  </div>
                  <div className="sdk-line sdk-output" style={{ marginTop: 6 }}>
                    <span style={{ color: 'var(--text)' }}>agent</span>
                    <span style={{ color: 'var(--muted-2)' }}>.</span>
                    <span style={{ color: 'var(--accent)' }}>start</span>
                    <span style={{ color: 'var(--text)' }}>()</span>
                    <span style={{ color: 'var(--muted)', marginLeft: 16 }}>// 3 privacy layers, zero config</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── x402 Section ── */}
      <section id="x402" className="x402-section">
        <div className="wrap">
          <div className="x402-head">
            <div className="eyebrow" style={{ marginBottom: 18 }}>x402 Protocol</div>
            <h2>Pay per privacy.</h2>
            <p className="x402-sub">No SDK needed. Pay 0.001 USDC to access our privacy layer for a single transaction — fresh ERC-5564 stealth address plus commit hash on Arc.</p>
          </div>
          <div className="x402-blocks">
            <div className="x402-block">
              <div className="x402-block-label">Request</div>
              <pre className="x402-code"><span className="x402-method">POST</span>{' /api/privacy\n'}<span className="x402-key">x-payment:</span>{' 0.001 USDC'}</pre>
            </div>
            <div className="x402-arr">→</div>
            <div className="x402-block">
              <div className="x402-block-label">Response</div>
              <pre className="x402-code">{`{
  "stealthAddress": "0x4039...b997",
  "ephemeralPubKey": "0336...4750",
  "commitHash": "0x4e65...743f"
}`}</pre>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ Section ── */}
      <section className="faq-section">
        <div className="wrap">
          <div className="faq-head">
            <h2 className="faq-title">FAQ</h2>
            <p className="faq-subtitle">Questions about how it works.</p>
          </div>
          <div className="faq-list">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className={`faq-item${openFaq === i ? ' open' : ''}`}>
                <button className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <span>{item.q}</span>
                  <span className="faq-icon">{openFaq === i ? '−' : '+'}</span>
                </button>
                {openFaq === i && (
                  <div className="faq-a">
                    <p>{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="enter">
        <div className="wrap">
          <h2>Ready to <span className="accent">trade in the dark?</span></h2>
          <Link className="btn btn-primary btn-xl" href="/terminal">VIEW LIVE AGENT <span className="arrow" /></Link>
          <div style={{ marginTop: 28 }}>
            <a href="https://github.com/Benita2001/ShadowArb" className="enter-sdk-link" target="_blank" rel="noopener noreferrer">Get the SDK →</a>
          </div>
        </div>
      </section>

      <footer className="foot">
        <div className="wrap foot-inner">
          <div>ShadowArb · Trade in the Dark</div>
          <div>Built for Agora x Arc x Circle Hackathon 2026 · @0xbeni</div>
        </div>
      </footer>
    </>
  );
}
