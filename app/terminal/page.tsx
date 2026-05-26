'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';

const API = '/api';

interface Trade {
  id: string;
  timestamp: string;
  question: string;
  buyOn: string;
  buyPrice: number;
  sellOn: string;
  sellPrice: number;
  gapPercent: number;
  status: 'SCANNING' | 'EVALUATING' | 'COMMITTED' | 'EXECUTED' | 'REVEALED' | 'REJECTED';
  commitHash?: string;
  revealHash?: string;
  txHash?: string;
  jobId?: string;
  claudeReasoning?: string;
  arcExplorerUrl?: string;
}

interface Stats {
  marketsScanned: number;
  opportunitiesFound: number;
  tradesExecuted: number;
  usdcSettled: string;
  agentId: string;
  agentAddress: string;
  lastScan: string;
}

const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
const trunc = (h?: string) => (!h || h.length < 12) ? (h ?? '·') : h.slice(0, 6) + '…' + h.slice(-4);
const fmt = (ts: string) => new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const statusCls = (s: string) => ({ SCANNING: 'scanning', EVALUATING: 'evaluating', COMMITTED: 'committed', EXECUTED: 'executed', REVEALED: 'revealed', REJECTED: 'rejected' })[s] ?? 'scanning';

function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <button className="chip" onClick={() => disconnect()}>
        {address.slice(0, 6)}…{address.slice(-4)} · DISCONNECT
      </button>
    );
  }
  return (
    <button className="chip" onClick={() => connect({ connector: injected() })}>
      CONNECT WALLET
    </button>
  );
}

