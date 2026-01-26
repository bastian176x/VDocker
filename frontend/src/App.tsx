//App.tsx
import { useState, useEffect } from 'react';
import { Play, Save, Upload, Square, FileText, Trash } from 'lucide-react';
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
      id: 'node-kali',
      type: 'client',
      position: { x: 200, y: 200 },
      data: {
        name: 'kali-linux',
        containerName: 'kali_attacker',
        dockerImage: 'kalilinux/kali-rolling',
        tty: true,
        stdinOpen: true,
        ports: [],
        networks: ['lab-net'],
        envVars: [],
        volumes: []
      }
    },
    {
      id: 'node-metasploitable',
      type: 'vulnerable-service',
      position: { x: 500, y: 200 },
      data: {
        name: 'metasploitable-target',
        containerName: 'metasploitable_victim',
        dockerImage: 'tleemcjr/metasploitable2',
        tty: true,
        stdinOpen: true,
        ports: ['21:21', '22:22', '80:80'],
        networks: ['lab-net'],
        envVars: [],
        volumes: []
      }
    }
  ]);

  const [connections, setConnections] = useState<Connection[]>([]);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [propertiesPanelNodeId, setPropertiesPanelNodeId] = useState<string | null>(null);
  const [mode, setMode] = useState<ToolMode>('select');
  const [zoom, setZoom] = useState(1);
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDockerError, setShowDockerError] = useState(false);
  const [systemStatus, setSystemStatus] = useState<'ready' | 'running' | 'stopped'>('ready');
  // Mapa de estados: NodeID -> { status: string, containerId: string }
  const [nodeStates, setNodeStates] = useState<Record<string, { status: string; containerId: string }>>({});
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [isStopping, setIsStopping] = useState(false);

  useEffect(() => {
    // Escuchar progreso de Docker
    // @ts-ignore
    const removeListener = window.electronAPI.onDockerProgress((event, data) => {
      setLoadingMessage(data.message);
    });

    return () => {
      if (removeListener) removeListener(); // Limpieza si aplica, o ignorar
    };
  }, []);

  // Efecto de sincronización (Polling)
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (isRunning) {
      const fetchStatus = async () => {
        try {
          // @ts-ignore - Si TypeScript se queja del nuevo método
          const response = await window.electronAPI.getDockerStatus();

          if (response.success && response.containers) {
            const newMap: Record<string, { status: string; containerId: string }> = {};

            response.containers.forEach((c: any) => {
              newMap[c.nodeId] = {
                status: c.state, // 'running', 'exited', etc.
                containerId: c.containerId
              };
            });
            setNodeStates(newMap); // Actualizamos el mapa completo
          }
        } catch (error) {
          console.error("Error polling docker:", error);
        }
      };

      fetchStatus(); // Primera llamada inmediata
      intervalId = setInterval(fetchStatus, 2000); // Repetir cada 2s
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isRunning]);

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
    // --- SEGURIDAD: Bloquear eliminación en ejecución ---
    if (isRunning) {
      toast.warning('⛔ No puedes eliminar nodos mientras el laboratorio está corriendo.', {
        description: 'Detén el sistema (Stop) antes de modificar la topología.'
      });
      return;
    }
    // ----------------------------------------------------

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
    // 1. Verificar duplicados (Bidireccional)
    const exists = connections.some(c =>
      (c.source === connection.source && c.target === connection.target) ||
      (c.source === connection.target && c.target === connection.source)
    );

    if (exists) {
      toast.warning('Ya existe una conexión entre estos nodos.');
      return;
    }

    // 2. Si no existe, procedemos a crearla
    setConnections([...connections, connection]);
    toast.success('Conexión creada');
  };

  const handleConnectionDelete = (connectionId: string) => {
    // --- SEGURIDAD: Bloquear eliminación en ejecución ---
    if (isRunning) {
      toast.warning('⛔ No puedes cortar cables mientras hay tráfico.', {
        description: 'Detén el sistema primero.'
      });
      return;
    }
    // ----------------------------------------------------

    setConnections(connections.filter(c => c.id !== connectionId));
    toast.success('Conexión eliminada');
  };

  const handleNodeUpdate = (updatedNode: DockerNode) => {
    setNodes(nodes.map(node =>
      node.id === updatedNode.id ? updatedNode : node
    ));
  };

  const handleRun = async () => {
    // 1. Validar si hay nodos
    if (nodes.length === 0) {
      toast.error('No hay nodos para ejecutar');
      return;
    }

    // PASO CRÍTICO: Verificar si Docker vive ANTES de poner "Cargando..."
    // @ts-ignore
    const isDockerAlive = await window.electronAPI.checkDocker();

    if (!isDockerAlive) {
      setShowDockerError(true);
      toast.error('Docker no está corriendo');
      return; // <--- AQUÍ MORIMOS SI DOCKER NO ESTÁ
    }

    // Limpiamos estados anteriores para que empiecen en gris/cargando
    setNodeStates({});

    setSystemStatus('running');
    setIsRunning(true);
    setLoadingMessage('Configuración validada. Iniciando...');
    toast.info('Iniciando generación de Docker Compose...');

    try {
      // 2. Preparar topología
      const topology = {
        nodes,
        connections
      };

      // 3. Enviar al backend
      const response = await window.electronAPI.runDocker(topology);

      if (response && response.success) {
        toast.success('¡Éxito! Archivo generado', {
          description: response.message
        });
        console.log('Respuesta Backend:', response);
      } else {
        // Verificamos si el error es porque Docker está apagado (mensaje del backend)
        const errorMessage = response?.error || response?.message || '';

        if (errorMessage.includes('Docker Desktop') || errorMessage.includes('connect')) {
          setShowDockerError(true); // <--- ACTIVAMOS LA ALERTA PERSISTENTE
        } else {
          // Si es otro error (ej: sintaxis), usamos el toast normal
          throw new Error(errorMessage || 'Error desconocido');
        }

        setIsRunning(false);
        setSystemStatus('stopped');
      }

      setLoadingMessage(null);

    } catch (error: any) {
      console.error('Error al ejecutar:', error);
      toast.error('Error al generar configuración', {
        description: error.message
      });
      setIsRunning(false);
      setSystemStatus('stopped');
      setLoadingMessage(null);
    }
  };

  const handleStop = async () => {
    // 1. Mostrar Overlay
    setIsStopping(true);
    setLoadingMessage('Contactando con Docker...');
    toast.info('Deteniendo contenedores...');

    try {
      // 1. Llamar al backend
      const response = await window.electronAPI.stopDocker();

      if (response && response.success) {
        toast.success('Sistema detenido', {
          description: response.message
        });
        setIsRunning(false);
        setSystemStatus('stopped');

        // --- FIX: Forzar estado visual a "Detenido" ---
        // Como el polling se detiene, actualizamos manualmente la UI
        // para reflejar que todo se ha apagado.
        setNodeStates(prevStates => {
          const newStates = { ...prevStates };
          Object.keys(newStates).forEach(key => {
            // Mantenemos el containerId pero marcamos status como 'exited'
            if (newStates[key]) {
              newStates[key] = { ...newStates[key], status: 'exited' };
            }
          });
          return newStates;
        });
        // ----------------------------------------------
      } else {
        throw new Error(response?.message || 'Error al detener');
      }
    } catch (error: any) {
      console.error(error);
      toast.error('Error al detener', {
        description: error.message
      });
      // Aun si falla, podemos cambiar el estado visual si queremos,
      // pero mejor dejarlo activo para que el usuario reintente.
    } finally {
      // 2. Ocultar Overlay siempre
      setLoadingMessage(null);
      setIsStopping(false);
    }
  };

  const handlePrune = async () => {
    if (isRunning) {
      toast.error('Debes detener el laboratorio antes de limpiar el sistema.');
      return;
    }

    // Confirmación simple
    if (!confirm('¿Estás seguro? Esto borrará todas las imágenes descargadas y volúmenes antiguos para liberar espacio. La próxima vez que inicies un lab, tendrá que descargar las imágenes de nuevo.')) {
      return;
    }

    setLoadingMessage('Limpiando sistema Docker (esto puede tardar)...');
    try {
      // @ts-ignore
      const res = await window.electronAPI.pruneDocker();
      toast.success(res.message);
    } catch (e: any) {
      toast.error('Error limpiando: ' + e.message);
    } finally {
      setLoadingMessage(null);
    }
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

  const handleNodeDoubleClick = async (nodeId: string) => {
    // 1. Validaciones
    if (!isRunning) {
      toast.warning('El laboratorio debe estar corriendo (PLAY) para abrir la terminal.');
      return;
    }

    // 2. Buscar ID Real
    const state = nodeStates[nodeId];

    if (!state || !state.containerId) {
      toast.error('Contenedor no listo. ¿Está en verde?');
      return;
    }

    // 3. Ejecutar
    toast.info(`Abriendo terminal...`);
    await window.electronAPI.openTerminal(state.containerId);
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
            onClick={handleRun}
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

          <div className="w-px h-6 bg-[#E5E5E5] mx-2" />

          <button
            onClick={handlePrune}
            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Limpiar espacio en disco (Borrar imágenes y caché)"
          >
            <Trash className="w-5 h-5" />
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
            onZoomIn={() => { }}
            onZoomOut={() => { }}
            onResetView={() => { }}
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
            onNodeDoubleClick={handleNodeDoubleClick}
            nodeStates={nodeStates}
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
            <span className={`w-2 h-2 rounded-full ${systemStatus === 'running' ? 'bg-green-500 animate-pulse' :
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

      {/* Alerta de Docker Apagado */}
      <Dialog open={showDockerError} onOpenChange={setShowDockerError}>
        <DialogContent className="bg-white border-l-4 border-l-red-600 sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 text-xl">
              <span className="text-2xl">⚠️</span> Docker no está corriendo
            </DialogTitle>
            <DialogDescription className="text-gray-600 pt-2 text-base">
              No pudimos conectar con el motor de Docker.
              <br /><br />
              Por favor, <strong>abre la aplicación Docker Desktop</strong> y espera a que el icono de la ballena se ponga en verde antes de intentar ejecutar el laboratorio.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => setShowDockerError(false)}
              className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto"
            >
              Entendido, lo encenderé
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Overlay de Carga */}
      {loadingMessage && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl shadow-2xl max-w-md w-full border border-gray-100">
            <div className="flex flex-col items-center gap-4">
              {/* Spinner animado */}
              <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />

              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold text-gray-900">{isStopping ? 'Deteniendo laboratorio' : 'Preparando Laboratorio'}</h3>
                <p className="text-sm text-gray-500 font-mono animate-pulse">
                  {loadingMessage}
                </p>
              </div>

              {/* Barra decorativa */}
              <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 animate-progress w-full origin-left scale-x-50" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;