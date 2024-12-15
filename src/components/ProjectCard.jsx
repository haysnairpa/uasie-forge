import { Link } from 'react-router-dom';

export default function ProjectCard({ project, allProjects, members }) {
  const unfinishedDeps = project.dependencies?.filter(depId => {
    const dep = allProjects.find(p => p.id === depId);
    return dep && dep.status !== 'completed';
  }) || [];

  const canStart = unfinishedDeps.length === 0;

  return (
    <Link 
      to={`/project/${project.id}`}
      className="card hover:shadow-lg transition-shadow duration-200"
    >
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold text-secondary-900">
          {project.name}
        </h3>
        <span className={`px-2 py-1 text-xs font-medium rounded-full
          ${project.status === 'completed' 
            ? 'bg-green-100 text-green-700'
            : canStart 
              ? 'bg-blue-100 text-blue-700'
              : 'bg-yellow-100 text-yellow-700'
          }`}
        >
          {project.status === 'completed' 
            ? 'Completed' 
            : canStart 
              ? 'Ready'
              : 'Waiting Dependencies'}
        </span>
      </div>

      <p className="text-secondary-600 text-sm mb-4 line-clamp-2">
        {project.description}
      </p>

      {!canStart && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-100 rounded-md">
          <p className="text-sm text-yellow-800 font-medium mb-1">
            Waiting for:
          </p>
          <ul className="text-sm text-yellow-700 list-disc list-inside">
            {unfinishedDeps.map(depId => {
              const dep = allProjects.find(p => p.id === depId);
              return <li key={depId}>{dep?.name}</li>;
            })}
          </ul>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div className="flex -space-x-2">
          {project.members?.slice(0, 3).map((memberId, idx) => (
            <div
              key={idx}
              className="w-8 h-8 rounded-full bg-primary-100 border-2 border-white flex items-center justify-center"
            >
              <span className="text-xs font-medium text-primary-700">
                {(members[memberId]?.name || members[memberId] || memberId)
                  .split(' ')
                  .map(n => n[0])
                  .join('')
                  .toUpperCase()
                }
              </span>
            </div>
          ))}
          {(project.members?.length || 0) > 3 && (
            <div className="w-8 h-8 rounded-full bg-secondary-100 border-2 border-white flex items-center justify-center">
              <span className="text-xs font-medium text-secondary-700">
                +{project.members.length - 3}
              </span>
            </div>
          )}
        </div>
        <span className="text-xs text-secondary-500">
          {new Date(project.updatedAt?.seconds * 1000).toLocaleDateString()}
        </span>
      </div>
    </Link>
  );
}