import { UserButton } from '@clerk/react';
import './UserAvatar.css';

export function UserAvatar() {
  return (
    <div className="user-avatar">
      <UserButton
        appearance={{
          elements: {
            userButtonTrigger: 'user-avatar__trigger',
            avatarBox: 'user-avatar__image',
          },
        }}
      />
    </div>
  );
}
