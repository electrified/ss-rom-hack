import React, { createContext, useContext, useState, useCallback } from 'react';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem('adminCredentials');
  });
  const [error, setError] = useState(null);

  const login = useCallback(async (username, password) => {
    try {
      // Test credentials by making a request to admin stats
      const credentials = btoa(`${username}:${password}`);
      const response = await fetch('/api/admin/stats', {
        headers: {
          'Authorization': `Basic ${credentials}`,
        },
      });

      if (response.status === 401) {
        setError('Invalid username or password');
        return false;
      }

      if (!response.ok) {
        setError('Failed to authenticate');
        return false;
      }

      // Store credentials
      localStorage.setItem('adminCredentials', credentials);
      setIsAuthenticated(true);
      setError(null);
      return true;
    } catch (err) {
      setError('Network error');
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('adminCredentials');
    setIsAuthenticated(false);
    setError(null);
  }, []);

  const value = {
    isAuthenticated,
    login,
    logout,
    error,
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider');
  }
  return context;
}
