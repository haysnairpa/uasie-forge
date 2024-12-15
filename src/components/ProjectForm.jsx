import { useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

export default function ProjectForm({ onSubmit, existingProjects }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    content: '',
    dependencies: []
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-2">Project Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({...formData, name: e.target.value})}
          className="input w-full"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Description</label>
        <input
          type="text"
          value={formData.description}
          onChange={(e) => setFormData({...formData, description: e.target.value})}
          className="input w-full"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Content</label>
        <ReactQuill
          value={formData.content}
          onChange={(content) => setFormData({...formData, content})}
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

      <div>
        <label className="block text-sm font-medium mb-2">
          Project Dependencies
        </label>
        <div className="space-y-2">
          {existingProjects.map(project => (
            <label key={project.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.dependencies.includes(project.id)}
                onChange={(e) => {
                  const deps = e.target.checked 
                    ? [...formData.dependencies, project.id]
                    : formData.dependencies.filter(id => id !== project.id);
                  setFormData({...formData, dependencies: deps});
                }}
                className="rounded border-gray-300"
              />
              <span>{project.name}</span>
              <span className={`ml-2 px-2 py-1 text-xs rounded-full 
                ${project.status === 'completed' 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-yellow-100 text-yellow-700'}`}>
                {project.status}
              </span>
            </label>
          ))}
        </div>
      </div>

      <button type="submit" className="btn btn-primary w-full">
        Create Project
      </button>
    </form>
  );
}