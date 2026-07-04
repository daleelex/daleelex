import { Provider } from 'react-redux';
import { store } from './store/store';
import { ConnectionProvider } from './providers/connection-provider';
import { AppRouter } from './router/router';

export const App: React.FC = () => (
  <Provider store={store}>
    <ConnectionProvider>
      <AppRouter />
    </ConnectionProvider>
  </Provider>
);