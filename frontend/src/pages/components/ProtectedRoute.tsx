import { Navigate } from 'react-router-dom';
import { authService } from '../../services/auth';
import { useRestaurant } from '../../context/RestaurantContext';
import { Logo } from './Logo';

interface ProtectedRouteProps {
  children: JSX.Element;
  allowedRoles: string[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, rol } = authService.getCurrentUser();
  const userRol = rol?.toLowerCase() || '';
  const normalizedRoles = allowedRoles.map((role) => role.toLowerCase());
  const { loading } = useRestaurant();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!normalizedRoles.includes(userRol)) {
    return <Navigate to="/" replace />;
  }

  return children;
}