// frontend/src/components/PropertiesPanel.tsx
import { DockerNode } from '../types/docker-topology';
import { X, Plus, Trash2 } from 'lucide-react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { useEffect, useState } from 'react';

interface PropertiesPanelProps {
  node: DockerNode | null;
  onClose: () => void;
  onUpdate: (node: DockerNode) => void;
}

export function PropertiesPanel({ node, onClose, onUpdate }: PropertiesPanelProps) {
  // Local state to buffer inputs and ensure responsiveness
  const [localData, setLocalData] = useState<DockerNode['data'] | null>(null);

  // Sync local state when the selected node changes
  useEffect(() => {
    if (node) {
      setLocalData(node.data);
    } else {
      setLocalData(null);
    }
  }, [node?.id, node?.data]); // Sync on ID change or external data update

  if (!node || !localData) return null;

  const pushUpdate = (newData: DockerNode['data']) => {
    setLocalData(newData); // Update local UI immediately
    onUpdate({
      ...node,
      data: newData
    });
  };

  const updateField = (field: keyof DockerNode['data'], value: any) => {
    const newData = { ...localData, [field]: value };
    pushUpdate(newData);
  };

  const addPort = () => {
    updateField('ports', [...localData.ports, '']);
  };

  const updatePort = (index: number, value: string) => {
    const newPorts = [...localData.ports];
    newPorts[index] = value;
    updateField('ports', newPorts);
  };

  const removePort = (index: number) => {
    updateField('ports', localData.ports.filter((_, i) => i !== index));
  };



  const addEnvVar = () => {
    updateField('envVars', [...localData.envVars, { key: '', value: '' }]);
  };

  const updateEnvVar = (index: number, field: 'key' | 'value', value: string) => {
    const newEnvVars = [...localData.envVars];
    newEnvVars[index] = { ...newEnvVars[index], [field]: value };
    updateField('envVars', newEnvVars);
  };

  const removeEnvVar = (index: number) => {
    updateField('envVars', localData.envVars.filter((_, i) => i !== index));
  };

  const addVolume = () => {
    updateField('volumes', [...localData.volumes, '']);
  };

  const updateVolume = (index: number, value: string) => {
    const newVolumes = [...localData.volumes];
    newVolumes[index] = value;
    updateField('volumes', newVolumes);
  };

  const removeVolume = (index: number) => {
    updateField('volumes', localData.volumes.filter((_, i) => i !== index));
  };

  return (
    <div className="w-80 bg-[#F2F2F2] border-l border-[#E5E5E5] flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-[#E5E5E5] flex items-center justify-between">
        <h2 className="text-[#222222]">Propiedades del Nodo</h2>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-[#E0E0E0] text-[#6B7280] hover:text-[#222222] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-2">
          <Label className="text-[#222222]">Nombre del nodo</Label>
          <Input
            value={localData.name}
            onChange={(e) => updateField('name', e.target.value)}
            className="bg-white border-[#D1D5DB] text-[#222222]"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-[#222222]">Nombre del Contenedor (Host)</Label>
          <Input
            value={localData.containerName || ''}
            onChange={(e) => updateField('containerName', e.target.value)}
            placeholder="ej: kali_attacker"
            className="bg-white border-[#D1D5DB] text-[#222222]"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-[#222222]">Imagen Docker</Label>
          <Input
            value={localData.dockerImage}
            onChange={(e) => updateField('dockerImage', e.target.value)}
            className="bg-white border-[#D1D5DB] text-[#222222]"
          />
        </div>

        <div className="space-y-3 pt-2 pb-2 border-t border-b border-[#E5E5E5]">
          <Label className="text-[#222222] font-medium">Configuración Avanzada / Ejecución</Label>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="tty-mode"
              checked={!!localData.tty}
              onCheckedChange={(checked: boolean | 'indeterminate') => updateField('tty', checked === true)}
            />
            <Label htmlFor="tty-mode" className="text-[#222222] cursor-pointer">
              Pseudo-TTY (-t)
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="stdin-mode"
              checked={!!localData.stdinOpen}
              onCheckedChange={(checked: boolean | 'indeterminate') => updateField('stdinOpen', checked === true)}
            />
            <Label htmlFor="stdin-mode" className="text-[#222222] cursor-pointer">
              Interactivo / Mantener Vivo (-i)
            </Label>
          </div>

          <div className="flex items-center space-x-2 pb-4 border-b border-[#E5E5E5]">
            <Checkbox
              id="privileged-mode"
              checked={!!localData.privileged}
              onCheckedChange={(checked: boolean | 'indeterminate') => updateField('privileged', checked === true)}
            />
            <Label htmlFor="privileged-mode" className="text-[#222222] cursor-pointer text-red-600 font-medium">
              Modo Privilegiado (DANGER)
            </Label>
          </div>

          <div className="space-y-2 pt-4">
            <Label className="text-[#222222]">Comando de Inicio (Opcional)</Label>
            <Input
              value={localData.command || ''}
              onChange={(e) => updateField('command', e.target.value)}
              placeholder='ej: sh -c "/bin/services.sh && bash"'
              className="bg-white border-[#D1D5DB] text-[#222222] font-mono text-xs"
            />
            <p className="text-[10px] text-gray-500">Sobrescribe el CMD por defecto de la imagen.</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[#222222]">Puertos expuestos</Label>
            <button
              onClick={addPort}
              className="p-1 rounded hover:bg-[#E0E0E0] text-blue-600 hover:text-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {localData.ports.map((port, idx) => (
              <div key={idx} className="flex gap-2">
                <Input
                  value={port}
                  onChange={(e) => updatePort(idx, e.target.value)}
                  placeholder="8080:80"
                  className="bg-white border-[#D1D5DB] text-[#222222] flex-1"
                />
                <button
                  onClick={() => removePort(idx)}
                  className="p-2 rounded hover:bg-[#E0E0E0] text-red-600 hover:text-red-700 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>



        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[#222222]">Variables de entorno</Label>
            <button
              onClick={addEnvVar}
              className="p-1 rounded hover:bg-[#E0E0E0] text-blue-600 hover:text-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {localData.envVars.map((envVar, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex gap-2">
                  <Input
                    value={envVar.key}
                    onChange={(e) => updateEnvVar(idx, 'key', e.target.value)}
                    placeholder="KEY"
                    className="bg-white border-[#D1D5DB] text-[#222222] flex-1"
                  />
                  <button
                    onClick={() => removeEnvVar(idx)}
                    className="p-2 rounded hover:bg-[#E0E0E0] text-red-600 hover:text-red-700 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <Input
                  value={envVar.value}
                  onChange={(e) => updateEnvVar(idx, 'value', e.target.value)}
                  placeholder="value"
                  className="bg-white border-[#D1D5DB] text-[#222222] w-full"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[#222222]">Volúmenes</Label>
            <button
              onClick={addVolume}
              className="p-1 rounded hover:bg-[#E0E0E0] text-blue-600 hover:text-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {localData.volumes.map((volume, idx) => (
              <div key={idx} className="flex gap-2">
                <Input
                  value={volume}
                  onChange={(e) => updateVolume(idx, e.target.value)}
                  placeholder="/host/path:/container/path"
                  className="bg-white border-[#D1D5DB] text-[#222222] flex-1"
                />
                <button
                  onClick={() => removeVolume(idx)}
                  className="p-2 rounded hover:bg-[#E0E0E0] text-red-600 hover:text-red-700 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}