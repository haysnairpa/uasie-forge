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
import DependencyGraph from '../components/DependencyGraph';
import ProjectCard from '../components/ProjectCard';
import ProjectForm from '../components/ProjectForm';

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
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [dependencies, setDependencies] = useState([]);
  const [formData, setFormData] = useState({
    dependencies: []
  });

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
    const deps = projects.flatMap(project => 
      (project.dependencies || []).map(depId => ({
        source: project.id,
        target: depId
      }))
    );
    setDependencies(deps);
  }, [projects]);

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

  const addProject = async (formData) => {
    setError('');

    try {
      const hasUnfinishedDeps = formData.dependencies?.some(depId => {
        const dep = projects.find(p => p.id === depId);
        return dep && dep.status !== 'completed';
      });

      const projectRef = await addDoc(collection(db, 'projects'), {
        name: formData.name,
        description: formData.description,
        content: formData.content,
        dependencies: formData.dependencies || [],
        createdBy: user.uid,
        members: [user.uid],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        status: hasUnfinishedDeps ? 'waiting' : 'ready'
      });

      // Add to graph
      projectGraph.addVertex(projectRef.id);
      formData.dependencies?.forEach(depId => {
        projectGraph.addVertex(depId);
        projectGraph.addEdge(projectRef.id, depId);
      });

      setShowNewProjectForm(false);
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
            <ProjectForm 
              onSubmit={addProject} 
              existingProjects={projects} 
            />
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
          <DependencyGraph projects={projects} dependencies={dependencies} />
          <div className="grid gap-6 sm:grid-cols-2 mt-8">
            {filteredProjects.map((project) => (
              <ProjectCard 
                key={project.id} 
                project={project}
                allProjects={projects}
                members={allMembers}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
