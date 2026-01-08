import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./components/Lobby', () => () => <div>Lobby View</div>);
jest.mock('./components/Game', () => () => <div>Game View</div>);
jest.mock('./components/Login', () => () => <div>Login View</div>);
jest.mock('./contexts/SocketContext', () => ({
  SocketProvider: ({ children }) => <div data-testid="socket-provider">{children}</div>,
}));

test('renders lobby route by default', () => {
  render(<App />);
  expect(screen.getByText('Lobby View')).toBeInTheDocument();
  expect(screen.getByTestId('router')).toBeInTheDocument();
});
