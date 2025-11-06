import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase-client';

/**
 * Auth callback page for OAuth redirects
 * Handles the OAuth callback from Google and redirects to the app
 */
export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth event:', event, session);

      if (event === 'SIGNED_IN' && session) {
        // Successfully signed in, redirect to home
        navigate('/');
      } else if (event === 'SIGNED_OUT') {
        // User signed out, redirect to home
        navigate('/');
      }
    });

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-4"></div>
        <p className="text-lg text-gray-700">Completing sign in...</p>
      </div>
    </div>
  );
}
