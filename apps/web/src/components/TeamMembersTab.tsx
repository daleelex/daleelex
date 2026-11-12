import { useState } from 'react';
import { useAuth } from '@clerk/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

interface Props {
  teamId: string;
  isAdmin: boolean;
}

export function TeamMembersTab({ teamId, isAdmin }: Props) {
  const [email, setEmail] = useState('');
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['team-members', teamId];

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => api.teamMembers(teamId, (await getToken()) ?? ''),
  });

  const addMutation = useMutation({
    mutationFn: async () => api.addTeamMember(teamId, email.trim(), (await getToken()) ?? ''),
    onSuccess: async () => {
      setEmail('');
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (userId: string) =>
      api.removeTeamMember(teamId, userId, (await getToken()) ?? ''),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const members = data?.data ?? [];
  const mutationError = addMutation.error ?? removeMutation.error;

  return (
    <>
      <p className="members-note">
        Members can read the logs of services this team owns.
        {isAdmin && ' People must sign in to DaleelEx once before they can be added.'}
      </p>

      {isAdmin && (
        <form
          className="member-add-form"
          onSubmit={(event) => {
            event.preventDefault();
            addMutation.mutate();
          }}
        >
          <input
            type="email"
            placeholder="name@company.com"
            aria-label="Member email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <button className="ghost-btn" disabled={addMutation.isPending || !email.trim()}>
            {addMutation.isPending ? 'Adding…' : 'Add member'}
          </button>
        </form>
      )}

      {mutationError && (
        <div className="drawer-alert error" role="alert">
          {(mutationError as Error).message}
        </div>
      )}

      {isLoading ? (
        <div className="dep-empty">
          <p>Loading members…</p>
        </div>
      ) : error ? (
        <div className="drawer-alert error" role="alert">
          {(error as Error).message}
        </div>
      ) : members.length === 0 ? (
        <div className="dep-empty">
          <p>No members yet.</p>
        </div>
      ) : (
        <div className="doc-list">
          {members.map((member) => (
            <div key={member.userId} className="team-svc-row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="doc-title">{member.name ?? member.email}</div>
                {member.name && <div className="doc-sub">{member.email}</div>}
              </div>
              {isAdmin && (
                <button
                  className="ghost-btn"
                  disabled={removeMutation.isPending}
                  onClick={() => removeMutation.mutate(member.userId)}
                  aria-label={`Remove ${member.name ?? member.email}`}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
