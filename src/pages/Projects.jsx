import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot,
  doc,
  updateDoc,
  arrayUnion,
  Timestamp,
  getDocs
} from 'firebase/firestore';
import {
  SortingAlgorithms,
  SearchAlgorithms,
  ResourceAllocation,
  TaskScheduler,
  ProjectCache,
  TaskPriorityQueue
} from '../utils/algorithms';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

// Graph implementation untuk project relationships
class ProjectGraph {
  constructor() {
    this.adjacencyList = new Map();
  }
  
  addVertex(projectId) {
    if (!this.adjacencyList.has(projectId)) {
      this.adjacencyList.set(projectId, []);
    }
  }
  
  addEdge(project1, project2) {
    this.adjacencyList.get(project1).push(project2);
    this.adjacencyList.get(project2).push(project1);
  }

  // Mencari cycle dalam graph menggunakan DFS
  hasCycle(startNode, visited = new Set(), parent = null) {
    visited.add(startNode);

    const neighbors = this.adjacencyList.get(startNode) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (this.hasCycle(neighbor, visited, startNode)) {
          return true;
        }
      } else if (neighbor !== parent) {
        return true;
      }
    }

    return false;
  }

  // Mencari shortest path antara dua proyek
  findShortestPath(start, end) {
    const queue = [[start]];
    const visited = new Set([start]);

    while (queue.length > 0) {
      const path = queue.shift();
      const current = path[path.length - 1];

      if (current === end) {
        return path;
      }

      const neighbors = this.adjacencyList.get(current) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push([...path, neighbor]);
        }
      }
    }

    return null;
  }
}

