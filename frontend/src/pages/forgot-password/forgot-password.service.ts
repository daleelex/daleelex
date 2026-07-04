import { NavigateFunction } from 'react-router-dom';
import { Route } from '../../configs/enums';

export const handleForgotPassword = async (event: React.FormEvent, navigate: NavigateFunction) => {
  event.preventDefault();
  navigate(Route.FORGOT_PASSWORD);
};
