import React from 'react';
import { Card, Button } from '../components/UI';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Activity, ShieldAlert, GitCommit, ArrowRight, FolderOpen } from 'lucide-react';
import { Project } from '../types';

interface DashboardProps {
  onNavigate: () => void;
  projects: Project[];
  onSelectProject: (id: string) => void;
}

const activityData = [
  { name: 'Mon', audits: 4, deploys: 2 },
  { name: 'Tue', audits: 3, deploys: 1 },
  { name: 'Wed', audits: 7, deploys: 3 },
  { name: 'Thu', audits: 2, deploys: 0 },
  { name: 'Fri', audits: 6, deploys: 4 },
  { name: 'Sat', audits: 1, deploys: 1 },
  { name: 'Sun', audits: 0, deploys: 0 },
];

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, projects, onSelectProject }) => {
  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Activity size={64} /></div>
          <h3 className="text-gray-400 text-sm font-medium uppercase">Active Projects</h3>
          <p className="text-3xl font-bold text-white mt-2">{projects.length}</p>
          <div className="mt-4 text-sm text-nexus-cyan flex items-center">
            <GitCommit size={14} className="mr-1" /> Ready to build
          </div>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><ShieldAlert size={64} /></div>
          <h3 className="text-gray-400 text-sm font-medium uppercase">Total Audits</h3>
          <p className="text-3xl font-bold text-white mt-2">12</p>
          <div className="mt-4 text-sm text-green-400 flex items-center">
            98.5% Security Score Avg
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-nexus-800 to-nexus-900 border-nexus-cyan/30">
          <h3 className="text-white text-lg font-medium">Quick Start</h3>
          <p className="text-gray-400 text-sm mt-2 mb-4">Launch a new smart contract development cycle.</p>
          <Button onClick={() => onNavigate()} className="w-full">
            New Project <ArrowRight size={16} className="ml-2" />
          </Button>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">

        {/* Recent Activity / Chart */}
        <Card className="lg:col-span-2 min-h-[400px]">
          <h3 className="text-lg font-medium text-white mb-6">Weekly Activity</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityData}>
                <XAxis dataKey="name" stroke="#4B5563" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#4B5563" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <Bar dataKey="audits" fill="#06B6D4" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="deploys" fill="#8B5CF6" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Recent Projects List */}
        <Card className="lg:col-span-1">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-white">Recent Builds</h3>
          </div>
          <div className="space-y-4">
            {projects.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No projects yet.</p>
            ) : (
              projects.map(project => (
                <div
                  key={project.id}
                  onClick={() => onSelectProject(project.id)}
                  className="p-3 rounded-lg bg-nexus-900/50 border border-nexus-700 hover:border-nexus-cyan/50 transition-colors cursor-pointer group"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-start space-x-3">
                      <FolderOpen className="w-5 h-5 text-gray-500 group-hover:text-nexus-cyan mt-0.5" />
                      <div>
                        <h4 className="text-white font-medium group-hover:text-nexus-cyan transition-colors">{project.name}</h4>
                        <p className="text-xs text-gray-500 mt-1">{project.chain.split(' ')[0]} • {new Date(project.lastModified).toLocaleDateString()}</p>
                      </div>
                    </div>
                    {project.auditReport && (
                      <span className={`text-xs font-mono px-2 py-0.5 rounded ${project.auditReport.score > 80 ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
                        }`}>
                        {project.auditReport.score}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
