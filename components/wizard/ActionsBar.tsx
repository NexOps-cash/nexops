import React from 'react';
import { Button } from '../UI';
import { Copy, Download, FlaskConical, Link2, FolderOpen } from 'lucide-react';

interface ActionsBarProps {
  disabled: boolean;
  onCopy: () => void;
  onDownload: () => void;
  onShare: () => void;
  onCompile: () => void;
  onOpenWorkspace: () => void;
}

export const ActionsBar: React.FC<ActionsBarProps> = ({
  disabled,
  onCopy,
  onDownload,
  onShare,
  onCompile,
  onOpenWorkspace,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="glass" disabled={disabled} onClick={onCopy} icon={<Copy size={14} />}>
        Copy
      </Button>
      <Button size="sm" variant="glass" disabled={disabled} onClick={onDownload} icon={<Download size={14} />}>
        Download
      </Button>
      <Button size="sm" variant="glass" disabled={disabled} onClick={onShare} icon={<Link2 size={14} />}>
        Share
      </Button>
      <Button size="sm" variant="secondary" disabled={disabled} onClick={onCompile} icon={<FlaskConical size={14} />}>
        Compile
      </Button>
      <Button size="sm" variant="primary" disabled={disabled} onClick={onOpenWorkspace} icon={<FolderOpen size={14} />}>
        Open In Workspace
      </Button>
    </div>
  );
};
