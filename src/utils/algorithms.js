// Sorting Algorithms
export class SortingAlgorithms {
  // Quick Sort untuk mengurutkan proyek berdasarkan deadline
  static quickSort(projects, key) {
    if (projects.length <= 1) return projects;

    const pivot = projects[Math.floor(projects.length / 2)];
    const left = projects.filter(p => p[key] < pivot[key]);
    const middle = projects.filter(p => p[key] === pivot[key]);
    const right = projects.filter(p => p[key] > pivot[key]);

    return [...this.quickSort(left, key), ...middle, ...this.quickSort(right, key)];
  }

  // Merge Sort untuk mengurutkan task berdasarkan prioritas
  static mergeSort(tasks) {
    if (tasks.length <= 1) return tasks;

    const mid = Math.floor(tasks.length / 2);
    const left = tasks.slice(0, mid);
    const right = tasks.slice(mid);

    return this.merge(
      this.mergeSort(left),
      this.mergeSort(right)
    );
  }

  static merge(left, right) {
    const result = [];
    let leftIndex = 0;
    let rightIndex = 0;

    while (leftIndex < left.length && rightIndex < right.length) {
      if (left[leftIndex].priority <= right[rightIndex].priority) {
        result.push(left[leftIndex]);
        leftIndex++;
      } else {
        result.push(right[rightIndex]);
        rightIndex++;
      }
    }

    return result.concat(left.slice(leftIndex)).concat(right.slice(rightIndex));
  }
}

// Search Algorithms
export class SearchAlgorithms {
  // Binary Search untuk mencari proyek berdasarkan nama
  static binarySearch(sortedArray, target) {
    let left = 0;
    let right = sortedArray.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (sortedArray[mid].name === target) return sortedArray[mid];
      if (sortedArray[mid].name < target) left = mid + 1;
      else right = mid - 1;
    }

    return null;
  }

  // Depth-First Search untuk mencari path dependensi proyek
  static dfs(graph, startNode, visited = new Set()) {
    visited.add(startNode);
    const paths = [];

    const neighbors = graph.get(startNode) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        paths.push(...this.dfs(graph, neighbor, visited));
      }
    }

    return [startNode, ...paths];
  }
}

// Hash Table implementation for caching and quick lookups
export class ProjectCache {
  constructor(size = 100) {
    this.size = size;
    this.cache = new Array(size).fill(null).map(() => new Map());
  }

  hash(key) {
    let total = 0;
    for (let i = 0; i < key.length; i++) {
      total += key.charCodeAt(i);
    }
    return total % this.size;
  }

  set(key, value) {
    const index = this.hash(key);
    this.cache[index].set(key, {
      value,
      timestamp: Date.now()
    });
  }

  get(key) {
    const index = this.hash(key);
    const item = this.cache[index].get(key);
    return item ? item.value : null;
  }

  clear() {
    this.cache = new Array(this.size).fill(null).map(() => new Map());
  }
}

// Greedy Algorithm untuk resource allocation
export class ResourceAllocation {
  static allocateResources(tasks, availableResources) {
    // Sort tasks by priority (descending) and duration (ascending)
    const sortedTasks = tasks.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.duration - b.duration;
    });

    const allocation = new Map();
    const resourceLoad = new Map(availableResources.map(r => [r.id, 0]));

    for (const task of sortedTasks) {
      // Find resource with minimum current load
      let minLoadResource = availableResources[0];
      let minLoad = resourceLoad.get(minLoadResource.id);

      for (const resource of availableResources) {
        const currentLoad = resourceLoad.get(resource.id);
        if (currentLoad < minLoad) {
          minLoad = currentLoad;
          minLoadResource = resource;
        }
      }

      // Allocate task to resource
      allocation.set(task.id, minLoadResource.id);
      resourceLoad.set(
        minLoadResource.id,
        resourceLoad.get(minLoadResource.id) + task.duration
      );
    }

    return allocation;
  }
}

// Dynamic Programming untuk optimal task scheduling
export class TaskScheduler {
  static findOptimalSchedule(tasks, maxDuration) {
    const n = tasks.length;
    const dp = Array(n + 1).fill(null).map(() => Array(maxDuration + 1).fill(0));
    const included = Array(n + 1).fill(null).map(() => Array(maxDuration + 1).fill(false));

    // Fill dp table
    for (let i = 1; i <= n; i++) {
      for (let w = 0; w <= maxDuration; w++) {
        if (tasks[i-1].duration <= w) {
          const valueWith = tasks[i-1].priority + dp[i-1][w - tasks[i-1].duration];
          const valueWithout = dp[i-1][w];
          
          if (valueWith > valueWithout) {
            dp[i][w] = valueWith;
            included[i][w] = true;
          } else {
            dp[i][w] = valueWithout;
          }
        } else {
          dp[i][w] = dp[i-1][w];
        }
      }
    }

    // Reconstruct solution
    const schedule = [];
    let i = n;
    let w = maxDuration;

    while (i > 0 && w > 0) {
      if (included[i][w]) {
        schedule.push(tasks[i-1]);
        w -= tasks[i-1].duration;
      }
      i--;
    }

    return schedule;
  }
}

// Min Heap untuk task priority management
export class TaskPriorityQueue {
  constructor() {
    this.heap = [];
  }

  parent(index) {
    return Math.floor((index - 1) / 2);
  }

  leftChild(index) {
    return 2 * index + 1;
  }

  rightChild(index) {
    return 2 * index + 2;
  }

  swap(index1, index2) {
    const temp = this.heap[index1];
    this.heap[index1] = this.heap[index2];
    this.heap[index2] = temp;
  }

  insert(task) {
    this.heap.push(task);
    this.heapifyUp(this.heap.length - 1);
  }

  heapifyUp(index) {
    while (index > 0 && this.heap[this.parent(index)].priority > this.heap[index].priority) {
      this.swap(index, this.parent(index));
      index = this.parent(index);
    }
  }

  extractMin() {
    if (this.heap.length === 0) return null;
    if (this.heap.length === 1) return this.heap.pop();

    const min = this.heap[0];
    this.heap[0] = this.heap.pop();
    this.heapifyDown(0);

    return min;
  }

  heapifyDown(index) {
    let minIndex = index;
    const leftChild = this.leftChild(index);
    const rightChild = this.rightChild(index);

    if (leftChild < this.heap.length && this.heap[leftChild].priority < this.heap[minIndex].priority) {
      minIndex = leftChild;
    }

    if (rightChild < this.heap.length && this.heap[rightChild].priority < this.heap[minIndex].priority) {
      minIndex = rightChild;
    }

    if (index !== minIndex) {
      this.swap(index, minIndex);
      this.heapifyDown(minIndex);
    }
  }
}