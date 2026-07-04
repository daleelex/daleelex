import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { ServicesApi } from '../../../services/services.service';
import { TeamsApi } from '../../../services/teams.service';
import type { CreateServiceRequest, ServiceLifecycle, ServiceTier, ServiceType } from '../../../types/catalog.types';
import './register-service-modal.scss';

interface Props {
    onClose: () => void;
}

const EMPTY: CreateServiceRequest = {
    id: '',
    name: '',
    type: 'api',
    tier: 2,
    lifecycle: 'beta',
    ownerTeamId: '',
    description: '',
    language: '',
    repository: '',
};

export function RegisterServiceModal({ onClose }: Props) {
    const qc = useQueryClient();
    const firstRef = useRef<HTMLInputElement>(null);
    const [form, setForm] = useState<CreateServiceRequest>(EMPTY);
    const [fieldError, setFieldError] = useState<string | null>(null);

    const { data: teamsData } = useQuery({ queryKey: ['teams'], queryFn: TeamsApi.getAll });
    const teams = teamsData?.data ?? [];

    useEffect(() => {
        firstRef.current?.focus();
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    const { mutate, isPending, error } = useMutation({
        mutationFn: ServicesApi.create,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['services'] });
            onClose();
        },
    });

    function set<K extends keyof CreateServiceRequest>(key: K, value: CreateServiceRequest[K]) {
        setForm((prev) => ({ ...prev, [key]: value }));
        setFieldError(null);
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.id.trim()) { setFieldError('id'); return; }
        if (!form.name.trim()) { setFieldError('name'); return; }
        mutate({
            ...form,
            ownerTeamId: form.ownerTeamId || undefined,
            description: form.description || undefined,
            language: form.language || undefined,
            repository: form.repository || undefined,
        });
    }

    const errMsg = error ? (error as Error).message : null;

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <dialog className="modal" open aria-label="Register new service" aria-modal="true">
                <div className="modal-head">
                    <div>
                        <div className="modal-kicker">New service</div>
                        <h2 className="modal-title">Register a service</h2>
                    </div>
                    <button className="modal-close" onClick={onClose} aria-label="Close" type="button">
                        <X size={16} />
                    </button>
                </div>

                <form className="modal-body" onSubmit={handleSubmit} noValidate>
                    {errMsg && <div className="modal-error" role="alert">{errMsg}</div>}

                    <div className="form-row two-col">
                        <label className="form-field">
                            <span className="field-label">Service ID <abbr title="required">*</abbr></span>
                            <input
                                ref={firstRef}
                                className={`field-input mono${fieldError === 'id' ? ' invalid' : ''}`}
                                type="text"
                                placeholder="svc-auth-001"
                                value={form.id}
                                onChange={(e) => set('id', e.target.value)}
                            />
                            {fieldError === 'id' && <span className="field-hint error">Required</span>}
                            <span className="field-hint">Stable, never changes. Use svc-&lt;slug&gt;-&lt;n&gt;.</span>
                        </label>

                        <label className="form-field">
                            <span className="field-label">Name <abbr title="required">*</abbr></span>
                            <input
                                className={`field-input${fieldError === 'name' ? ' invalid' : ''}`}
                                type="text"
                                placeholder="Authentication Gateway"
                                value={form.name}
                                onChange={(e) => set('name', e.target.value)}
                            />
                            {fieldError === 'name' && <span className="field-hint error">Required</span>}
                        </label>
                    </div>

                    <div className="form-row three-col">
                        <label className="form-field">
                            <span className="field-label">Type <abbr title="required">*</abbr></span>
                            <select className="field-select" value={form.type} onChange={(e) => set('type', e.target.value as ServiceType)}>
                                {(['api', 'db', 'web', 'ml', 'tool'] as ServiceType[]).map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </label>

                        <label className="form-field">
                            <span className="field-label">Tier <abbr title="required">*</abbr></span>
                            <select className="field-select" value={form.tier} onChange={(e) => set('tier', Number(e.target.value) as ServiceTier)}>
                                <option value={1}>Tier 1 — Critical</option>
                                <option value={2}>Tier 2 — Important</option>
                                <option value={3}>Tier 3 — Internal</option>
                            </select>
                        </label>

                        <label className="form-field">
                            <span className="field-label">Lifecycle <abbr title="required">*</abbr></span>
                            <select className="field-select" value={form.lifecycle} onChange={(e) => set('lifecycle', e.target.value as ServiceLifecycle)}>
                                <option value="beta">Beta</option>
                                <option value="production">Production</option>
                                <option value="deprecated">Deprecated</option>
                            </select>
                        </label>
                    </div>

                    <label className="form-field">
                        <span className="field-label">Owner team</span>
                        <select className="field-select" value={form.ownerTeamId ?? ''} onChange={(e) => set('ownerTeamId', e.target.value)}>
                            <option value="">— Unowned —</option>
                            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        {teams.length === 0 && <span className="field-hint">No teams yet — you can assign ownership later.</span>}
                    </label>

                    <label className="form-field">
                        <span className="field-label">Description</span>
                        <textarea
                            className="field-textarea"
                            rows={3}
                            placeholder="What does this service do?"
                            value={form.description}
                            onChange={(e) => set('description', e.target.value)}
                        />
                    </label>

                    <div className="form-row two-col">
                        <label className="form-field">
                            <span className="field-label">Language</span>
                            <input className="field-input" type="text" placeholder="Go, TypeScript, Python…" value={form.language} onChange={(e) => set('language', e.target.value)} />
                        </label>

                        <label className="form-field">
                            <span className="field-label">Repository</span>
                            <input className="field-input mono" type="text" placeholder="org/repo-name" value={form.repository} onChange={(e) => set('repository', e.target.value)} />
                        </label>
                    </div>

                    <div className="modal-foot">
                        <button type="button" className="btn-ghost" onClick={onClose} disabled={isPending}>Cancel</button>
                        <button type="submit" className="btn-primary" disabled={isPending}>{isPending ? 'Registering…' : 'Register service'}</button>
                    </div>
                </form>
            </dialog>
        </>
    );
}