export default function Projects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [newProject, setNewProject] = useState({ 
    name: '', 
    description: '',
    content: '' 
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [projectGraph] = useState(new ProjectGraph());
  const [projectCache] = useState(new ProjectCache());
  const [taskQueue] = useState(new TaskPriorityQueue());
  const [allMembers, setAllMembers] = useState({});

  useEffect(() => {
    if (!user) return;

    const projectsQuery = query(
      collection(db, 'projects'),
      where('members', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(projectsQuery, (snapshot) => {
      try {
        let projectsList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          deadline: doc.data().deadline?.toDate() || new Date()
        }));

        // Apply sorting using Quick Sort
        projectsList = SortingAlgorithms.quickSort(projectsList, sortKey);

        // Build project graph
        projectsList.forEach(project => {
          projectGraph.addVertex(project.id);
          // Add edges based on project dependencies
          if (project.dependencies) {
            project.dependencies.forEach(depId => {
              projectGraph.addVertex(depId);
              projectGraph.addEdge(project.id, depId);
            });
          }
        });

        // Cache projects for quick lookup
        projectsList.forEach(project => {
          projectCache.set(project.id, project);
        });

        setProjects(projectsList);
        setLoading(false);
      } catch (error) {
        setError('Error loading projects: ' + error.message);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [user, sortKey, projectGraph, projectCache]);

  useEffect(() => {
    const fetchMembers = async () => {
      const membersData = {};
      const usersSnapshot = await getDocs(collection(db, 'users'));
      usersSnapshot.forEach(doc => {
        membersData[doc.id] = doc.data().name || doc.id;
      });
      setAllMembers(membersData);
    };

    fetchMembers();
  }, []);

  const addProject = async (e) => {
    e.preventDefault();
    setError('');

    try {
      // Check if project name already exists using binary search
      const sortedByName = SortingAlgorithms.quickSort([...projects], 'name');
      const existingProject = SearchAlgorithms.binarySearch(sortedByName, newProject.name);
      
      if (existingProject) {
        setError('Project with this name already exists');
        return;
      }

      const projectRef = await addDoc(collection(db, 'projects'), {
        ...newProject,
        createdBy: user.uid,
        members: [user.uid],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      // Add to graph
      projectGraph.addVertex(projectRef.id);

      // Cache the new project
      projectCache.set(projectRef.id, {
        id: projectRef.id,
        ...newProject,
        createdBy: user.uid,
        members: [user.uid]
      });

      setNewProject({ name: '', description: '', content: '' });
    } catch (error) {
      setError('Error creating project: ' + error.message);
    }
  };

  const addCollaborator = async (projectId, email) => {
    try {
      const projectRef = doc(db, 'projects', projectId);
      await updateDoc(projectRef, {
        members: arrayUnion(email),
        updatedAt: Timestamp.now()
      });

      // Update cache
      const project = projectCache.get(projectId);
      if (project) {
        project.members.push(email);
        projectCache.set(projectId, project);
      }
    } catch (error) {
      setError('Error adding collaborator: ' + error.message);
    }
  };

  // Filter projects using string matching algorithm
  const filterProjects = () => {
    if (!searchTerm) return projects;

    return projects.filter(project => {
      const searchLower = searchTerm.toLowerCase();
      return (
        project.name.toLowerCase().includes(searchLower) ||
        project.description.toLowerCase().includes(searchLower)
      );
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const filteredProjects = filterProjects();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Panel */}
        <div className="lg:col-span-1">
          <div className="card sticky top-8">
            <h2 className="text-xl font-semibold text-secondary-900 mb-6">Create Project</h2>
            <form onSubmit={addProject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) => setNewProject(prev => ({ ...prev, name: e.target.value }))}
                  className="input w-full"
                  placeholder="Title of the project"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">
                  Short Description
                </label>
                <input
                  type="text"
                  value={newProject.description}
                  onChange={(e) => setNewProject(prev => ({ ...prev, description: e.target.value }))}
                  className="input w-full"
                  placeholder="Brief description"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">
                  Content
                </label>
                <ReactQuill
                  value={newProject.content}
                  onChange={(content) => setNewProject(prev => ({ ...prev, content }))}
                  className="bg-white"
                  modules={{
                    toolbar: [
                      ['bold', 'italic', 'strike'],
                      ['blockquote', 'code-block'],
                      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                      ['link'],
                      ['clean']
                    ],
                  }}
                />
              </div>

              <button type="submit" className="btn btn-primary w-full mt-4">
                Create Project
              </button>
            </form>
          </div>
        </div>

        {/* Projects List Panel */}
        <div className="lg:col-span-2">
          {/* Search & Filter */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input"
              />
            </div>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
              className="input w-48"
            >
              <option value="name">Sort by Name</option>
              <option value="createdAt">Sort by Date</option>
              <option value="deadline">Sort by Deadline</option>
            </select>
          </div>

          {/* Projects Grid */}
          <div className="grid gap-6 sm:grid-cols-2">
            {filteredProjects.map((project) => (
              <Link 
                key={project.id} 
                to={`/project/${project.id}`}
                className="card hover:shadow-lg transition-shadow duration-200"
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-secondary-900">{project.name}</h3>
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-primary-50 text-primary-700">
                    {project.status || 'Active'}
                  </span>
                </div>
                <p className="text-secondary-600 text-sm mb-4 line-clamp-2">
                  {project.description}
                </p>
                <div className="flex justify-between items-center">
                  <div className="flex -space-x-2">
                    {project.members.slice(0, 3).map((memberId, idx) => {
                      const name = allMembers[memberId] || memberId;
                      const initials = name
                        .split(' ')
                        .map(word => word[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2);

                      return (
                        <div
                          key={idx}
                          className="w-8 h-8 rounded-full bg-primary-100 border-2 border-white flex items-center justify-center"
                        >
                          <span className="text-xs font-medium text-primary-700">
                            {initials}
                          </span>
                        </div>
                      );
                    })}
                    {project.members.length > 3 && (
                      <div className="w-8 h-8 rounded-full bg-secondary-100 border-2 border-white flex items-center justify-center">
                        <span className="text-xs font-medium text-secondary-700">
                          +{project.members.length - 3}
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-secondary-500">
                    {new Date(project.updatedAt.seconds * 1000).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
