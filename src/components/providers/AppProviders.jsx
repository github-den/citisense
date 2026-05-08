'use client';

import { AuthProvider } from '@core/context/AuthContext.jsx';
import AuthModal from '../AuthModal/AuthModal.jsx';
import RouteAccessGuard from './RouteAccessGuard.jsx';
import NavigationLoader from '../NavigationLoader/NavigationLoader.jsx';

export default function AppProviders({ children }) {
  return (
    <AuthProvider>
      <NavigationLoader />
      <RouteAccessGuard />
      {children}
      <AuthModal />
    </AuthProvider>
  );
}
