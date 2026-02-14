import React, { createContext, useContext, useState } from 'react';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState(null);

  const login = async (username, password) => {
    try {
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

      localStorage.setItem('adminCredentials', credentials);
      setIsAuthenticated(true);
      setError(null);
      return true;
    } catch (err) {
      setError('Network error');
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('adminCredentials');
    setIsAuthenticated(false);
    setError(null);
  };

  return (
    <AdminAuthContext.Provider value={{ isAuthenticated, login, logout, error }}>
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
