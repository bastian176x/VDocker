import { useState } from 'react';
import { Play, Save, Upload, Square, FileText } from 'lucide-react';
import { NodePalette } from './components/NodePalette';
import { Toolbar } from './components/Toolbar';
import { Canvas } from './components/Canvas';
import { PropertiesPanel } from './components/PropertiesPanel';
import { DockerNode, Connection, ToolMode, NodeType } from './types/docker-topology';
import { toast } from 'sonner';
import { Toaster } from './components/ui/sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './components/ui/dialog';
import { Button } from './components/ui/button';

function App() {
  const [nodes, setNodes] = useState<DockerNode[]>([
    {
      id: 'node-1',
      type: 'linux-server',
      position: { x: 200, y: 150 },
      data: {
        name: 'ubuntu-server',
        dockerImage: 'ubuntu:latest',
        ports: ['22:22', '80:80'],
        networks: ['backend'],
        envVars: [{ key: 'ENV', value: 'production' }],
        volumes: ['/data:/var/data']
      }
    },
    {
      id: 'node-2',
      type: 'router',
      position: { x: 500, y: 150 },
      data: {
        name: 'main-router',
        dockerImage: 'alpine:latest',
        ports: ['8080:80'],
        networks: ['backend', 'frontend'],
        envVars: [],
        volumes: []
      }
    },
    {
      id: 'node-3',
      type: 'database',
      position: { x: 350, y: 350 },
      data: {
        name: 'postgres-db',
        dockerImage: 'postgres:15',
        ports: ['5432:5432'],
        networks: ['backend'],
        envVars: [
          { key: 'POSTGRES_PASSWORD', value: 'secret' },
          { key: 'POSTGRES_USER', value: 'admin' }
        ],
        volumes: ['/db-data:/var/lib/postgresql/data']
      }
    }
  ]);

  const [connections, setConnections] = useState<Connection[]>([
    { id: 'conn-1', source: 'node-1', target: 'node-2', sourcePort: 'right', targetPort: 'left' },
    { id: 'conn-2', source: 'node-2', target: 'node-3', sourcePort: 'bottom', targetPort: 'top' }
  ]);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [propertiesPanelNodeId, setPropertiesPanelNodeId] = useState<string | null>(null);
  const [mode, setMode] = useState<ToolMode>('select');
  const [zoom, setZoom] = useState(1);
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [systemStatus, setSystemStatus] = useState<'ready' | 'running' | 'stopped'>('ready');

  const selectedNode = nodes.find(n => n.id === propertiesPanelNodeId) || null;

  const handleNodeAdd = (node: DockerNode) => {
    setNodes([...nodes, node]);
  };

  const handleNodeMove = (nodeId: string, position: { x: number; y: number }) => {
    setNodes(nodes.map(node => 
      node.id === nodeId ? { ...node, position } : node
    ));
  };

  const handleNodeDelete = (nodeId: string) => {
    setNodes(nodes.filter(n => n.id !== nodeId));
    setConnections(connections.filter(c => c.source !== nodeId && c.target !== nodeId));
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
    if (propertiesPanelNodeId === nodeId) {
      setPropertiesPanelNodeId(null);
    }
    toast.success('Nodo eliminado');
  };

  const handleShowProperties = (nodeId: string) => {
    setPropertiesPanelNodeId(nodeId);
  };

  const handleConnectionAdd = (connection: Connection) => {
    setConnections([...connections, connection]);
    toast.success('Conexión creada');
  };

  const handleConnectionDelete = (connectionId: string) => {
    setConnections(connections.filter(c => c.id !== connectionId));
    toast.success('Conexión eliminada');
  };

  const handleNodeUpdate = (updatedNode: DockerNode) => {
    setNodes(nodes.map(node => 
      node.id === updatedNode.id ? updatedNode : node
    ));
  };

  const handleExecute = () => {
    setSystemStatus('running');
    setIsRunning(true);
    toast.success('Ejecutando topología...', {
      description: `${nodes.length} contenedores iniciándose`
    });
    
    // Simular la ejecución
    setTimeout(() => {
      toast.success('Topología ejecutada correctamente', {
        description: 'Todos los contenedores están en ejecución'
      });
    }, 2000);
  };

  const handleStop = () => {
    setIsRunning(false);
    setSystemStatus('stopped');
    toast.info('Sistema detenido', {
      description: 'Todos los contenedores han sido detenidos'
    });
  };

  const handleSave = () => {
    toast.success('✔ Topología guardada correctamente');
  };

  const handleImport = () => {
    setShowImportModal(true);
  };

  const handleImportFile = () => {
    setShowImportModal(false);
    toast.success('✔ Archivo importado con éxito');
  };

  return (
    <div className="h-screen flex flex-col bg-[#FAFAFA]">
      <Toaster theme="light" />
      
      {/* Header */}
      <div className="h-14 bg-white border-b border-[#E5E5E5] flex items-center justify-between px-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white">🐳</span>
          </div>
          <h1 className="text-[#222222]">Docker Topology Editor</h1>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Botón Guardar */}
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-[#6B7280] hover:bg-[#4B5563] text-white rounded-lg transition-colors"
            title="Guardar topología"
          >
            <Save className="w-4 h-4" />
            <span>Guardar</span>
          </button>

          {/* Botón Importar */}
          <button
            onClick={handleImport}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-[#222222] rounded-lg transition-colors border border-[#D1D5DB]"
            title="Importar archivo"
          >
            <Upload className="w-4 h-4" />
            <span>Importar</span>
          </button>

          {/* Botón PLAY / Ejecutar */}
          <button
            onClick={handleExecute}
            disabled={isRunning}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4" />
            <span>PLAY / Ejecutar</span>
          </button>

          {/* Botón Detener */}
          <button
            onClick={handleStop}
            disabled={!isRunning}
            className="flex items-center gap-2 px-6 py-2 bg-[#EF4444] hover:bg-[#DC2626] text-white rounded-lg transition-colors shadow-lg shadow-red-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Square className="w-4 h-4" />
            <span>Detener</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Node Palette */}
        <NodePalette onNodeDragStart={() => setIsDraggingNode(true)} />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <Toolbar
            mode={mode}
            onModeChange={setMode}
            onZoomIn={() => {}}
            onZoomOut={() => {}}
            onResetView={() => {}}
          />

          {/* Canvas */}
          <Canvas
            nodes={nodes}
            connections={connections}
            selectedNodeId={selectedNodeId}
            onNodeSelect={setSelectedNodeId}
            onNodeAdd={handleNodeAdd}
            onNodeMove={handleNodeMove}
            onNodeDelete={handleNodeDelete}
            onConnectionAdd={handleConnectionAdd}
            onConnectionDelete={handleConnectionDelete}
            onShowProperties={handleShowProperties}
            mode={mode}
            zoom={zoom}
            onZoomChange={setZoom}
          />
        </div>

        {/* Right Panel - Properties */}
        {selectedNode && (
          <PropertiesPanel
            node={selectedNode}
            onClose={() => setPropertiesPanelNodeId(null)}
            onUpdate={handleNodeUpdate}
          />
        )}
      </div>

      {/* Status Bar */}
      <div className="h-8 bg-white border-t border-[#E5E5E5] flex items-center justify-between px-4 text-xs text-[#6B7280] shadow-sm">
        <div className="flex items-center gap-4">
          <span>Nodos: {nodes.length}</span>
          <span>Conexiones: {connections.length}</span>
          <span>Modo: {mode === 'select' ? 'Seleccionar' : mode === 'connect' ? 'Conectar' : 'Borrar'}</span>
          <span className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${
              systemStatus === 'running' ? 'bg-green-500 animate-pulse' : 
              systemStatus === 'stopped' ? 'bg-red-500' : 
              'bg-blue-500'
            }`} />
            <span className={systemStatus === 'running' ? 'text-green-600' : systemStatus === 'stopped' ? 'text-red-600' : 'text-blue-600'}>
              {systemStatus === 'running' ? 'Ejecutando...' : systemStatus === 'stopped' ? 'Sistema detenido' : 'Listo para ejecutar'}
            </span>
          </span>
        </div>
        <div>
          Zoom: {(zoom * 100).toFixed(0)}%
        </div>
      </div>

      {/* Modal de Importar */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="bg-white border-[#E5E5E5] text-[#222222]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#222222]">
              <FileText className="w-5 h-5 text-blue-600" />
              Importar archivo docker-compose.yml
            </DialogTitle>
            <DialogDescription className="text-[#6B7280]">
              Selecciona un archivo docker-compose.yml para importar la topología de contenedores a tu editor.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-[#D1D5DB] rounded-lg bg-[#F9FAFB]">
            <FileText className="w-16 h-16 text-blue-600 mb-4" />
            <p className="text-[#6B7280] mb-2">Arrastra tu archivo aquí o haz clic para seleccionar</p>
            <p className="text-xs text-[#9CA3AF]">Archivos soportados: .yml, .yaml</p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowImportModal(false)}
              className="bg-white border-[#D1D5DB] text-[#222222] hover:bg-gray-50 hover:text-[#222222]"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleImportFile}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Seleccionar archivo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default App;