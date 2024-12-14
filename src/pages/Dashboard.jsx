import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { Link } from 'react-router-dom';

// Queue implementation for real-time updates
class UpdateQueue {
  constructor(maxSize = 10) {
    this.items = [];
    this.maxSize = maxSize;
  }

  enqueue(item) {
    if (this.items.length >= this.maxSize) {
      this.items.shift(); // Remove oldest item
    }
    this.items.push(item);
  }

  getItems() {
    return [...this.items];
  }
}

export default function Dashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const updateQueue = new UpdateQueue();

  useEffect(() => {
    if (!user) return;

    try {
      // Subscribe to user's projects
      const projectsQuery = query(
        collection(db, 'projects'),
        where('members', 'array-contains', user.uid),
        orderBy('updatedAt', 'desc'),
        limit(5)
      );

      const unsubscribeProjects = onSnapshot(projectsQuery, (snapshot) => {
        const projectsList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setProjects(projectsList);
        
        // Add to update queue for real-time tracking
        snapshot.docChanges().forEach(change => {
          if (change.type === 'modified' || change.type === 'added') {
            updateQueue.enqueue({
              type: 'project',
              action: change.type,
              data: change.doc.data(),
              timestamp: new Date()
            });
          }
        });
      });

      // Subscribe to recent activities
      const activitiesQuery = query(
        collection(db, 'activities'),
        where('userId', '==', user.uid),
        orderBy('timestamp', 'desc'),
        limit(10)
      );

      const unsubscribeActivities = onSnapshot(activitiesQuery, (snapshot) => {
        const activitiesList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setActivities(activitiesList);
        setLoading(false);
      });

      return () => {
        unsubscribeProjects();
        unsubscribeActivities();
      };
    } catch (error) {
      setError('Error loading dashboard data: ' + error.message);
      setLoading(false);
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Projects */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Recent Projects</h2>
            <Link
              to="/projects"
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              View all
            </Link>
          </div>
          {projects.length === 0 ? (
            <p className="text-gray-500">No projects yet. Create your first project!</p>
          ) : (
            <div className="space-y-4">
              {projects.map(project => (
                <div key={project.id} className="border-l-4 border-blue-500 pl-4">
                  <h3 className="text-lg font-medium text-gray-900">{project.name}</h3>
                  <p className="text-sm text-gray-500">{project.description}</p>
                  <div className="mt-2 flex items-center text-sm text-gray-500">
                    <span>{new Date(project.updatedAt.seconds * 1000).toLocaleDateString()}</span>
                    <span className="mx-2">•</span>
                    <span>{project.members.length} members</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activities */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activities</h2>
          {activities.length === 0 ? (
            <p className="text-gray-500">No activities yet.</p>
          ) : (
            <div className="space-y-4">
              {activities.map(activity => (
                <div key={activity.id} className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
                      <span className="text-white text-sm">
                        {activity.type.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-900">{activity.description}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(activity.timestamp.seconds * 1000).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
