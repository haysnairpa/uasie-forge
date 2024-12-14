import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  arrayUnion,
  deleteDoc,
  getDocs
} from 'firebase/firestore';
import { 
  PriorityQueue,
  TaskQueue,
  ProjectTree,
  Task,
  CriticalPathAnalysis 
} from '../utils/dataStructures';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css'

export default function ProjectDetail() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [members, setMembers] = useState({})
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
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [projectSettings, setProjectSettings] = useState({
    name: project?.name || '',
    description: project?.description || '',
    content: project?.content || '',
    status: project?.status || 'active',
    completedAt: project?.completedAt || null
  });
  const navigate = useNavigate();

  const addCollaborator = async (email) => {
    try {
      const projectRef = doc(db, 'projects', projectId);
      await updateDoc(projectRef, {
        members: arrayUnion(email),
        updatedAt: Timestamp.now()
      })

      await addDoc(collection(db, 'activities'), {
        type: 'member_invited',
        description: `Invited ${email} to project`,
        userId: user.uid,
        projectId,
        timestamp: Timestamp.now()
      })

      setShowInviteModal(false)
      setInviteEmail('')
    } catch (error) {
      setError('Failed to invite member: ' + error.message)
    }
  }

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

  useEffect(() => {
    if (!project?.members) return

    const fetchMembers = async () => {
      const membersData = {}
      for (const memberId of project.members) {
        const userDoc = await getDoc(doc(db, 'users', memberId))
        if (userDoc.exists()) {
          membersData[memberId] = userDoc.data().name || memberId
        }
      }
      setMembers(membersData)
    }

    fetchMembers()
  }, [project?.members])

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

  const deleteProject = async () => {
    if (!window.confirm('Are you sure you want to delete this project?')) return;
    
    try {
      await deleteDoc(doc(db, 'projects', projectId));
      // Delete related tasks
      const tasksQuery = query(collection(db, 'tasks'), where('projectId', '==', projectId));
      const tasksDocs = await getDocs(tasksQuery);
      tasksDocs.forEach(async (taskDoc) => {
        await deleteDoc(doc(db, 'tasks', taskDoc.id));
      });
      
      // Delete related comments
      const commentsQuery = query(collection(db, 'comments'), where('projectId', '==', projectId));
      const commentsDocs = await getDocs(commentsQuery);
      commentsDocs.forEach(async (commentDoc) => {
        await deleteDoc(doc(db, 'comments', commentDoc.id));
      });

      navigate('/projects');
    } catch (error) {
      setError('Failed to delete project: ' + error.message);
    }
  };

  const completeProject = async () => {
    if (!window.confirm('Are you sure this project is completed?')) return;

    try {
      const projectRef = doc(db, 'projects', projectId)
      await updateDoc(projectRef, {
        status: 'completed',
        completedAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      })

      const tasksQuery = query(collection(db, 'tasks'), where('projectId', '==', projectId))
      const tasksDocs = await getDocs(tasksQuery)
      tasksDocs.forEach(async (taskDoc) => {
        await updateDoc(doc (db, 'tasks', taskDoc.id), {
          status: 'completed',
          completedAt: Timestamp.now()
        })
      })

      await addDoc(collection(db, 'activities'), {
        type: 'project_completed',
        description: `Project "${project.name}" has been completed!`,
        userId: user.uid,
        projectId,
        timestamp: Timestamp.now()
      })
    } catch (error) {
      setError('Failed to complete project: ' + error.message);
    }
  }

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
      {/* Status Banner */}
      {project?.status === 'completed' && (
        <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-8">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-green-700">
                This project was completed on {new Date(project.completedAt?.seconds * 1000).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Project Header dengan conditional buttons */}
      <div className="card mb-8">
        <div className="flex justify-between items-start mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-secondary-900">{project?.name}</h1>
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                project?.status === 'completed' 
                  ? 'bg-green-100 text-green-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {project?.status === 'completed' ? 'Completed' : 'Active'}
              </span>
            </div>
            <p className="text-secondary-600 mb-4">{project?.description}</p>
            <div className="prose max-w-none" 
                 dangerouslySetInnerHTML={{ __html: project?.content }} />
          </div>
          {project?.status !== 'completed' && (
            <div className="flex gap-4">
              <button 
                onClick={() => setShowInviteModal(true)}
                className="btn btn-secondary">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Invite Member
              </button>
              <button 
                onClick={() => setShowSettingsModal(true)}
                className="btn btn-primary">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                Project Settings
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Task Management Section dengan conditional rendering */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Add Task Form hanya muncul jika project belum completed */}
          {project?.status !== 'completed' && (
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
                      {Object.entries(members).map(([id, name]) =>  (
                        <option key={id} value={id}>{name}</option>
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
          )}

          {/* Task Kanban Board dengan visual berbeda untuk completed project */}
          <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${
            project?.status === 'completed' ? 'opacity-75' : ''
          }`}>
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
                    {project?.status !== 'completed' && (
                      <button
                        onClick={() => updateTaskStatus(task.id, 'in-progress')}
                        className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                      >
                        Start Progress →
                      </button>
                    )}
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

        {/* Team Discussion tetap aktif meski project completed */}
        <div className="lg:col-span-1">
          <div className="card">
            <h2 className="text-lg font-semibold text-secondary-900 mb-4">Team Discussion</h2>
            <div className="space-y-4">
              {comments.map(comment => (
                <div key={comment.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="text-xs font-medium text-primary-700">
                      {comment.userId.substring(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-secondary-600">{comment.content}</p>
                    <span className="text-xs text-secondary-400">
                      {new Date(comment.timestamp?.seconds * 1000).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={addComment} className="mt-4">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="input w-full mb-2"
                rows={3}
                placeholder="Write a comment..."
                required
              />
              <button type="submit" className="btn btn-primary w-full">
                Post Comment
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Invite Team Member</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                await addCollaborator(projectId, inviteEmail);
                setShowInviteModal(false);
                setInviteEmail('');
              } catch (error) {
                setError('Failed to invite member: ' + error.message);
              }
            }}>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Enter email address"
                className="input mb-4 w-full"
                required
              />
              <div className="flex justify-end gap-2">
                <button 
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <h3 className="text-lg font-semibold text-secondary-900 mb-4">Project Settings</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const projectRef = doc(db, 'projects', projectId);
                await updateDoc(projectRef, {
                  ...projectSettings,
                  updatedAt: Timestamp.now()
                });
                setShowSettingsModal(false);
              } catch (error) {
                setError('Failed to update project: ' + error.message);
              }
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={projectSettings.name}
                    onChange={(e) => setProjectSettings(prev => ({...prev, name: e.target.value}))}
                    className="input w-full"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={projectSettings.description}
                    onChange={(e) => setProjectSettings(prev => ({...prev, description: e.target.value}))}
                    className="input w-full"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">
                    Content
                  </label>
                  <ReactQuill
                    value={projectSettings.content}
                    onChange={(content) => setProjectSettings(prev => ({...prev, content}))}
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
              </div>

              <div className="flex justify-between mt-6">
                <button 
                  type="button"
                  onClick={deleteProject}
                  className="btn btn-danger"
                >
                  Delete Project
                </button>
                {projectSettings.status !== 'completed' && (
                  <button
                    type='button'
                    onClick={completeProject}
                    className='btn btn-success'
                  >
                    Complete Project
                  </button>
                )}
                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={() => setShowSettingsModal(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
