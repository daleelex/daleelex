import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TeamWithStats } from '@daleelex/shared';
import { api } from '../api';
import { TeamMembersTab } from './TeamMembersTab';
import './TeamDrawer.css';

type Tab = 'overview' | 'services' | 'members' | 'scorecard';
const TABS: Tab[] = ['overview', 'services', 'members', 'scorecard'];

interface Props {
  team: TeamWithStats | null;
  isAdmin: boolean;
  onClose: () => void;
  onUpdateSuccess?: (team: TeamWithStats) => void;
}

export function TeamDrawer({ team, isAdmin, onClose, onUpdateSuccess }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [name, setName] = useState('');
  const [slackChannel, setSlackChannel] = useState('');
  const [onCallSchedule, setOnCallSchedule] = useState('');
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const updateMutation = useMutation({
    mutationFn: async () =>
      api.updateTeam(
        team!.id,
        {
          name,
          slackChannel: slackChannel.trim() || null,
          onCallSchedule: onCallSchedule.trim() || null,
        },
        (await getToken()) ?? undefined,
      ),
    onSuccess: async (updated) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['teams'] }),
        queryClient.invalidateQueries({ queryKey: ['services'] }),
      ]);
      setEditing(false);
      onUpdateSuccess?.(updated);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (target: TeamWithStats) =>
      api.deleteTeam(target.id, (await getToken()) ?? undefined),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['teams'] }),
        queryClient.invalidateQueries({ queryKey: ['services'] }),
      ]);
      onClose();
    },
  });
  const resetDelete = deleteMutation.reset;

  useEffect(() => {
    setConfirmingDelete(false);
    resetDelete();
  }, [team?.id, resetDelete]);

  useEffect(() => {
    setTab('overview');
    setEditing(false);
    setName(team?.name ?? '');
    setSlackChannel(team?.slackChannel ?? '');
    setOnCallSchedule(team?.onCallSchedule ?? '');
  }, [team?.id, team?.name, team?.onCallSchedule, team?.slackChannel]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!team) return null;

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={team.name}>
        <div className="drawer-head">
          <button className="drawer-icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
          <div style={{ flex: 1 }} />
          {confirmingDelete ? (
            team.serviceCount > 0 ? (
              <div className="delete-confirm">
                <span className="delete-confirm-label">
                  Reassign or delete its {team.serviceCount}{' '}
                  {team.serviceCount === 1 ? 'service' : 'services'} first.
                </span>
                <button className="ghost-btn" onClick={() => setConfirmingDelete(false)}>
                  OK
                </button>
              </div>
            ) : (
              <div className="delete-confirm">
                <span className="delete-confirm-label">Delete this team?</span>
                <button
                  className="ghost-btn delete-confirm-yes"
                  onClick={() => deleteMutation.mutate(team)}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
                </button>
                <button
                  className="ghost-btn"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleteMutation.isPending}
                >
                  Cancel
                </button>
              </div>
            )
          ) : (
            team.managementSource === 'portal' && (
              <>
                <button className="ghost-btn" onClick={() => setEditing((value) => !value)}>
                  {editing ? 'Cancel' : 'Edit'}
                </button>
                {isAdmin && (
                  <button className="ghost-btn" onClick={() => setConfirmingDelete(true)}>
                    <TrashIcon /> Delete
                  </button>
                )}
              </>
            )
          )}
        </div>

        {deleteMutation.error && (
          <div className="drawer-alert error" role="alert">
            {(deleteMutation.error as Error).message}
          </div>
        )}

        <div className="drawer-body">
          <div className="team-drawer-hero">
            <div className="team-drawer-avatar">{initials(team.name)}</div>
            <div>
              <h2 className="drawer-title" style={{ fontSize: 28, marginTop: 0 }}>
                {team.name}
              </h2>
              <div className="drawer-id">{team.id}</div>
            </div>
          </div>
          <div className="drawer-id">
            {team.managementSource === 'portal' ? 'Managed in DaleelEx' : 'Synced from GitHub'}
          </div>

          {editing && (
            <form
              className="team-edit-form"
              onSubmit={(event) => {
                event.preventDefault();
                updateMutation.mutate();
              }}
            >
              {updateMutation.error && (
                <div className="drawer-alert error" role="alert">
                  {(updateMutation.error as Error).message}
                </div>
              )}
              <label>
                <span className="meta-label">Team ID · immutable</span>
                <input value={team.id} disabled />
              </label>
              <label>
                <span className="meta-label">Name</span>
                <input value={name} onChange={(event) => setName(event.target.value)} required />
              </label>
              <label>
                <span className="meta-label">Slack channel</span>
                <input
                  value={slackChannel}
                  onChange={(event) => setSlackChannel(event.target.value)}
                />
              </label>
              <label>
                <span className="meta-label">On-call schedule</span>
                <input
                  value={onCallSchedule}
                  onChange={(event) => setOnCallSchedule(event.target.value)}
                />
              </label>
              <button className="ghost-btn" disabled={updateMutation.isPending || !name.trim()}>
                {updateMutation.isPending ? 'Saving…' : 'Save changes'}
              </button>
            </form>
          )}

          <div className="tabs">
            {TABS.map((t) => (
              <button
                key={t}
                className={`tab${tab === t ? ' active' : ''}`}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="tab-content">
            {tab === 'overview' && <TeamOverviewTab team={team} />}
            {tab === 'services' && <TeamServicesTab team={team} />}
            {tab === 'members' && <TeamMembersTab teamId={team.id} isAdmin={isAdmin} />}
            {tab === 'scorecard' && <TeamScorecardTab team={team} />}
          </div>
        </div>
      </aside>
    </>
  );
}

function TeamOverviewTab({ team }: { team: TeamWithStats }) {
  return (
    <>
      <div className="kv-grid">
        <div className="kv">
          <div className="meta-label">Slack channel</div>
          <div className="meta-value">{team.slackChannel ?? '—'}</div>
        </div>
        <div className="kv">
          <div className="meta-label">On-call schedule</div>
          <div className="meta-value">{team.onCallSchedule ?? 'Not configured'}</div>
        </div>
        <div className="kv">
          <div className="meta-label">Total services</div>
          <div className="meta-value">{team.serviceCount}</div>
        </div>
        <div className="kv">
          <div className="meta-label">Critical (Tier 1)</div>
          <div className="meta-value">{team.tier1Count}</div>
        </div>
        <div className="kv">
          <div className="meta-label">Average health</div>
          <div className="meta-value">
            {team.averageScorecardHealth === null
              ? 'Not scored'
              : `${team.averageScorecardHealth}%`}
          </div>
        </div>
        <div className="kv">
          <div className="meta-label">Ownership gaps</div>
          <div className="meta-value">{team.openOwnershipGaps.length}</div>
        </div>
      </div>

      <h4 className="section-title">Service tiers</h4>
      <div className="tier-breakdown">
        {team.tier1Count > 0 && (
          <div className="tier-bar-row">
            <span className="tier-bar-label tier-1">T1</span>
            <div className="tier-bar-track">
              <div
                className="tier-bar-fill tier-fill-1"
                style={{ width: `${(team.tier1Count / team.serviceCount) * 100}%` }}
              />
            </div>
            <span className="tier-bar-count">{team.tier1Count}</span>
          </div>
        )}
        {team.tier2Count > 0 && (
          <div className="tier-bar-row">
            <span className="tier-bar-label tier-2">T2</span>
            <div className="tier-bar-track">
              <div
                className="tier-bar-fill tier-fill-2"
                style={{ width: `${(team.tier2Count / team.serviceCount) * 100}%` }}
              />
            </div>
            <span className="tier-bar-count">{team.tier2Count}</span>
          </div>
        )}
        {team.tier3Count > 0 && (
          <div className="tier-bar-row">
            <span className="tier-bar-label tier-3">T3</span>
            <div className="tier-bar-track">
              <div
                className="tier-bar-fill tier-fill-3"
                style={{ width: `${(team.tier3Count / team.serviceCount) * 100}%` }}
              />
            </div>
            <span className="tier-bar-count">{team.tier3Count}</span>
          </div>
        )}
        {team.serviceCount === 0 && (
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>No services owned yet.</p>
        )}
      </div>
    </>
  );
}

function TeamServicesTab({ team }: { team: TeamWithStats }) {
  if (team.services.length === 0) {
    return (
      <div className="dep-empty">
        <p>No services owned by this team yet.</p>
      </div>
    );
  }

  return (
    <div className="doc-list">
      {team.services.map((s) => (
        <div key={s.id} className="team-svc-row">
          <span className={`service-tier-dot tier-dot-${s.tier}`} />
          <div style={{ flex: 1 }}>
            <div className="doc-title">{s.name}</div>
            <div className="doc-sub">
              {s.type} · tier {s.tier}
            </div>
          </div>
          <span className={`service-health${s.hasOwnershipGap ? ' gap' : ''}`}>
            {s.hasOwnershipGap
              ? 'Owner gap'
              : s.scorecardHealth === null
                ? 'Not scored'
                : `${s.scorecardHealth}%`}
          </span>
          <span className={`tier-badge tier-${s.tier}`}>T{s.tier}</span>
        </div>
      ))}
    </div>
  );
}

function TeamScorecardTab({ team }: { team: TeamWithStats }) {
  const score = team.averageScorecardHealth;
  return (
    <>
      <div className="score-hero">
        <div className="ring-wrap">
          <Ring score={score ?? 0} />
          <span className="ring-pct">{score === null ? '—' : `${score}%`}</span>
        </div>
        <div>
          <div className="score-hero-label">Average service health</div>
          <div className="score-hero-main">
            {team.scoredServiceCount} / {team.serviceCount} services scored
          </div>
          <div className="score-hero-sub">Latest enabled, weighted scorecard checks</div>
        </div>
      </div>

      <h4 className="section-title">Open ownership gaps</h4>
      {team.openOwnershipGaps.length === 0 ? (
        <div className="dep-empty">
          <p>No failed owner-assigned checks.</p>
        </div>
      ) : (
        <div>
          {team.openOwnershipGaps.map((gap) => (
            <div key={gap.serviceId} className="check-row fail">
              <AlertIcon />
              <span className="check-label">
                {gap.serviceName}
                {gap.message && <small>{gap.message}</small>}
              </span>
              <span className="check-status fail">action needed</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Ring({ score }: { score: number }) {
  const r = 42;
  const w = 7;
  const size = (r + w) * 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ transform: 'rotate(-90deg)' }}
    >
      <circle
        cx={r + w}
        cy={r + w}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth={w}
      />
      <circle
        cx={r + w}
        cy={r + w}
        r={r}
        fill="none"
        stroke="white"
        strokeWidth={w}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
      />
    </svg>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--warn)"
      strokeWidth="2.25"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
