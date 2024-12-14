import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot,
  Timestamp,
  arrayUnion 
} from 'firebase/firestore';
import { 
  PriorityQueue,
  TaskQueue,
  ProjectTree,
  Task,
  CriticalPathAnalysis 
} from '../utils/dataStructures';

export default function ProjectDetail() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [newTask, setNewTask] = useState({ 
    title: '', 
    description: '', 
    assignedTo: '', 
    status: 'todo',
    priority: 1,
    duration: 1,
    dependencies: []
  });
  const [taskQueue] = useState(new TaskQueue());
  const [priorityQueue] = useState(new PriorityQueue());
  const [projectTree] = useState(new ProjectTree());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!projectId || !user) return;

    const fetchProjectDetails = async () => {
      try {
        // Get project details
        const projectRef = doc(db, 'projects', projectId);
        const projectSnap = await getDoc(projectRef);
        
        if (projectSnap.exists()) {
          setProject({ id: projectSnap.id, ...projectSnap.data() });
        } else {
          setError('Project not found');
        }

        // Subscribe to tasks
        const tasksQuery = query(
          collection(db, 'tasks'),
          where('projectId', '==', projectId)
        );

        const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
          const tasksList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setTasks(tasksList);
        });

        // Subscribe to comments
        const commentsQuery = query(
          collection(db, 'comments'),
          where('projectId', '==', projectId)
        );

        const unsubscribeComments = onSnapshot(commentsQuery, (snapshot) => {
          const commentsList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setComments(commentsList);
        });

        setLoading(false);

        return () => {
          unsubscribeTasks();
          unsubscribeComments();
        };
      } catch (error) {
        setError('Error loading project: ' + error.message);
        setLoading(false);
      }
    };

    fetchProjectDetails();
  }, [projectId, user]);

  const addTask = async (e) => {
    e.preventDefault();
    setError('');

    try {
      // Tambahkan task ke Priority Queue berdasarkan prioritas
      priorityQueue.enqueue(newTask, newTask.priority);

      // Tambahkan task ke Task Queue untuk real-time updates
      taskQueue.enqueue(newTask);

      // Buat task untuk Critical Path Analysis
      const task = new Task(
        Date.now().toString(),
        newTask.duration,
        newTask.dependencies
      );

      const taskRef = await addDoc(collection(db, 'tasks'), {
        ...newTask,
        projectId,
        createdBy: user.uid,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        status: 'todo'
      });

      // Analisis Critical Path setelah menambah task baru
      const allTasks = tasks.map(t => new Task(
        t.id,
        t.duration || 1,
        t.dependencies || []
      ));
      allTasks.push(task);
      
      const cpa = new CriticalPathAnalysis(allTasks);
      const criticalPath = cpa.calculateCriticalPath();
      
      // Update task dengan informasi critical path
      if (criticalPath.includes(task.id)) {
        await updateDoc(taskRef, {
          isCritical: true
        });
      }

      // Add activity
      await addDoc(collection(db, 'activities'), {
        type: 'task_created',
        description: `Created task: ${newTask.title}`,
        userId: user.uid,
        projectId,
        taskId: taskRef.id,
        timestamp: Timestamp.now()
      });

      setNewTask({ 
        title: '', 
        description: '', 
        assignedTo: '', 
        status: 'todo',
        priority: 1,
        duration: 1,
        dependencies: []
      });
    } catch (error) {
      setError('Error creating task: ' + error.message);
    }
  };

  const updateTaskStatus = async (taskId, newStatus) => {
    try {
      const taskRef = doc(db, 'tasks', taskId);
      await updateDoc(taskRef, {
        status: newStatus,
        updatedAt: Timestamp.now()
      });

      // Add activity
      await addDoc(collection(db, 'activities'), {
        type: 'task_updated',
        description: `Updated task status to ${newStatus}`,
        userId: user.uid,
        projectId,
        taskId,
        timestamp: Timestamp.now()
      });
    } catch (error) {
      setError('Error updating task: ' + error.message);
    }
  };

  const addComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      await addDoc(collection(db, 'comments'), {
        content: newComment,
        userId: user.uid,
        projectId,
        createdAt: Timestamp.now()
      });

      setNewComment('');
    } catch (error) {
      setError('Error adding comment: ' + error.message);
    }
  };

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

  if (!project) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative">
          Project not found
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Project Header */}
      <div className="card mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-secondary-900 mb-2">{project?.name}</h1>
            <p className="text-secondary-600">{project?.description}</p>
          </div>
          <div className="flex gap-4">
            <button className="btn btn-secondary">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Invite Member
            </button>
            <button className="btn btn-primary">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Project Settings
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Task Management */}
        <div className="lg:col-span-2 space-y-6">
          {/* Add Task Form */}
          <div className="card">
            <h2 className="text-lg font-semibold text-secondary-900 mb-4">Add New Task</h2>
            <form onSubmit={addTask} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={newTask.title}
                    onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">Assign To</label>
                  <select
                    value={newTask.assignedTo}
                    onChange={(e) => setNewTask(prev => ({ ...prev, assignedTo: e.target.value }))}
                    className="input"
                    required
                  >
                    <option value="">Select team member</option>
                    {project?.members?.map(memberId => (
                      <option key={memberId} value={memberId}>{memberId}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">Description</label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="input"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">Priority (1-5)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={newTask.priority}
                    onChange={(e) => setNewTask(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">Duration (days)</label>
                  <input
                    type="number"
                    min="1"
                    value={newTask.duration}
                    onChange={(e) => setNewTask(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                    className="input"
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary w-full">
                Add Task
              </button>
            </form>
          </div>

          {/* Task Kanban Board */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Todo Column */}
            <div className="card !p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-secondary-900">To Do</h3>
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-secondary-100 text-secondary-700">
                  {tasks.filter(task => task.status === 'todo').length}
                </span>
              </div>
              <div className="space-y-3">
                {tasks.filter(task => task.status === 'todo').map(task => (
                  <div key={task.id} className="p-3 bg-secondary-50 rounded-lg border border-secondary-100">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-secondary-900">{task.title}</h4>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        task.priority >= 4 ? 'bg-red-100 text-red-700' :
                        task.priority >= 2 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        P{task.priority}
                      </span>
                    </div>
                    <p className="text-sm text-secondary-600 mb-3">{task.description}</p>
                    <button
                      onClick={() => updateTaskStatus(task.id, 'in-progress')}
                      className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                    >
                      Start Progress →
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* In Progress Column */}
            <div className="card !p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-secondary-900">In Progress</h3>
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-primary-100 text-primary-700">
                  {tasks.filter(task => task.status === 'in-progress').length}
                </span>
              </div>
              <div className="space-y-3">
                {tasks.filter(task => task.status === 'in-progress').map(task => (
                  <div key={task.id} className="p-3 bg-secondary-50 rounded-lg border border-secondary-100">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-secondary-900">{task.title}</h4>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        task.priority >= 4 ? 'bg-red-100 text-red-700' :
                        task.priority >= 2 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        P{task.priority}
                      </span>
                    </div>
                    <p className="text-sm text-secondary-600 mb-3">{task.description}</p>
                    <button
                      onClick={() => updateTaskStatus(task.id, 'completed')}
                      className="text-sm text-green-600 hover:text-green-700 font-medium"
                    >
                      Complete ✓
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Completed Column */}
            <div className="card !p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-secondary-900">Completed</h3>
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                  {tasks.filter(task => task.status === 'completed').length}
                </span>
              </div>
              <div className="space-y-3">
                {tasks.filter(task => task.status === 'completed').map(task => (
                  <div key={task.id} className="p-3 bg-secondary-50 rounded-lg border border-secondary-100">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-secondary-900">{task.title}</h4>
                      <span className="text-xs text-green-600">✓ Done</span>
                    </div>
                    <p className="text-sm text-secondary-600">{task.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Comments Section */}
        <div className="lg:col-span-1">
          <div className="card sticky top-8">
            <h2 className="text-lg font-semibold text-secondary-900 mb-6">Team Discussion</h2>
            
            <div className="space-y-4 mb-6 max-h-[calc(100vh-24rem)] overflow-y-auto">
              {comments.map(comment => (
                <div key={comment.id} className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary-700">
                      {comment.userId.substring(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="bg-secondary-50 rounded-lg p-3">
                      <p className="text-sm text-secondary-900">{comment.content}</p>
                    </div>
                    <p className="mt-1 text-xs text-secondary-500">
                      {new Date(comment.createdAt.seconds * 1000).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={addComment} className="mt-4">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                rows={3}
                className="input mb-3"
                required
              />
              <button type="submit" className="btn btn-primary w-full">
                Post Comment
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
