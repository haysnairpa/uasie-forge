import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <nav className="bg-white border-b border-secondary-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
          <Link to="/" className="flex items-center">
            <svg className="h-8 w-8 text-primary-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 7h-2v4H7v2h4v4h2v-4h4v-2h-4V7zm-1-5C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
            </svg>
            <span className="ml-2 text-xl font-semibold text-secondary-900">ProjectHub</span>
          </Link>
            {user && (
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link
                  to="/"
                  className={({ isActive }) =>
                    `flex items-center px-1 pt-1 text-sm font-medium border-b-2 ${
                      isActive
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-secondary-500 hover:text-secondary-700 hover:border-secondary-300'
                    }`
                  }
                >
                  Dashboard
                </Link>
                <Link
                  to="/projects"
                  className={({ isActive }) =>
                    `flex items-center px-1 pt-1 text-sm font-medium border-b-2 ${
                      isActive
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-secondary-500 hover:text-secondary-700 hover:border-secondary-300'
                    }`
                  }
                >
                  Projects
                </Link>
                <Link
                  to="/analytics"
                  className={({ isActive }) =>
                    `flex items-center px-1 pt-1 text-sm font-medium border-b-2 ${
                      isActive
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-secondary-500 hover:text-secondary-700 hover:border-secondary-300'
                    }`
                  }
                >
                  Analytics
                </Link>
              </div>
            )}
          </div>
          <div className="flex items-center">
            {user ? (
              <button
                onClick={handleLogout}
                className="btn btn-secondary"
              >
                Logout
              </button>
            ) : (
              <div className="space-x-4">
                <Link
                  to="/login"
                  className="btn btn-secondary"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="btn btn-primary"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
