import { UserButton } from '@clerk/react';
import './UserAvatar.css';

export function UserAvatar() {
  return (
    <div className="user-avatar" title="Open account menu">
      <UserButton
        showName
        appearance={{
          elements: {
            userButtonBox: 'user-avatar__box',
            userButtonTrigger: 'user-avatar__trigger',
            avatarBox: 'user-avatar__image',
            userButtonOuterIdentifier: 'user-avatar__name',
          },
        }}
      />
    </div>
  );
}
