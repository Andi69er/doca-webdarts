import React from 'react';

export const BrowserRouter = ({ children }) => <div data-testid="router">{children}</div>;
export const Routes = ({ children }) => <div data-testid="routes">{children}</div>;
export const Route = ({ element }) => element || null;
export const Navigate = ({ to }) => <div data-testid="navigate">{to}</div>;
export const useParams = () => ({});
export const useNavigate = () => () => {};
export const Link = ({ children }) => <span>{children}</span>;
