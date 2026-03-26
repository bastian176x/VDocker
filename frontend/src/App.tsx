// frontend/src/App.tsx
import { useState, useEffect } from 'react';
import { Play, Save, Upload, Square, Trash, Terminal, XCircle } from 'lucide-react';
import { NodePalette } from './components/NodePalette';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
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

  ]);

  const [connections, setConnections] = useState<Connection[]>([]);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [propertiesPanelNodeId, setPropertiesPanelNodeId] = useState<string | null>(null);
  const [mode, setMode] = useState<ToolMode>('select');
  const [zoom, setZoom] = useState(1);
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [showDockerError, setShowDockerError] = useState(false);
  const [systemStatus, setSystemStatus] = useState<'ready' | 'running' | 'stopped'>('ready');
  // Mapa de estados: NodeID -> { status: string, containerId: string }
  const [nodeStates, setNodeStates] = useState<Record<string, { status: string; containerId: string }>>({});
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [isStopping, setIsStopping] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [logs, setLogs] = useState<{ time: string, message: string, isContainerLog?: boolean }[]>([]);
  const [showLogs, setShowLogs] = useState(true);

  useEffect(() => {
    // @ts-ignore
    const removeProgressListener = window.electronAPI.onDockerProgress((event, data) => {
      setLoadingMessage(data.message);
      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('es-CL', { hour12: false }), message: data.message }].slice(-500));
    });

    // @ts-ignore
    const removeLogListener = window.electronAPI.onDockerLog((event, data) => {

      // Filtro mágico que detecta y borra los códigos ANSI de la terminal
      const cleanMessage = data.message.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');

      setLogs(prev => [...prev, {
        time: new Date().toLocaleTimeString('es-CL', { hour12: false }),
        message: cleanMessage,
        isContainerLog: true
      }].slice(-500));
    });

    return () => {
      if (removeProgressListener) removeProgressListener();
      if (removeLogListener) removeLogListener();
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
    // --- SEGURIDAD: Bloquear agregar nodos en ejecución ---
    if (isRunning) {
      toast.warning('No puedes agregar nodos mientras el laboratorio está corriendo.', {
        description: 'Detén el sistema primero.'
      });
      return;
    }
    // ----------------------------------------------------
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
      toast.warning('No puedes eliminar nodos mientras el laboratorio está corriendo.', {
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
      toast.warning('No puedes cortar cables mientras hay tráfico.', {
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
    if (isDeploying) return;
    setIsDeploying(true);
    try {
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
    } finally {
      setIsDeploying(false);
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

  const handleSave = async () => {
    // Construimos el objeto de guardado limpio (Sin rutas absolutas)
    const projectFile = {
      version: "1.0.0",
      metadata: {
        fechaCreacion: Date.now(),
        app: "Antigravity Editor",
        descripcion: "Laboratorio de Topología Docker"
      },
      configuracion: {
        zoom: zoom,
        pan: { x: 0, y: 0 } // Por ahora guardamos el origen
      },
      topologia: {
        nodes: nodes,
        connections: connections
      }
    };

    try {
      // @ts-ignore
      const response = await window.electronAPI.saveProject(projectFile);

      if (response.success) {
        toast.success('Proyecto guardado exitosamente', {
          description: `Ubicación: ${response.filePath}`
        });
      } else if (response.error) {
        toast.error('Error al guardar', { description: response.error });
      }
    } catch (error: any) {
      toast.error('Error inesperado', { description: error.message });
    }
  };

  const handleLoadProject = async () => {
    // 1. Seguridad: Preguntar si quiere perder cambios actuales
    if (nodes.length > 0 && !confirm('¿Deseas abrir otro proyecto? Se perderán los cambios no guardados del actual.')) {
      return;
    }

    // 2. Seguridad: No cargar mientras corre Docker
    if (isRunning) {
      toast.error('Debes detener el laboratorio antes de cargar uno nuevo.');
      return;
    }

    try {
      // @ts-ignore
      const response = await window.electronAPI.loadProject();

      if (response.success && response.data) {
        const fileData = response.data;

        // --- LÓGICA DE HIDRATACIÓN DEL ESTADO ---
        let loadedNodes: DockerNode[] = [];
        let loadedConnections: Connection[] = [];
        let loadedZoom = 1;

        // Soporte para estructura nueva (v1.0) y legacy
        if (fileData.topologia) {
          loadedNodes = fileData.topologia.nodes || [];
          loadedConnections = fileData.topologia.connections || [];
          loadedZoom = fileData.configuracion?.zoom || 1;
        } else if (fileData.nodes) {
          // Fallback para archivos viejos si los hubiera
          loadedNodes = fileData.nodes;
          loadedConnections = fileData.connections || [];
        } else {
          throw new Error('Formato de archivo no reconocido');
        }

        // Actualizar React State
        setNodes(loadedNodes);
        setConnections(loadedConnections);
        setZoom(loadedZoom);

        // Resetear estados de ejecución (limpiar "fantasmas" visuales)
        setNodeStates({});
        setSystemStatus('ready');
        setIsRunning(false);

        toast.success('Proyecto cargado correctamente');
      }
    } catch (error: any) {
      toast.error('Error al abrir proyecto', { description: error.message });
    }
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

    // 3. Ejecutar terminal nativa externa
    toast.info(`Abriendo terminal...`);

    // @ts-ignore
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
          <h1 className="text-[#222222]">VDocker</h1>
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

          {/* Botón Abrir */}
          <button
            onClick={handleLoadProject}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-[#222222] rounded-lg transition-colors border border-[#D1D5DB]"
            title="Abrir Proyecto"
          >
            <Upload className="w-4 h-4" />
            <span>Abrir</span>
          </button>

          {/* Botón PLAY / Ejecutar */}
          <button
            onClick={handleRun}
            disabled={isRunning || isDeploying}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4" />
            <span>PLAY</span>
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

        {/* Main Content con Paneles Redimensionables */}
        <PanelGroup direction="vertical" className="flex-1 flex flex-col overflow-hidden border-r border-[#E5E5E5]">

          {/* PANEL SUPERIOR (Canvas) */}
          <Panel defaultSize={75} minSize={30} className="flex flex-col relative">
            <Toolbar mode={mode} onModeChange={setMode} onZoomIn={() => { }} onZoomOut={() => { }} onResetView={() => { }} />
            <Canvas
              nodes={nodes} connections={connections} selectedNodeId={selectedNodeId}
              onNodeSelect={setSelectedNodeId} onNodeAdd={handleNodeAdd} onNodeMove={handleNodeMove}
              onNodeDelete={handleNodeDelete} onConnectionAdd={handleConnectionAdd} onConnectionDelete={handleConnectionDelete}
              onShowProperties={handleShowProperties} onNodeDoubleClick={handleNodeDoubleClick}
              nodeStates={nodeStates} mode={mode} zoom={zoom} onZoomChange={setZoom}
            />
          </Panel>

          {/* MANIJA PARA ARRASTRAR */}
          {showLogs && (
            <PanelResizeHandle className="h-1.5 bg-[#E5E5E5] hover:bg-[#3B82F6] transition-colors cursor-row-resize flex items-center justify-center">
              <div className="w-8 h-1 bg-gray-400 rounded-full" />
            </PanelResizeHandle>
          )}

          {/* PANEL INFERIOR (Consola de Logs) */}
          {showLogs && (
            <Panel defaultSize={25} minSize={15} className="bg-[#1E1E1E] flex flex-col z-10 shadow-inner">
              <div className="h-8 bg-[#2D2D2D] flex items-center justify-between px-4 border-b border-[#3D3D3D] shrink-0">
                <div className="flex items-center gap-2 text-gray-300 text-xs font-semibold uppercase tracking-wider">
                  <Terminal className="w-4 h-4" />
                  Salida de Docker
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setLogs([])} className="text-gray-400 hover:text-white transition-colors" title="Limpiar consola">
                    <Trash className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setShowLogs(false)} className="text-gray-400 hover:text-red-400 transition-colors" title="Cerrar panel">
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] text-[#A3BE8C] space-y-1">
                {logs.length === 0 ? (
                  <div className="text-gray-500 italic flex items-center justify-center h-full">Esperando eventos del motor Docker...</div>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="hover:bg-[#2D2D2D] px-1.5 py-0.5 rounded break-all">
                      <span className="text-[#88C0D0] mr-3 opacity-70">[{log.time}]</span>
                      <span className={
                        log.message.toLowerCase().includes('error') || log.message.toLowerCase().includes('fail')
                          ? 'text-[#BF616A] font-bold'
                          : log.isContainerLog
                            ? 'text-[#EBCB8B]' // Color amarillento/dorado para logs de contenedores
                            : 'text-[#A3BE8C]' // Verde para mensajes de sistema
                      }>
                        {log.message}
                      </span>
                    </div>
                  ))
                )}
                <div ref={(el) => { el?.scrollIntoView({ behavior: 'smooth' }) }} />
              </div>
            </Panel>
          )}
        </PanelGroup>

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
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowLogs(!showLogs)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${showLogs ? 'bg-gray-200 text-[#222222]' : 'hover:bg-gray-100 text-[#6B7280]'}`}
            title="Alternar Consola de Logs"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Consola</span>
          </button>
          <span>Zoom: {(zoom * 100).toFixed(0)}%</span>
        </div>
      </div>



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
              Por favor, <strong>abre la aplicación Docker Desktop</strong> y espera antes de intentar ejecutar el laboratorio.
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