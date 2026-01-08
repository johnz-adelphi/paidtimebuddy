import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireHrAdmin?: boolean;
}

export function ProtectedRoute({ children, requireHrAdmin = false }: ProtectedRouteProps) {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, isHrAdmin } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/auth');
    }
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (requireHrAdmin && !isHrAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">
            You need HR admin privileges to access this feature.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