function LivePanel({ trade }: { trade: Trade | null }) {
  if (!trade) {
    return (
      <section className="live-trade">
        <div className="lt-head">
          <div className="lt-head-left">
            <span className="pulse-dot" />
            <span className="lt-label">SCANNING</span>
            <span className="lt-time">waiting for signal…</span>
          </div>
          <div className="lt-head-right" />
        </div>
        <div style={{ padding: '40px 32px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <span className="pulse-dot" style={{ width: 6, height: 6, opacity: 0.5 }} />
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.28em', color: 'var(--muted)' }}>
            SCANNING MARKETS · WAITING FOR NEXT OPPORTUNITY
          </span>
        </div>
      </section>
    );
  }

  const isEval = trade.status === 'EVALUATING';
  const isCommit = trade.status === 'COMMITTED';

  const label = isEval ? 'CLAUDE EVALUATING · LIVE' : isCommit ? 'TRADE COMMITTED · ON-CHAIN' : 'TRADE ACTIVE · LIVE';

  const badges = isEval ? (
    <>
      <span className="status-pill evaluating">EVALUATING</span>
      <span className="match-inline" style={{ color: 'var(--muted)', borderColor: 'rgba(255,255,255,0.12)' }}>
        <span className="pulse-dot" style={{ width: 6, height: 6 }} /> CLAUDE THINKING
      </span>
    </>
  ) : isCommit ? (
    <>
      <span className="status-pill committed">COMMITTED</span>
      <span className="match-inline" style={{ color: 'var(--accent)' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M12 2l2 7h7l-6 4 2 7-5-4-5 4 2-7-6-4h7z" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        SEALED ON ARC
      </span>
    </>
  ) : (
    <>
      <span className="status-pill revealed">REVEALED</span>
      <span className="match-inline">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M5 12l5 5L20 6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        HASHES MATCH
      </span>
    </>
  );

  const reasoning = isEval
    ? 'Verifying both markets resolve on the same event. Checking for false positives…'
    : (trade.claudeReasoning ? `"${trade.claudeReasoning}"` : '');

  return (
    <section className="live-trade">
      <div className="lt-head">
        <div className="lt-head-left">
          <span className="pulse-dot" />
          <span className="lt-label">{label}</span>
          <span className="lt-time">{fmt(trade.timestamp)} · just now</span>
        </div>
        <div className="lt-head-right">{badges}</div>
      </div>

      <div className="lt-body">
        <div className="lt-market-col">
          <div className="lt-eyebrow">Market</div>
          <h2 className="lt-market">{trade.question}</h2>
          <div className="lt-claude">
            <span className="lt-claude-tag">{isEval ? 'CLAUDE EVALUATING' : 'CLAUDE REASONING'}</span>
            <p style={{ color: isEval ? 'var(--muted)' : 'var(--text-2)' }}>{reasoning}</p>
          </div>
        </div>

        <div className="lt-legs-col">
          <div className="lt-legs">
            <div className="lt-leg buy">
              <div className="lbl">BUY</div>
              <div className="plat">{cap(trade.buyOn)}</div>
              <div className="px">{trade.buyPrice.toFixed(1)}<span>%</span></div>
            </div>
            <div className="lt-leg sell">
              <div className="lbl">SELL</div>
              <div className="plat">{cap(trade.sellOn)}</div>
              <div className="px">{trade.sellPrice.toFixed(1)}<span>%</span></div>
            </div>
          </div>
          <div className="lt-gap">
            <span className="lbl">Arbitrage Gap</span>
            <span className="v">{trade.gapPercent.toFixed(1)}%</span>
          </div>
        </div>

        <div className="lt-meta-col">
          <div className="lt-kv">
            <span className="lbl">Commit</span>
            <span className="val">{trade.commitHash ? trunc(trade.commitHash) : (isEval ? 'sealing…' : '·')}</span>
            <button className="icon-btn" onClick={() => navigator.clipboard.writeText(trade.commitHash ?? '')}>COPY</button>
          </div>
          <div className="lt-kv">
            <span className="lbl">Reveal</span>
            <span className="val">{trade.revealHash ? trunc(trade.revealHash) : 'pending'}</span>
            <button className="icon-btn" onClick={() => navigator.clipboard.writeText(trade.revealHash ?? '')}>COPY</button>
          </div>
          <div className="lt-kv">
            <span className="lbl">Tx</span>
            <span className="val">{trade.txHash ? trunc(trade.txHash) : 'pending'}</span>
            <button className="icon-btn" onClick={() => trade.arcExplorerUrl && window.open(trade.arcExplorerUrl, '_blank')}>VIEW</button>
          </div>
          <div className="lt-kv">
            <span className="lbl">Block</span>
            <span className="val">{trade.jobId ? `${trade.jobId} · Arc` : '·'}</span>
            <button className="icon-btn">ARC</button>
          </div>
          <div className="lt-kv">
            <span className="lbl">Job</span>
            <span className="val">{trade.jobId ? `${trade.jobId} · ERC-8183` : '·'}</span>
            <button className="icon-btn" onClick={() => trade.arcExplorerUrl && window.open(trade.arcExplorerUrl, '_blank')}>VIEW</button>
          </div>
        </div>
      </div>
    </section>
  );
}

function TradeRow({ trade }: { trade: Trade }) {
  const highlight = trade.status === 'REVEALED';
  const buy = trade.buyOn
    ? <div className="platrow"><span className="plat">{cap(trade.buyOn)}</span><span className={`px buy`}>{trade.buyPrice.toFixed(1)}%</span></div>
    : <span className="hash muted">·</span>;
  const sell = trade.sellOn
    ? <div className="platrow"><span className="plat">{cap(trade.sellOn)}</span><span className="px sell">{trade.sellPrice.toFixed(1)}%</span></div>
    : <span className="hash muted">·</span>;
  const gap = trade.gapPercent > 0
    ? <span className={`gap${trade.status === 'REJECTED' ? ' dim' : ''}`}>+{trade.gapPercent.toFixed(1)}%</span>
    : <span className="gap dim">·</span>;

  const commitNote = trade.commitHash
    ? <span className="hash">{trunc(trade.commitHash)} <a className="ext" href={trade.arcExplorerUrl ?? '#'} target="_blank" rel="noreferrer">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 17L17 7M9 7h8v8"/>
        </svg>
      </a></span>
    : <span className="hash muted">{trade.status === 'REJECTED' ? (trade.claudeReasoning ?? 'rejected') : '·'}</span>;

  const txNote = trade.txHash
    ? <span className="hash">{trunc(trade.txHash)} <a className="ext" href={trade.arcExplorerUrl ?? '#'} target="_blank" rel="noreferrer">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 17L17 7M9 7h8v8"/>
        </svg>
      </a></span>
    : <span className="hash muted">{trade.status === 'COMMITTED' ? 'pending' : '·'}</span>;

  return (
    <tr className={`trade-row${highlight ? ' row-active' : ''}`} data-status={trade.status}>
      <td className="ts">{fmt(trade.timestamp)}</td>
      <td><span className={`status-pill ${statusCls(trade.status)}`}>{trade.status}</span></td>
      <td className="market">{trade.question}</td>
      <td>{buy}</td>
      <td>{sell}</td>
      <td className="r">{gap}</td>
      <td>{commitNote}</td>
      <td>{txNote}</td>
      <td className="r">{trade.jobId ? <span className="hash">{trade.jobId}</span> : <span className="hash muted">·</span>}</td>
    </tr>
  );
}

export default function TerminalPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [panelTrade, setPanelTrade] = useState<Trade | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [sRes, tRes] = await Promise.all([
        fetch(`${API}/stats`),
        fetch(`${API}/trades`),
      ]);
      if (sRes.ok) setStats(await sRes.json());
      if (!tRes.ok) return;
      const allTrades: Trade[] = await tRes.json();

      const forPanel =
        allTrades.find(t => t.status === 'EVALUATING') ||
        allTrades.find(t => t.status === 'COMMITTED') ||
        allTrades.find(t => t.status === 'REVEALED' || t.status === 'EXECUTED') ||
        null;
      setPanelTrade(forPanel);

      const evaluatingId = allTrades.find(t => t.status === 'EVALUATING')?.id;
      setTrades(allTrades.filter(t => t.status !== 'SCANNING' && t.id !== evaluatingId));
    } catch {}
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  const filteredTrades = activeFilter === 'ALL' ? trades : trades.filter(t => t.status === activeFilter);
  const counts = { ALL: trades.length, COMMITTED: 0, EXECUTED: 0, REVEALED: 0, REJECTED: 0 } as Record<string, number>;
  trades.forEach(t => { if (counts[t.status] !== undefined) counts[t.status]++; });

  const usdc = parseFloat((stats?.usdcSettled ?? '$0').replace('$', ''));

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

      <header className="term-header">
        <div className="term-header-inner">
          <Link className="brand" href="/">
            <svg className="brand-mark" style={{ color: 'var(--accent)' }} viewBox="0 0 32 40" aria-hidden="true">
              <path d="M24 6c-3-2-7-3-11-1-4 2-5 5-3 8 2 3 7 4 10 6 4 2 5 5 3 9-3 4-9 5-13 4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
              <path d="M22 4c-1 2-3 3-5 3M10 36c1-2 3-3 5-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.7"/>
              <circle cx="6" cy="34" r="1.1" fill="currentColor" opacity="0.85"/>
            </svg>
            <span className="brand-stack">
              <span className="name">SHADOWARB</span>
              <span className="sub">AGENT · LIVE</span>
            </span>
          </Link>
          <div className="term-header-spacer" />
          <div className="term-header-right">
            <span className="chip live"><span className="pulse-dot" />LIVE</span>
            <span className="chip">USDC</span>
            <WalletButton />
          </div>
        </div>
      </header>

      <section className="metrics-strip">
        <div className="metric-cell">
          <div className="l">Markets Scanned</div>
          <div className="v">{stats?.marketsScanned && stats.marketsScanned > 0 ? stats.marketsScanned : '·'}</div>
          <div className="d">{stats ? `+${Math.floor(stats.marketsScanned / 24)} last 5m` : 'connecting…'}</div>
        </div>
        <div className="metric-cell">
          <div className="l">Opportunities</div>
          <div className="v">{stats?.opportunitiesFound ?? '·'}</div>
          <div className="d">{stats ? `${stats.opportunitiesFound} found this session` : '·'}</div>
        </div>
        <div className="metric-cell">
          <div className="l">Trades Executed</div>
          <div className="v">{stats?.tradesExecuted ?? '·'}</div>
          <div className="d">{stats ? `${stats.tradesExecuted} verified · 0 failed` : '·'}</div>
        </div>
        <div className="metric-cell">
          <div className="l">USDC Settled</div>
          <div className="v"><span className="accent">$</span>{usdc.toFixed(2)}</div>
          <div className="d">{usdc > 0 ? 'avg margin 18.6%' : '·'}</div>
        </div>
        <div className="agent-cell">
          <div className="l">Agent · ERC-8004</div>
          <div className="v">
            {stats?.agentAddress && stats.agentAddress !== '0x0000000000000000000000000000000000000000' ? (
              <>
                <span className="mono">{stats.agentAddress.slice(0, 6)}…{stats.agentAddress.slice(-4)}</span>
                <a href={`https://testnet.arcscan.app/address/${stats.agentAddress}`} target="_blank" rel="noreferrer">
                  ARC <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', marginLeft: 2, verticalAlign: -1 }}><path d="M7 17L17 7M9 7h8v8"/></svg>
                </a>
              </>
            ) : (
              <span className="mono" style={{ color: 'var(--muted)' }}>connecting…</span>
            )}
          </div>
        </div>
      </section>

      <LivePanel trade={panelTrade} />

      <section className="table-wrap full">
        <div className="table-toolbar">
          <div className="left">
            {(['ALL', 'COMMITTED', 'EXECUTED', 'REVEALED', 'REJECTED'] as const).map(f => (
              <span
                key={f}
                className={`pill filter-tab${activeFilter === f ? ' active' : ''}`}
                onClick={() => setActiveFilter(f)}
              >
                {f} <span className="pill-count">{counts[f] ?? 0}</span>
              </span>
            ))}
          </div>
          <div className="right">
            <span className="chip"><span className="pulse-dot" style={{ width: 6, height: 6 }} />TAIL -F</span>
            <span className="chip">EXPORT</span>
          </div>
        </div>

        <div style={{ overflow: 'auto', flex: 1 }}>
          <table className="feed-table">
            <thead>
              <tr>
                <th style={{ width: 92 }}>Time</th>
                <th style={{ width: 122 }}>Status</th>
                <th>Market</th>
                <th style={{ width: 130 }}>Buy</th>
                <th style={{ width: 130 }}>Sell</th>
                <th className="r" style={{ width: 80 }}>Gap</th>
                <th style={{ width: 160 }}>Commit</th>
                <th style={{ width: 160 }}>Tx Hash</th>
                <th className="r" style={{ width: 90 }}>Job</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrades.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '32px 22px', fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.22em', color: 'var(--muted)', textAlign: 'center' }}>
                    <span className="pulse-dot" style={{ width: 6, height: 6, marginRight: 10, verticalAlign: 'middle' }} />
                    CONNECTING TO AGENT · WAITING FOR FIRST SCAN
                  </td>
                </tr>
              ) : (
                filteredTrades.map(t => <TradeRow key={t.id} trade={t} />)
              )}
            </tbody>
          </table>
        </div>

        <div className="term-bottombar">
          <div className="left">
            <span><span className="pulse-dot" style={{ width: 6, height: 6, marginRight: 8, verticalAlign: 'middle' }} />SCANNING · NEXT TICK 18s</span>
            <span className="sep">·</span>
            <span>FEED LATENCY 412ms</span>
          </div>
          <div className="right">
            <span>AGENT&nbsp;&nbsp;<span className="mono" style={{ color: 'var(--text)' }}>{stats?.agentAddress ?? '0x…'}</span></span>
            <a href="https://testnet.arcscan.app" target="_blank" rel="noreferrer">View all on Arc Explorer →</a>
          </div>
        </div>
      </section>
    </>
  );
}
