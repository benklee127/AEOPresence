import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LogIn, LogOut, User as UserIcon } from 'lucide-react';

export default function AuthStatus() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const currentUser = await base44.auth.getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Error checking user:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    try {
      setLoading(true);
      await base44.auth.login('dev'); // Development login
      await checkUser();
    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setLoading(true);
      await base44.auth.logout();
      setUser(null);
      window.location.reload(); // Refresh to clear state
    } catch (error) {
      console.error('Logout error:', error);
      alert('Logout failed: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"></div>
        Checking auth...
      </div>
    );
  }

  if (!user) {
    return (
      <Button onClick={handleLogin} variant="outline" size="sm">
        <LogIn className="w-4 h-4 mr-2" />
        Sign In (Dev)
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 text-sm">
        <UserIcon className="w-4 h-4 text-slate-600" />
        <div>
          <div className="font-medium">{user.full_name || user.email}</div>
          {user.role && (
            <div className="text-xs text-slate-500 capitalize">{user.role}</div>
          )}
        </div>
      </div>
      <Button onClick={handleLogout} variant="ghost" size="sm">
        <LogOut className="w-4 h-4 mr-2" />
        Sign Out
      </Button>
    </div>
  );
}
