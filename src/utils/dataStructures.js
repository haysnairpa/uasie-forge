// Priority Queue for Task Management
class PriorityQueue {
  constructor() {
    this.values = [];
  }

  enqueue(task, priority) {
    this.values.push({ task, priority });
    this.sort();
  }

  dequeue() {
    return this.values.shift();
  }

  sort() {
    this.values.sort((a, b) => a.priority - b.priority);
  }
}

// Task Queue for Real-time Updates
class TaskQueue {
  constructor() {
    this.items = {};
    this.frontIndex = 0;
    this.backIndex = 0;
  }

  enqueue(item) {
    this.items[this.backIndex] = item;
    this.backIndex++;
    return item;
  }

  dequeue() {
    const item = this.items[this.frontIndex];
    delete this.items[this.frontIndex];
    this.frontIndex++;
    return item;
  }

  peek() {
    return this.items[this.frontIndex];
  }

  isEmpty() {
    return this.frontIndex === this.backIndex;
  }

  size() {
    return this.backIndex - this.frontIndex;
  }
}

// Tree structure for Project Hierarchy
class ProjectNode {
  constructor(projectId, projectData) {
    this.projectId = projectId;
    this.projectData = projectData;
    this.children = new Map();
    this.parent = null;
  }

  addChild(childNode) {
    this.children.set(childNode.projectId, childNode);
    childNode.parent = this;
  }

  removeChild(projectId) {
    this.children.delete(projectId);
  }

  getChild(projectId) {
    return this.children.get(projectId);
  }

  hasChildren() {
    return this.children.size > 0;
  }
}

class ProjectTree {
  constructor() {
    this.root = null;
  }

  insert(parentId, projectId, projectData) {
    const newNode = new ProjectNode(projectId, projectData);

    if (!this.root) {
      this.root = newNode;
      return;
    }

    const parentNode = this.findNode(this.root, parentId);
    if (parentNode) {
      parentNode.addChild(newNode);
    }
  }

  findNode(node, projectId) {
    if (node.projectId === projectId) {
      return node;
    }

    for (const childNode of node.children.values()) {
      const found = this.findNode(childNode, projectId);
      if (found) return found;
    }

    return null;
  }

  // Depth-First Search untuk mencari proyek
  dfsSearch(searchTerm) {
    const results = [];
    
    function dfs(node) {
      if (node.projectData.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          node.projectData.description.toLowerCase().includes(searchTerm.toLowerCase())) {
        results.push(node.projectData);
      }
      
      for (const childNode of node.children.values()) {
        dfs(childNode);
      }
    }

    if (this.root) {
      dfs(this.root);
    }

    return results;
  }

  // Breadth-First Search untuk level proyek
  bfsTraversal() {
    if (!this.root) return [];

    const result = [];
    const queue = [this.root];

    while (queue.length > 0) {
      const node = queue.shift();
      result.push(node.projectData);

      for (const childNode of node.children.values()) {
        queue.push(childNode);
      }
    }

    return result;
  }
}

// Algoritma untuk menghitung Critical Path dalam proyek
class Task {
  constructor(id, duration, dependencies = []) {
    this.id = id;
    this.duration = duration;
    this.dependencies = dependencies;
    this.earliestStart = 0;
    this.earliestFinish = 0;
    this.latestStart = 0;
    this.latestFinish = 0;
    this.slack = 0;
  }
}

class CriticalPathAnalysis {
  constructor(tasks) {
    this.tasks = new Map(tasks.map(task => [task.id, task]));
  }

  calculateCriticalPath() {
    this.forwardPass();
    this.backwardPass();
    return this.findCriticalPath();
  }

  forwardPass() {
    for (const task of this.tasks.values()) {
      if (task.dependencies.length === 0) {
        task.earliestStart = 0;
        task.earliestFinish = task.duration;
      } else {
        task.earliestStart = Math.max(...task.dependencies.map(depId => 
          this.tasks.get(depId).earliestFinish
        ));
        task.earliestFinish = task.earliestStart + task.duration;
      }
    }
  }

  backwardPass() {
    const projectEnd = Math.max(...Array.from(this.tasks.values()).map(t => t.earliestFinish));
    
    for (const task of Array.from(this.tasks.values()).reverse()) {
      const dependentTasks = Array.from(this.tasks.values())
        .filter(t => t.dependencies.includes(task.id));

      if (dependentTasks.length === 0) {
        task.latestFinish = projectEnd;
      } else {
        task.latestFinish = Math.min(...dependentTasks.map(t => t.latestStart));
      }

      task.latestStart = task.latestFinish - task.duration;
      task.slack = task.latestStart - task.earliestStart;
    }
  }

  findCriticalPath() {
    return Array.from(this.tasks.values())
      .filter(task => task.slack === 0)
      .map(task => task.id);
  }
}

export {
  PriorityQueue,
  TaskQueue,
  ProjectNode,
  ProjectTree,
  Task,
  CriticalPathAnalysis
};
