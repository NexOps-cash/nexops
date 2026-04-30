import React from 'react';
import { Button } from '../UI';
import { Copy, Download, FlaskConical, Link2, FolderOpen } from 'lucide-react';

interface ActionsBarProps {
  copyDisabled?: boolean;
  downloadDisabled?: boolean;
  shareDisabled?: boolean;
  compileDisabled?: boolean;
  openDisabled?: boolean;
  onCopy: () => void;
  onDownload: () => void;
  onShare: () => void;
  onCompile: () => void;
  onOpenWorkspace: () => void;
}

export const ActionsBar: React.FC<ActionsBarProps> = ({
  copyDisabled = false,
  downloadDisabled = false,
  shareDisabled = false,
  compileDisabled = false,
  openDisabled = false,
  onCopy,
  onDownload,
  onShare,
  onCompile,
  onOpenWorkspace,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="glass" disabled={copyDisabled} onClick={onCopy} icon={<Copy size={14} />}>
        Copy
      </Button>
      <Button size="sm" variant="glass" disabled={downloadDisabled} onClick={onDownload} icon={<Download size={14} />}>
        Download
      </Button>
      <Button size="sm" variant="glass" disabled={shareDisabled} onClick={onShare} icon={<Link2 size={14} />}>
        Share
      </Button>
      <Button size="sm" variant="secondary" disabled={compileDisabled} onClick={onCompile} icon={<FlaskConical size={14} />}>
        Compile
      </Button>
      <Button size="sm" variant="primary" disabled={openDisabled} onClick={onOpenWorkspace} icon={<FolderOpen size={14} />}>
        Open In Workspace
      </Button>
    </div>
  );
};
