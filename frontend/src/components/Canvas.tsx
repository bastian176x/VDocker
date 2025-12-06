import { useRef, useState } from 'react';
import { DockerNode, Connection, NodeType, PortPosition } from '../types/docker-topology';
import { NodeComponent } from './NodeComponent';
import { ZoomIn, ZoomOut } from 'lucide-react';

interface CanvasProps {
  nodes: DockerNode[];
  connections: Connection[];
  selectedNodeId: string | null;
  onNodeSelect: (nodeId: string) => void;
  onNodeAdd: (node: DockerNode) => void;
  onNodeMove: (nodeId: string, position: { x: number; y: number }) => void;
  onNodeDelete: (nodeId: string) => void;
  onConnectionAdd: (connection: Connection) => void;
  onConnectionDelete: (connectionId: string) => void;
  onShowProperties: (nodeId: string) => void;
  mode: 'select' | 'connect' | 'delete';
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

export function Canvas({
  nodes,
  connections,
  selectedNodeId,
  onNodeSelect,
  onNodeAdd,
  onNodeMove,
  onNodeDelete,
  onConnectionAdd,
  onConnectionDelete,
  onShowProperties,
  mode,
  zoom,
  onZoomChange
}: CanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connectingFrom, setConnectingFrom] = useState<{ nodeId: string; port: PortPosition } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData('nodeType') as NodeType;
    
    if (!nodeType || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - panOffset.x) / zoom;
    const y = (e.clientY - rect.top - panOffset.y) / zoom;

    const newNode: DockerNode = {
      id: `node-${Date.now()}`,
      type: nodeType,
      position: { x, y },
      data: {
        name: `${nodeType}-${nodes.length + 1}`,
        dockerImage: getDefaultImage(nodeType),
        ports: [],
        networks: ['default'],
        envVars: [],
        volumes: []
      }
    };

