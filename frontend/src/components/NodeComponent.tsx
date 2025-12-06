import { useState } from 'react';
import { Server, Router, Shield, Database, Globe, User, Bug, MoreVertical, FileText, Trash2 } from 'lucide-react';
import { DockerNode, NodeType, PortPosition } from '../types/docker-topology';

const nodeIcons: Record<NodeType, React.ReactNode> = {
  'linux-server': <Server className="w-6 h-6" />,
  'router': <Router className="w-6 h-6" />,
  'firewall': <Shield className="w-6 h-6" />,
  'database': <Database className="w-6 h-6" />,
  'web-server': <Globe className="w-6 h-6" />,
  'client': <User className="w-6 h-6" />,
  'vulnerable-service': <Bug className="w-6 h-6" />
};

interface NodeComponentProps {
  node: DockerNode;
  isSelected: boolean;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onConnectionStart?: (nodeId: string, port: PortPosition) => void;
  onShowProperties?: () => void;
  onDelete?: () => void;
  zoom: number;
}

export function NodeComponent({ 
  node, 
  isSelected, 
  onClick, 
  onDragStart,
  onConnectionStart,
  onShowProperties,
  onDelete,
  zoom 
}: NodeComponentProps) {
  const [showMenu, setShowMenu] = useState(false);

  const handlePortMouseDown = (e: React.MouseEvent, port: PortPosition) => {
    e.stopPropagation();
    if (onConnectionStart) {
      onConnectionStart(node.id, port);
    }
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  const handleShowProperties = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    if (onShowProperties) {
      onShowProperties();
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    if (onDelete) {
      onDelete();
    }
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      style={{
        position: 'absolute',
        left: node.position.x * zoom,
        top: node.position.y * zoom,
        width: 120 * zoom,
        minHeight: 100 * zoom,
        boxShadow: isSelected ? '0 10px 40px rgba(59, 130, 246, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.06)'
      }}
      className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all cursor-move backdrop-blur-sm ${
        isSelected
          ? 'bg-white border-blue-500 shadow-xl shadow-blue-500/30'
          : 'bg-white border-[#C7C7C7] hover:border-[#9CA3AF] hover:shadow-lg'
      }`}
    >
      {/* Puntos de anclaje en los bordes cuando está seleccionado */}
      {isSelected && (
        <>
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full border-2 border-white shadow-lg shadow-blue-500/50 animate-pulse" />
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full border-2 border-white shadow-lg shadow-blue-500/50 animate-pulse" />
          <div className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-3 h-3 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full border-2 border-white shadow-lg shadow-blue-500/50 animate-pulse" />
          <div className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-3 h-3 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full border-2 border-white shadow-lg shadow-blue-500/50 animate-pulse" />
        </>
      )}

      {/* Puertos de conexión - siempre visibles */}
      <div
        onMouseDown={(e) => handlePortMouseDown(e, 'top')}
        className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-[#3b82f6] rounded-full border border-white cursor-crosshair hover:scale-150 hover:shadow-lg hover:shadow-blue-500/50 transition-all z-10"
        title="Puerto superior"
      />
      <div
        onMouseDown={(e) => handlePortMouseDown(e, 'bottom')}
        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-[#3b82f6] rounded-full border border-white cursor-crosshair hover:scale-150 hover:shadow-lg hover:shadow-blue-500/50 transition-all z-10"
        title="Puerto inferior"
      />
      <div
        onMouseDown={(e) => handlePortMouseDown(e, 'left')}
        className="absolute top-1/2 -translate-y-1/2 -left-1 w-2.5 h-2.5 bg-[#3b82f6] rounded-full border border-white cursor-crosshair hover:scale-150 hover:shadow-lg hover:shadow-blue-500/50 transition-all z-10"
        title="Puerto izquierdo"
      />
      <div
        onMouseDown={(e) => handlePortMouseDown(e, 'right')}
        className="absolute top-1/2 -translate-y-1/2 -right-1 w-2.5 h-2.5 bg-[#3b82f6] rounded-full border border-white cursor-crosshair hover:scale-150 hover:shadow-lg hover:shadow-blue-500/50 transition-all z-10"
        title="Puerto derecho"
      />

      <div className="relative">
        <div className="text-blue-600 p-2.5 bg-[#F0F4FF] rounded-lg shadow-inner border border-[#E0E7FF]">
          {nodeIcons[node.type]}
        </div>
      </div>
      <div className="text-center px-1">
        <div className="text-[#222222] text-xs whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
          {node.data.name}
        </div>
        <div className="text-[#6B7280] text-[10px] whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
          {node.data.dockerImage}
        </div>
      </div>

      {/* Botón de menú contextual - siempre visible */}
      <button
        onClick={handleMenuClick}
        className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#00000020] hover:bg-[#00000030] flex items-center justify-center cursor-pointer transition-colors z-30"
        title="Opciones del nodo"
      >
        <MoreVertical className="w-3 h-3 text-[#222222]" />
      </button>

      {/* Menú contextual flotante */}
      {showMenu && (
        <div className="absolute top-9 right-2 bg-white border border-[#E5E5E5] rounded-lg shadow-xl z-40 overflow-hidden min-w-[140px]">
          <button
            onClick={handleShowProperties}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#222222] hover:bg-gray-50 transition-colors text-left"
          >
            <FileText className="w-3.5 h-3.5" />
            Ver propiedades
          </button>
          <button
            onClick={handleDelete}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-gray-50 transition-colors text-left"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Eliminar nodo
          </button>
        </div>
      )}
    </div>
  );
}