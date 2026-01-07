import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Layout = ({ children }) => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getLinkClasses = (path) => {
    const isActive = location.pathname === path;
    return isActive
      ? "border-blue-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link to="/dashboard" className="flex items-center gap-2.5">
                  <img 
                    src="/logo.png" 
                    alt="CiviSight" 
                    className="h-9 w-auto"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                  <span className="text-xl font-semibold text-gray-900">
                    CiviSight
                  </span>
                </Link>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {isAdmin ? (
                  <>
                    <Link
                      to="/dashboard"
                      className={getLinkClasses('/dashboard')}
                    >
                      Dashboard
                    </Link>
                    <Link
                      to="/create-task"
                      className={getLinkClasses('/create-task')}
                    >
                      Create Task
                    </Link>
                    <Link
                      to="/notifications"
                      className={getLinkClasses('/notifications')}
                    >
                      Notifications
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      to={user?.countyId ? `/county/${user.countyId}` : '/dashboard'}
                      className={getLinkClasses(user?.countyId ? `/county/${user.countyId}` : '/dashboard')}
                    >
                      My Tasks
                    </Link>
                    {user?.countyId && (
                      <Link
                        to={`/county/${user.countyId}/contacts`}
                        className={getLinkClasses(`/county/${user.countyId}/contacts`)}
                      >
                        Contacts
                      </Link>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-sm text-gray-700 mr-4">
                  {user?.username} ({user?.role === 'admin' ? 'Admin' : 'County User'})
                </span>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
};

export default Layout;