    onNodeAdd(newNode);
  };

  const handleNodeDragStart = (nodeId: string, e: React.DragEvent) => {
    if (mode !== 'select') {
      e.preventDefault();
      return;
    }
    
    const node = nodes.find(n => n.id === nodeId);
    if (!node || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    setDragOffset({
      x: (e.clientX - rect.left - panOffset.x) / zoom - node.position.x,
      y: (e.clientY - rect.top - panOffset.y) / zoom - node.position.y
    });
    setDraggingNodeId(nodeId);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Solo activar panning cuando se hace clic en el canvas o en el contenido (no en nodos)
    const target = e.target as HTMLElement;
    const isCanvasOrContent = target === canvasRef.current || target === contentRef.current || target.closest('[data-canvas-background]');
    
    if (e.button === 0 && !draggingNodeId && mode === 'select' && isCanvasOrContent) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (draggingNodeId && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - panOffset.x) / zoom - dragOffset.x;
      const y = (e.clientY - rect.top - panOffset.y) / zoom - dragOffset.y;
      onNodeMove(draggingNodeId, { x, y });
    } else if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  };

  const handleCanvasMouseUp = () => {
    setDraggingNodeId(null);
    setIsPanning(false);
  };

  const handleNodeClick = (nodeId: string) => {
    if (mode === 'delete') {
      onNodeDelete(nodeId);
    } else {
      onNodeSelect(nodeId);
    }
  };

  const handleConnectionStart = (nodeId: string, port: PortPosition) => {
    if (connectingFrom === null) {
      setConnectingFrom({ nodeId, port });
    } else if (connectingFrom.nodeId !== nodeId) {
      const newConnection: Connection = {
        id: `conn-${Date.now()}`,
        source: connectingFrom.nodeId,
        target: nodeId,
        sourcePort: connectingFrom.port,
        targetPort: port
      };
      onConnectionAdd(newConnection);
      setConnectingFrom(null);
    }
  };

  const handleConnectionClick = (connectionId: string, e: React.MouseEvent) => {
    if (mode === 'delete') {
      e.stopPropagation();
      onConnectionDelete(connectionId);
    }
  };

  // Calcular posición exacta de un puerto en un nodo
  const getPortPosition = (node: DockerNode, port: PortPosition) => {
    const nodeWidth = 120;
    const nodeHeight = 100;
    
    const baseCenterX = node.position.x + nodeWidth / 2;
    const baseCenterY = node.position.y + nodeHeight / 2;

    switch (port) {
      case 'top':
        return { x: baseCenterX, y: node.position.y };
      case 'bottom':
        return { x: baseCenterX, y: node.position.y + nodeHeight };
      case 'left':
        return { x: node.position.x, y: baseCenterY };
      case 'right':
        return { x: node.position.x + nodeWidth, y: baseCenterY };
      default:
        return { x: baseCenterX, y: baseCenterY };
    }
  };

  // Calcular puntos de anclaje usando puertos o auto-detectar
  const getNodeAnchorPoint = (source: DockerNode, target: DockerNode, sourcePort?: PortPosition, targetPort?: PortPosition) => {
    if (sourcePort && targetPort) {
      // Usar puertos específicos
      return {
        source: getPortPosition(source, sourcePort),
        target: getPortPosition(target, targetPort)
      };
    }

    // Auto-detectar el mejor puerto basado en la posición relativa
    const nodeWidth = 120;
    const nodeHeight = 100;
    
    const sourceCenterX = source.position.x + nodeWidth / 2;
    const sourceCenterY = source.position.y + nodeHeight / 2;
    const targetCenterX = target.position.x + nodeWidth / 2;
    const targetCenterY = target.position.y + nodeHeight / 2;

    const dx = targetCenterX - sourceCenterX;
    const dy = targetCenterY - sourceCenterY;
    const angle = Math.atan2(dy, dx);

    // Determinar puerto de salida
    let detectedSourcePort: PortPosition;
    if (Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle))) {
      detectedSourcePort = Math.cos(angle) > 0 ? 'right' : 'left';
    } else {
      detectedSourcePort = Math.sin(angle) > 0 ? 'bottom' : 'top';
    }

    // Determinar puerto de entrada (opuesto)
    let detectedTargetPort: PortPosition;
    const targetAngle = angle + Math.PI;
    if (Math.abs(Math.cos(targetAngle)) > Math.abs(Math.sin(targetAngle))) {
      detectedTargetPort = Math.cos(targetAngle) > 0 ? 'right' : 'left';
    } else {
      detectedTargetPort = Math.sin(targetAngle) > 0 ? 'bottom' : 'top';
    }

    return {
      source: getPortPosition(source, detectedSourcePort),
      target: getPortPosition(target, detectedTargetPort)
    };
  };

  // Crear path de curva bezier
  const createCurvePath = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const offset = Math.min(distance * 0.3, 100);

    // Puntos de control para curva suave
    const controlX1 = x1 + offset;
    const controlY1 = y1;
    const controlX2 = x2 - offset;
    const controlY2 = y2;

    return `M ${x1} ${y1} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${x2} ${y2}`;
  };

  return (
    <div
      ref={canvasRef}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      onMouseLeave={handleCanvasMouseUp}
      onClick={() => mode === 'select' && !isPanning && onNodeSelect('')}
      className="flex-1 relative bg-[#F7F7F9] overflow-hidden"
      style={{
        cursor: isPanning ? 'grabbing' : mode === 'select' ? 'default' : 'crosshair'
      }}
    >
      {/* Canvas Frame Principal */}
      <div
        ref={contentRef}
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
          transformOrigin: '0 0',
          position: 'absolute',
          width: '4000px',
          height: '4000px',
          left: 0,
          top: 0
        }}
      >
        {/* Grid de fondo */}
        <div
          data-canvas-background="true"
          className="absolute inset-0"
          style={{
            backgroundImage: `
              radial-gradient(circle, #D9D9D9 1px, transparent 1px)
            `,
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
            backgroundPosition: '0 0'
          }}
        />

        {/* Nodos */}
        {nodes.map((node) => (
          <NodeComponent
            key={node.id}
            node={node}
            isSelected={selectedNodeId === node.id}
            onClick={() => handleNodeClick(node.id)}
            onDragStart={(e) => handleNodeDragStart(node.id, e)}
            onConnectionStart={handleConnectionStart}
            onShowProperties={() => onShowProperties(node.id)}
            onDelete={() => onNodeDelete(node.id)}
            zoom={zoom}
          />
        ))}

        {/* SVG para las conexiones - encima de los nodos */}
        <svg 
          className="absolute inset-0 pointer-events-none" 
          style={{ 
            width: '4000px', 
            height: '4000px',
            overflow: 'visible',
            zIndex: 100
          }}
        >
          <defs>
            {/* Filtro de sombra suave para conexiones */}
            <filter id="connection-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {connections.map((conn) => {
            const source = nodes.find(n => n.id === conn.source);
            const target = nodes.find(n => n.id === conn.target);
            
            if (!source || !target) return null;
            
            const anchors = getNodeAnchorPoint(source, target, conn.sourcePort, conn.targetPort);
            const x1 = anchors.source.x * zoom;
            const y1 = anchors.source.y * zoom;
            const x2 = anchors.target.x * zoom;
            const y2 = anchors.target.y * zoom;
            
            const path = createCurvePath(x1, y1, x2, y2);
            const isDeleteMode = mode === 'delete';

            // Calcular punto medio para el círculo de control
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;

            return (
              <g 
                key={conn.id}
                className="pointer-events-auto cursor-pointer"
                onClick={(e) => handleConnectionClick(conn.id, e as any)}
              >
                {/* Path principal de la conexión */}
                <path
                  d={path}
                  stroke={isDeleteMode ? '#ef4444' : '#3B82F6'}
                  strokeWidth="2"
                  fill="none"
                  className="transition-colors"
                  filter="url(#connection-glow)"
                  opacity="1"
                  style={{ strokeOpacity: 1 }}
                />
                
                {/* Punto de control visible en el medio */}
                <circle
                  cx={midX}
                  cy={midY}
                  r="6"
                  fill={isDeleteMode ? '#ef4444' : '#3B82F6'}
                  stroke="#1a1a1a"
                  strokeWidth="2"
                  className="hover:scale-110 transition-transform"
                  style={{ cursor: 'pointer', fillOpacity: 1, strokeOpacity: 1 }}
                />
                
                {/* Puntos de anclaje en los extremos */}
                <circle
                  cx={x1}
                  cy={y1}
                  r="4"
                  fill="#3B82F6"
                  opacity="1"
                  style={{ fillOpacity: 1 }}
                />
                <circle
                  cx={x2}
                  cy={y2}
                  r="4"
                  fill="#3B82F6"
                  opacity="1"
                  style={{ fillOpacity: 1 }}
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Mensaje de conexión */}
      {connectingFrom && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          Selecciona un puerto de destino
        </div>
      )}

      {/* Controles de zoom en la esquina inferior derecha */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-50">
        <button
          onClick={() => onZoomChange(Math.min(zoom + 0.25, 2))}
          className="p-3 bg-white hover:bg-gray-50 text-[#222222] rounded-lg border border-[#D1D5DB] shadow-lg transition-colors"
          title="Zoom in"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <div className="px-3 py-2 bg-white text-[#222222] text-center rounded-lg border border-[#D1D5DB] text-sm shadow-sm">
          {(zoom * 100).toFixed(0)}%
        </div>
        <button
          onClick={() => onZoomChange(Math.max(zoom - 0.25, 0.5))}
          className="p-3 bg-white hover:bg-gray-50 text-[#222222] rounded-lg border border-[#D1D5DB] shadow-lg transition-colors"
          title="Zoom out"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function getDefaultImage(type: NodeType): string {
  const images: Record<NodeType, string> = {
    'linux-server': 'ubuntu:latest',
    'router': 'alpine:latest',
    'firewall': 'iptables:latest',
    'database': 'postgres:latest',
    'web-server': 'nginx:latest',
    'client': 'alpine:latest',
    'vulnerable-service': 'vulnerables/web-dvwa'
  };
  return images[type];
}