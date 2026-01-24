import React, { createContext, useState, useCallback } from 'react';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);

  const login = useCallback(async () => {
    // Simulate API call
    return new Promise((resolve) => {
      setTimeout(() => {
        setIsLoggedIn(true);
        setUser({
          id: '123',
          name: 'John Doe',
          email: 'john@example.com',
          role: 'admin',
        });
        resolve({ success: true });
      }, 500);
    });
  }, []);

  const logout = useCallback(() => {
    setIsLoggedIn(false);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ isLoggedIn, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
