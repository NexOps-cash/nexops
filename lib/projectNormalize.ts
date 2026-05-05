import type { Project, ProjectFile } from '../types';

/**
 * Workbench UI expects at least one `*.cash` in `project.files`. Rows from DB or the
 * registry often only populate `contractCode` with `files: []` — normalize here.
 */
export function ensureContractCodeAsCashFile(project: Project): Project {
  const code = typeof project.contractCode === 'string' ? project.contractCode.trim() : '';
  if (!code) return project;
  if (project.files.some((f) => f.name.endsWith('.cash'))) return project;

  const stem =
    (project.name || 'contract')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'contract';
  let fileName = `${stem}.cash`;
  if (project.files.some((f) => f.name === fileName)) {
    fileName = `contract-${project.id.slice(0, 8)}.cash`;
  }

  const cashFile: ProjectFile = {
    name: fileName,
    content: code,
    language: 'cashscript',
  };

  return { ...project, files: [cashFile, ...project.files] };
}
