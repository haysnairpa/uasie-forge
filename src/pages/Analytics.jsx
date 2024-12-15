import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  Timestamp 
} from 'firebase/firestore';
import TimeSeriesAnalyzer from '../utils/analytics';

// Trie untuk autocomplete dan search suggestions
class TrieNode {
  // Each node stores character data and word completion status
  // Uses Map for O(1) child access and memory efficiency
  constructor() {
    this.children = new Map(); // Store child nodes
    this.isEndOfWord = false;  // Mark complete words
    this.data = null;          // Store additional data for complete words
  }
}

class Trie {
  constructor() {
    this.root = new TrieNode();
  }

  // O(m) insertion where m is word length
  // Stores word data for autocomplete suggestions
  insert(word, data) {
    let current = this.root;
    // Build trie path for each character
    for (const char of word.toLowerCase()) {
      if (!current.children.has(char)) {
        current.children.set(char, new TrieNode());
      }
      current = current.children.get(char);
    }
    current.isEndOfWord = true;
    current.data = data; // Store associated data
  }

  // O(p + n) search where p is prefix length and n is number of matching words
  // Returns array of matches with their associated data
  search(prefix) {
    let current = this.root;
    // Navigate to prefix endpoint
    for (const char of prefix.toLowerCase()) {
      if (!current.children.has(char)) return [];
      current = current.children.get(char);
    }
    return this.collectWords(current, prefix);
  }

  // DFS to collect all words with given prefix
  // O(n) where n is number of matching words
  collectWords(node, prefix, words = []) {
    if (node.isEndOfWord) {
      words.push({ word: prefix, data: node.data });
    }
    // Recursively collect all child paths
    for (const [char, childNode] of node.children) {
      this.collectWords(childNode, prefix + char, words);
    }
    return words;
  }
}

// AVL Tree untuk balanced data storage
class AVLNode {
  constructor(key, value) {
    this.key = key;
    this.value = value;
    this.height = 1;
    this.left = null;
    this.right = null;
  }
}

class AVLTree {
  constructor() {
    this.root = null;
  }

  height(node) {
    return node ? node.height : 0;
  }

  balanceFactor(node) {
    return node ? this.height(node.left) - this.height(node.right) : 0;
  }

  updateHeight(node) {
    node.height = Math.max(this.height(node.left), this.height(node.right)) + 1;
  }

  rotateRight(y) {
    const x = y.left;
    const T2 = x.right;
    x.right = y;
    y.left = T2;
    this.updateHeight(y);
    this.updateHeight(x);
    return x;
  }

  rotateLeft(x) {
    const y = x.right;
    const T2 = y.left;
    y.left = x;
    x.right = T2;
    this.updateHeight(x);
    this.updateHeight(y);
    return y;
  }

  insert(key, value) {
    this.root = this._insert(this.root, key, value);
  }

  _insert(node, key, value) {
    if (!node) return new AVLNode(key, value);

    if (key < node.key) {
      node.left = this._insert(node.left, key, value);
    } else if (key > node.key) {
      node.right = this._insert(node.right, key, value);
    } else {
      node.value = value;
      return node;
    }

    this.updateHeight(node);
    const balance = this.balanceFactor(node);

    // Left Left
    if (balance > 1 && key < node.left.key) {
      return this.rotateRight(node);
    }
    // Right Right
    if (balance < -1 && key > node.right.key) {
      return this.rotateLeft(node);
    }
    // Left Right
    if (balance > 1 && key > node.left.key) {
      node.left = this.rotateLeft(node.left);
      return this.rotateRight(node);
    }
    // Right Left
    if (balance < -1 && key < node.right.key) {
      node.right = this.rotateRight(node.right);
      return this.rotateLeft(node);
    }

    return node;
  }

  inorderTraversal(callback) {
    this._inorderTraversal(this.root, callback);
  }

  _inorderTraversal(node, callback) {
    if (node) {
      this._inorderTraversal(node.left, callback);
      callback(node);
      this._inorderTraversal(node.right, callback);
    }
  }
}

// Time Series Analysis using Sliding Window
// class TimeSeriesAnalyzer {
//   constructor(windowSize) {
//     this.windowSize = windowSize;
//     this.dataPoints = [];
//   }

