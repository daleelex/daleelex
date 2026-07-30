import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Service,
  ServiceLifecycle,
  ServiceTier,
  ServiceType,
  UpdateServiceRequest,
} from '@daleelex/shared';
import { api } from '../api';
import './RegisterServiceModal.css';

export function EditServiceModal({
  service,
  onClose,
  onUpdated,
}: {
  service: Service;
  onClose: () => void;
  onUpdated: (service: Service) => void;
}) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<UpdateServiceRequest>({
    name: service.name,
    description: service.description,
    type: service.type,
    tier: service.tier,
    lifecycle: service.lifecycle,
    ownerTeamId: service.ownerTeamId,
    language: service.language,
    repository: service.repository,
    sloTarget: service.sloTarget,
    sloWindow: service.sloWindow,
    tags: service.tags,
  });
  const { data: teamsData } = useQuery({ queryKey: ['teams'], queryFn: api.teams });
  const mutation = useMutation({
    mutationFn: async () => api.updateService(service.id, form, (await getToken()) ?? undefined),
    onSuccess: async (updated) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['services'] }),
        queryClient.invalidateQueries({ queryKey: ['teams'] }),
      ]);
      onUpdated(updated);
      onClose();
    },
  });
  const initial = useMemo(
    () => ({
      name: service.name,
      description: service.description,
      type: service.type,
      tier: service.tier,
      lifecycle: service.lifecycle,
      ownerTeamId: service.ownerTeamId,
      language: service.language,
      repository: service.repository,
      sloTarget: service.sloTarget,
      sloWindow: service.sloWindow,
      tags: service.tags,
    }),
    [service],
  );
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const safeClose = useCallback(() => {
    if (!dirty || window.confirm('Discard your unsaved service changes?')) onClose();
  }, [dirty, onClose]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') safeClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [safeClose]);

  function set<K extends keyof UpdateServiceRequest>(key: K, value: UpdateServiceRequest[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <>
      <div className="modal-backdrop" />
      <dialog className="modal" open aria-modal="true" aria-label={`Edit ${service.name}`}>
        <div className="modal-head">
          <div>
            <div className="modal-kicker">Managed in DaleelEx</div>
            <h2 className="modal-title">Edit service</h2>
          </div>
          <button className="modal-close" onClick={safeClose} aria-label="Close">
            ×
          </button>
        </div>
        <form
          className="modal-body"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          {mutation.error && (
            <div className="modal-error" role="alert">
              {(mutation.error as Error).message}
            </div>
          )}
          <label className="form-field">
            <span className="field-label">Service ID · immutable</span>
            <input className="field-input mono" value={service.id} disabled />
          </label>
          <div className="form-row two-col">
            <label className="form-field">
              <span className="field-label">Name</span>
              <input
                className="field-input"
                required
                value={form.name}
                onChange={(event) => set('name', event.target.value)}
              />
            </label>
            <label className="form-field">
              <span className="field-label">Owner team</span>
              <select
                className="field-select"
                value={form.ownerTeamId ?? ''}
                onChange={(event) => set('ownerTeamId', event.target.value || null)}
              >
                <option value="">— Unowned —</option>
                {(teamsData?.data ?? []).map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="form-field">
            <span className="field-label">Description</span>
            <textarea
              className="field-textarea"
              rows={3}
              value={form.description ?? ''}
              onChange={(event) => set('description', event.target.value || null)}
            />
          </label>
          <div className="form-row three-col">
            <label className="form-field">
              <span className="field-label">Type</span>
              <select
                className="field-select"
                value={form.type}
                onChange={(event) => set('type', event.target.value as ServiceType)}
              >
                {(['api', 'db', 'web', 'ml', 'tool'] as ServiceType[]).map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span className="field-label">Tier</span>
              <select
                className="field-select"
                value={form.tier}
                onChange={(event) => set('tier', Number(event.target.value) as ServiceTier)}
              >
                <option value={1}>Tier 1</option>
                <option value={2}>Tier 2</option>
                <option value={3}>Tier 3</option>
              </select>
            </label>
            <label className="form-field">
              <span className="field-label">Lifecycle</span>
              <select
                className="field-select"
                value={form.lifecycle}
                onChange={(event) => set('lifecycle', event.target.value as ServiceLifecycle)}
              >
                <option value="beta">Beta</option>
                <option value="production">Production</option>
                <option value="deprecated">Deprecated</option>
              </select>
            </label>
          </div>
          <div className="form-row two-col">
            {[
              ['language', 'Language'],
              ['repository', 'Repository'],
              ['sloTarget', 'SLO target'],
              ['sloWindow', 'SLO window'],
            ].map(([key, label]) => (
              <label className="form-field" key={key}>
                <span className="field-label">{label}</span>
                <input
                  className="field-input"
                  value={(form[key as keyof UpdateServiceRequest] as string | null) ?? ''}
                  onChange={(event) =>
                    set(key as keyof UpdateServiceRequest, (event.target.value || null) as never)
                  }
                />
              </label>
            ))}
          </div>
          <label className="form-field">
            <span className="field-label">Tags · comma separated</span>
            <input
              className="field-input"
              value={form.tags.join(', ')}
              onChange={(event) =>
                set(
                  'tags',
                  event.target.value
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                )
              }
            />
          </label>
          <div className="modal-foot">
            <button type="button" className="btn-ghost" onClick={safeClose}>
              Cancel
            </button>
            <button className="btn-primary" disabled={mutation.isPending || !form.name.trim()}>
              {mutation.isPending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
