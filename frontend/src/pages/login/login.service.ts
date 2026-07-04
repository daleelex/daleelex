import { NavigateFunction } from 'react-router-dom';
// import { axios } from '../../api/axios';
// import config from '../../api/endpoints';
import { EToastType } from '../../global/global.enums';
import { showToast, getErrorMessage } from '../../utils/common-utils';
import { Route } from '../../configs/enums';

// export const loginAPI = async (email: string, password: string) => {
//   try {
//     const response = await axios.post(`${config().baseUrl}/${config().auth.login}`, {
//       email,
//       password,
//     });
//     return response.data;
//   } catch (error) {
//     throw error;
//   }
// };

export const handleLogin = async (username: string, password: string, navigate: NavigateFunction) => {
  try {
    await login(username, password);
    showToast(EToastType.SUCCESS, 'Signed in');
    navigate(Route.HOME);
  } catch (err: any) {
    const message = getErrorMessage(err.message);
    showToast(EToastType.ERROR, message);
  }
};

export const handleForgotPassword = async (event: React.MouseEvent<HTMLElement>, navigate: NavigateFunction) => {
  event.preventDefault();
  navigate(Route.FORGOT_PASSWORD);
};

const AUTH_TOKEN_KEY = 'isAuthenticated';
const VALID_USERNAME = 'faouad';
const VALID_PASSWORD = '00000000';

/**
 * Checks if the user is authenticated by looking for a flag in localStorage.
 * @returns boolean - True if the user is considered logged in.
 */
export const isAuthenticated = (): boolean => {
  return localStorage.getItem(AUTH_TOKEN_KEY) === 'true';
};

/**
 * Simulates a login attempt with hardcoded credentials.
 * On success, sets the authentication flag in localStorage.
 * @param username - The provided username.
 * @param password - The provided password.
 * @returns boolean - True if login was successful.
 */
export const login = async (username: string, password?: string): Promise<boolean> => {
  if (username === VALID_USERNAME && password === VALID_PASSWORD) {
    // Set authentication flag
    localStorage.setItem(AUTH_TOKEN_KEY, 'true');
    return true;
  }
  // Clear any existing flag on failure
  localStorage.removeItem(AUTH_TOKEN_KEY);
  throw new Error('Invalid username or password');
};

/**
 * Logs the user out by removing the authentication flag.
 */
export const logout = (): void => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
};
