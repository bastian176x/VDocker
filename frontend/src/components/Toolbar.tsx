import { MousePointer, Trash2, Move } from 'lucide-react';
import { ToolMode } from '../types/docker-topology';

interface ToolbarProps {
  mode: ToolMode;
  onModeChange: (mode: ToolMode) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
}

export function Toolbar({ mode, onModeChange }: ToolbarProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-[#E5E5E5]">
      <div className="flex items-center gap-1">
        <button
          onClick={() => onModeChange('select')}
          className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
            mode === 'select'
              ? 'bg-blue-600 text-white'
              : 'text-[#6B7280] hover:bg-gray-100 hover:text-[#222222]'
          }`}
          title="Seleccionar y mover nodos"
        >
          <MousePointer className="w-4 h-4" />
          <span className="text-xs">Seleccionar</span>
        </button>
        <button
          onClick={() => onModeChange('delete')}
          className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
            mode === 'delete'
              ? 'bg-red-600 text-white'
              : 'text-[#6B7280] hover:bg-gray-100 hover:text-[#222222]'
          }`}
          title="Eliminar nodos y conexiones"
        >
          <Trash2 className="w-4 h-4" />
          <span className="text-xs">Borrar</span>
        </button>
      </div>
      
      <div className="flex-1" />
      
      <div className="flex items-center gap-2 text-xs text-[#6B7280]">
        <Move className="w-4 h-4" />
        <span>Arrastra el canvas para mover la vista • Arrastra desde los puertos para conectar</span>
      </div>
    </div>
  );
}