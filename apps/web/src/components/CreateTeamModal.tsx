import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateTeamRequest, TeamWithStats } from '@daleelex/shared';
import { api } from '../api';
import './RegisterServiceModal.css';

interface Props {
  onClose: () => void;
  onCreated: (team: TeamWithStats) => void;
}

type TeamField = keyof CreateTeamRequest;

const TEAM_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLACK_CHANNEL_PATTERN = /^#[a-z0-9][a-z0-9_-]{0,79}$/;

const EMPTY_TEAM: CreateTeamRequest = {
  id: '',
  name: '',
  slackChannel: '',
  onCallSchedule: '',
};

export function CreateTeamModal({ onClose, onCreated }: Props) {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  const firstInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<CreateTeamRequest>(EMPTY_TEAM);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<TeamField, string>>>({});

  // Focus must only run on mount; the Escape listener lives in its own effect
  // below so a parent re-render (which re-creates the onClose prop) can't
  // re-fire focus and yank the caret back to the Team ID field mid-typing.
  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  const createMutation = useMutation({
    mutationFn: async (body: CreateTeamRequest) => {
      const token = await getToken();
      if (!token) throw new Error('Your session expired. Sign in again to add a team.');
      return api.createTeam(body, token);
    },
    onSuccess: async (team) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['teams'] }),
        queryClient.invalidateQueries({ queryKey: ['stats'] }),
      ]);
      onCreated(team);
    },
  });

  // While the create request is in flight, dismissing would hide the outcome
  // and invite a 409 on retry — so Escape (like Cancel and the backdrop) is
  // inert until the mutation settles.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !createMutation.isPending) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, createMutation.isPending]);

  function set<K extends TeamField>(key: K, value: CreateTeamRequest[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const normalized = normalizeTeamRequest(form);
    const errors = validateTeamRequest(normalized);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    createMutation.mutate(normalized);
  }

  return (
    <>
      <div
        className="modal-backdrop"
        onClick={createMutation.isPending ? undefined : onClose}
      />
      <dialog className="modal" open aria-label="Add a team" aria-modal="true">
        <div className="modal-head">
          <div>
            <div className="modal-kicker">DaleelEx managed</div>
            <h2 className="modal-title">Add a team</h2>
          </div>
          <button
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
            disabled={createMutation.isPending}
          >
            <CloseIcon />
          </button>
        </div>

        <form className="modal-body" onSubmit={handleSubmit} noValidate>
          {createMutation.error && (
            <div className="modal-error" role="alert">
              {(createMutation.error as Error).message}
            </div>
          )}

          <div className="form-row two-col">
            <label className="form-field">
              <span className="field-label">
                Team ID <abbr title="required">*</abbr>
              </span>
              <input
                ref={firstInputRef}
                className={`field-input mono${fieldErrors.id ? ' invalid' : ''}`}
                value={form.id}
                onChange={(event) => set('id', event.target.value)}
                placeholder="platform-identity"
                maxLength={100}
                aria-invalid={!!fieldErrors.id}
              />
              <span className={`field-hint${fieldErrors.id ? ' error' : ''}`}>
                {fieldErrors.id ?? 'Lowercase letters, numbers, and single hyphens. Immutable.'}
              </span>
            </label>

            <label className="form-field">
              <span className="field-label">
                Name <abbr title="required">*</abbr>
              </span>
              <input
                className={`field-input${fieldErrors.name ? ' invalid' : ''}`}
                value={form.name}
                onChange={(event) => set('name', event.target.value)}
                placeholder="Platform Identity"
                maxLength={200}
                aria-invalid={!!fieldErrors.name}
              />
              {fieldErrors.name && <span className="field-hint error">{fieldErrors.name}</span>}
            </label>
          </div>

          <div className="form-row two-col">
            <label className="form-field">
              <span className="field-label">Slack channel</span>
              <input
                className={`field-input mono${fieldErrors.slackChannel ? ' invalid' : ''}`}
                value={form.slackChannel ?? ''}
                onChange={(event) => set('slackChannel', event.target.value)}
                placeholder="#platform-identity"
                maxLength={81}
                aria-invalid={!!fieldErrors.slackChannel}
              />
              <span className={`field-hint${fieldErrors.slackChannel ? ' error' : ''}`}>
                {fieldErrors.slackChannel ?? 'Optional. Include the leading #.'}
              </span>
            </label>

            <label className="form-field">
              <span className="field-label">On-call schedule</span>
              <input
                className={`field-input${fieldErrors.onCallSchedule ? ' invalid' : ''}`}
                value={form.onCallSchedule ?? ''}
                onChange={(event) => set('onCallSchedule', event.target.value)}
                placeholder="PagerDuty schedule or rotation"
                maxLength={200}
                aria-invalid={!!fieldErrors.onCallSchedule}
              />
              <span className={`field-hint${fieldErrors.onCallSchedule ? ' error' : ''}`}>
                {fieldErrors.onCallSchedule ??
                  'Optional free text; no provider lookup is performed.'}
              </span>
            </label>
          </div>

          <div className="modal-foot">
            <button
              type="button"
              className="btn-ghost"
              onClick={onClose}
              disabled={createMutation.isPending}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Adding…' : 'Add team'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

export function normalizeTeamRequest(request: CreateTeamRequest): CreateTeamRequest {
  return {
    id: request.id.trim(),
    name: request.name.trim(),
    slackChannel: request.slackChannel?.trim() || null,
    onCallSchedule: request.onCallSchedule?.trim() || null,
  };
}

export function validateTeamRequest(
  request: CreateTeamRequest,
): Partial<Record<TeamField, string>> {
  const errors: Partial<Record<TeamField, string>> = {};

  if (request.id.length > 100 || !TEAM_ID_PATTERN.test(request.id)) {
    errors.id = 'Use lowercase letters, numbers, and single hyphens.';
  }
  if (!request.name) errors.name = 'Name is required.';
  else if (request.name.length > 200) errors.name = 'Use 200 characters or fewer.';
  if (request.slackChannel && !SLACK_CHANNEL_PATTERN.test(request.slackChannel)) {
    errors.slackChannel = 'Use a channel name such as #platform-identity.';
  }
  if (request.onCallSchedule && request.onCallSchedule.length > 200) {
    errors.onCallSchedule = 'Use 200 characters or fewer.';
  }

  return errors;
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
