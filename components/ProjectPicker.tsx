import React, { useState } from 'react';
import { Project } from '../types';
import { Folder, Plus, Clock, Trash2 } from 'lucide-react';
import { CreateProject } from '../pages/CreateProject';

interface ProjectPickerProps {
    projects: Project[];
    onSelectProject: (projectId: string) => void;
    onCreateProject: (project: Project) => void;
}

export const ProjectPicker: React.FC<ProjectPickerProps> = ({ projects, onSelectProject, onCreateProject }) => {
    const [showCreateForm, setShowCreateForm] = useState(false);

    if (showCreateForm) {
        return (
            <div className="h-full w-full bg-nexus-900 overflow-auto">
                <CreateProject
                    onNavigate={() => setShowCreateForm(false)}
                    onCreateProject={(project) => {
                        onCreateProject(project);
                        setShowCreateForm(false);
                    }}
                />
            </div>
        );
    }

    return (
        <div className="h-full w-full bg-nexus-900 flex items-center justify-center p-8">
            <div className="max-w-4xl w-full">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-black text-white tracking-tight mb-2">
                        Recent Projects
                    </h1>
                    <p className="text-slate-500 text-sm">
                        Select a project to open it in the workspace
                    </p>
                </div>

                {/* New Project Button */}
                <button
                    onClick={() => setShowCreateForm(true)}
                    className="w-full mb-6 p-6 bg-nexus-cyan/10 border-2 border-dashed border-nexus-cyan/30 rounded-xl hover:bg-nexus-cyan/20 hover:border-nexus-cyan/50 transition-all group"
                >
                    <div className="flex items-center justify-center space-x-3">
                        <Plus className="w-6 h-6 text-nexus-cyan group-hover:scale-110 transition-transform" />
                        <span className="text-lg font-bold text-nexus-cyan">
                            Create New Project
                        </span>
                    </div>
                </button>

                {/* Project List */}
                {projects.length === 0 ? (
                    <div className="text-center py-12">
                        <Folder className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                        <p className="text-slate-500 text-sm">
                            No projects yet. Create your first CashScript project!
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {projects.map((project) => (
                            <button
                                key={project.id}
                                onClick={() => onSelectProject(project.id)}
                                className="p-6 bg-nexus-800 border border-slate-700 rounded-xl hover:bg-slate-800 hover:border-nexus-cyan/30 transition-all text-left group"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-nexus-cyan to-nexus-purple flex items-center justify-center">
                                            <Folder className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-white group-hover:text-nexus-cyan transition-colors">
                                                {project.name}
                                            </h3>
                                            <p className="text-xs text-slate-500">
                                                {project.files.length} file{project.files.length !== 1 ? 's' : ''}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-sm text-slate-400 line-clamp-2 mb-3">
                                    {project.description || 'No description'}
                                </p>
                                <div className="flex items-center text-xs text-slate-500">
                                    <Clock className="w-3 h-3 mr-1" />
                                    {new Date(project.lastModified).toLocaleDateString()}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