//   addDataPoint(timestamp, value) {
//     this.dataPoints.push({ timestamp, value });
//     // Keep only points within window
//     const cutoff = timestamp - this.windowSize;
//     this.dataPoints = this.dataPoints.filter(point => point.timestamp > cutoff);
//   }

//   calculateMovingAverage() {
//     if (this.dataPoints.length === 0) return 0;
//     const sum = this.dataPoints.reduce((acc, point) => acc + point.value, 0);
//     return sum / this.dataPoints.length;
//   }

//   findTrend() {
//     if (this.dataPoints.length < 2) return 'neutral';
//     const firstHalf = this.dataPoints.slice(0, Math.floor(this.dataPoints.length / 2));
//     const secondHalf = this.dataPoints.slice(Math.floor(this.dataPoints.length / 2));
    
//     const firstAvg = firstHalf.reduce((acc, point) => acc + point.value, 0) / firstHalf.length;
//     const secondAvg = secondHalf.reduce((acc, point) => acc + point.value, 0) / secondHalf.length;
    
//     if (secondAvg > firstAvg) return 'increasing';
//     if (secondAvg < firstAvg) return 'decreasing';
//     return 'neutral';
//   }
// }

export default function Analytics() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [projectTrie] = useState(new Trie());
  const [taskTree] = useState(new AVLTree());
  const [timeAnalyzer] = useState(new TimeSeriesAnalyzer(7 * 24 * 60 * 60 * 1000)); // 7 days window

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        // Fetch projects
        const projectsQuery = query(
          collection(db, 'projects'),
          where('members', 'array-contains', user.uid)
        );
        const projectsSnap = await getDocs(projectsQuery);
        const projectsList = projectsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setProjects(projectsList);

        // Build Trie for project search
        projectsList.forEach(project => {
          projectTrie.insert(project.name, project);
        });

        // Fetch tasks
        const tasksQuery = query(
          collection(db, 'tasks'),
          where('projectId', 'in', projectsList.map(p => p.id))
        );
        const tasksSnap = await getDocs(tasksQuery);
        const tasksList = tasksSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setTasks(tasksList);

        // Build AVL Tree for task organization
        tasksList.forEach(task => {
          taskTree.insert(task.priority, task);
        });

        // Add task completion data to time series
        tasksList
          .filter(task => task.status === 'completed')
          .forEach(task => {
            timeAnalyzer.addDataPoint(
              task.completedAt?.seconds || Date.now() / 1000,
              1
            );
          });

        setLoading(false);
      } catch (error) {
        setError('Error fetching analytics data: ' + error.message);
        setLoading(false);
      }
    };

    fetchData();
  }, [user, projectTrie, taskTree, timeAnalyzer]);

  // Search using Trie
  const handleSearch = (term) => {
    setSearchTerm(term);
    if (term.trim()) {
      const results = projectTrie.search(term);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  };

  // Calculate project completion rate
  const calculateCompletionRate = () => {
    const completedTasks = tasks.filter(task => task.status === 'completed').length;
    return tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0;
  };

  // Get high priority tasks using AVL Tree
  const getHighPriorityTasks = () => {
    const highPriorityTasks = [];
    taskTree.inorderTraversal(node => {
      if (node.value.priority >= 4) { // Priority 4-5 considered high
        highPriorityTasks.push(node.value);
      }
    });
    return highPriorityTasks;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const completionRate = calculateCompletionRate();
  const highPriorityTasks = getHighPriorityTasks();
  const productivityTrend = timeAnalyzer.findTrend();
  const averageCompletions = timeAnalyzer.calculateMovingAverage();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {error && (
        <div className="card border-l-4 border-red-500 !bg-red-50 mb-6">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Search dengan Autocomplete */}
      <div className="card mb-8">
        <div className="relative">
          <input
            type="text"
            placeholder="Search projects or tasks..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="input pl-10"
          />
          <svg 
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400"
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        
        {searchResults.length > 0 && (
          <div className="absolute z-10 w-full mt-2 bg-white rounded-lg shadow-dropdown">
            {searchResults.map(({ word, data }) => (
              <div key={data.id} className="p-4 hover:bg-secondary-50 cursor-pointer border-b border-secondary-100 last:border-0">
                <h4 className="font-medium text-secondary-900">{data.name}</h4>
                <p className="text-sm text-secondary-600 mt-1">{data.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Analytics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Project Overview Card */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-secondary-900">Overview</h3>
            <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-primary-50 text-primary-700">
              Last 7 Days
            </span>
          </div>
          
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-secondary-600">Projects</span>
                <span className="text-2xl font-semibold text-secondary-900">{projects.length}</span>
              </div>
              <div className="h-1 bg-secondary-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary-500 rounded-full" 
                  style={{width: `${(projects.length / 10) * 100}%`}}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-secondary-600">Tasks</span>
                <span className="text-2xl font-semibold text-secondary-900">{tasks.length}</span>
              </div>
              <div className="h-1 bg-secondary-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary-500 rounded-full" 
                  style={{width: `${(tasks.length / 50) * 100}%`}}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-secondary-600">Completion Rate</span>
                <span className="text-2xl font-semibold text-secondary-900">
                  {completionRate.toFixed(1)}%
                </span>
              </div>
              <div className="h-1 bg-secondary-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary-500 rounded-full" 
                  style={{width: `${completionRate}%`}}
                />
              </div>
            </div>
          </div>
        </div>

        {/* High Priority Tasks Card */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-secondary-900">High Priority</h3>
            <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-red-50 text-red-700">
              {highPriorityTasks.length} Tasks
            </span>
          </div>

          <div className="space-y-3">
            {highPriorityTasks.map(task => (
              <div key={task.id} className="flex items-center p-3 bg-secondary-50 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-red-500 mr-3" />
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-secondary-900 truncate">{task.title}</h4>
                  <p className="text-xs text-secondary-500 mt-0.5">Due in {task.daysLeft || 'N/A'} days</p>
                </div>
                <span className={`ml-3 px-2 py-1 text-xs font-medium rounded-full ${
                  task.status === 'in-progress' ? 'bg-yellow-50 text-yellow-700' : 'bg-secondary-100 text-secondary-700'
                }`}>
                  {task.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Productivity Trends Card */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-secondary-900">Productivity</h3>
            <div className={`px-2.5 py-1 text-xs font-medium rounded-full ${
              productivityTrend === 'increasing' ? 'bg-green-50 text-green-700' :
              productivityTrend === 'decreasing' ? 'bg-red-50 text-red-700' :
              'bg-yellow-50 text-yellow-700'
            }`}>
              {productivityTrend.charAt(0).toUpperCase() + productivityTrend.slice(1)}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-secondary-600">Daily Average</span>
                <span className="text-2xl font-semibold text-secondary-900">
                  {averageCompletions.toFixed(1)}
                </span>
              </div>
              <div className="h-1 bg-secondary-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 rounded-full" 
                  style={{width: `${(averageCompletions / 10) * 100}%`}}
                />
              </div>
            </div>

            {/* Simplified Chart */}
            <div className="h-32 flex items-end justify-between gap-1">
              {timeAnalyzer.getDailyData().map((value, index) => (
                <div
                  key={index}
                  className="w-full bg-primary-100 rounded-t"
                  style={{
                    height: `${(value / timeAnalyzer.getMaxValue()) * 100}%`,
                    minHeight: '4px'
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Team Performance Card */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-secondary-900">Team Performance</h3>
            <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-primary-50 text-primary-700">
              By Project
            </span>
          </div>

          <div className="space-y-4">
            {projects.map(project => {
              const projectTasks = tasks.filter(t => t.projectId === project.id);
              const projectCompletion = projectTasks.length > 0
                ? (projectTasks.filter(t => t.status === 'completed').length / projectTasks.length) * 100
                : 0;
              
              return (
                <div key={project.id}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-secondary-600 truncate">{project.name}</span>
                    <span className="text-sm font-medium text-secondary-900">
                      {projectCompletion.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-secondary-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full"
                      style={{
                        width: `${projectCompletion}%`,
                        backgroundColor: `hsl(${projectCompletion * 1.2}, 70%, 50%)`
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
