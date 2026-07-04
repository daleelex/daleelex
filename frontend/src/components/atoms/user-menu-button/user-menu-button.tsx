import React from 'react';
import './user-menu-button.scss';

export interface UserMenuButtonProps {
    username: string;
    imageUrl: string;
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
    className?: string;
    ariaControls: string;
    ariaHaspopup: boolean;
    style?: React.CSSProperties;
}

export const UserMenuButton: React.FC<UserMenuButtonProps> = ({
    username,
    imageUrl,
    className,
    onClick,
    ariaControls,
    ariaHaspopup,
    style,
    ...rest
}) => {
    const combinedClassName = `nav-user-menu ${className || ''}`;

    return (
        <button
            type="button"
            className={combinedClassName}
            onClick={onClick}
            aria-controls={ariaControls}
            aria-haspopup={ariaHaspopup}
            style={style}
            {...rest}
        >
            <img
                src={imageUrl}
                alt={`${username}'s profile`}
                className="user-profile-image"
            />
        </button>
    );
};