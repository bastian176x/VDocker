import { DockerNode } from '../types/docker-topology';
import { X, Plus, Trash2 } from 'lucide-react';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface PropertiesPanelProps {
  node: DockerNode | null;
  onClose: () => void;
  onUpdate: (node: DockerNode) => void;
}

export function PropertiesPanel({ node, onClose, onUpdate }: PropertiesPanelProps) {
  if (!node) return null;

  const updateField = (field: keyof DockerNode['data'], value: any) => {
    onUpdate({
      ...node,
      data: {
        ...node.data,
        [field]: value
      }
    });
  };

  const addPort = () => {
    updateField('ports', [...node.data.ports, '']);
  };

  const updatePort = (index: number, value: string) => {
    const newPorts = [...node.data.ports];
    newPorts[index] = value;
    updateField('ports', newPorts);
  };

  const removePort = (index: number) => {
    updateField('ports', node.data.ports.filter((_, i) => i !== index));
  };

  const addNetwork = () => {
    updateField('networks', [...node.data.networks, '']);
  };

  const updateNetwork = (index: number, value: string) => {
    const newNetworks = [...node.data.networks];
    newNetworks[index] = value;
    updateField('networks', newNetworks);
  };

  const removeNetwork = (index: number) => {
    updateField('networks', node.data.networks.filter((_, i) => i !== index));
  };

  const addEnvVar = () => {
    updateField('envVars', [...node.data.envVars, { key: '', value: '' }]);
  };

  const updateEnvVar = (index: number, field: 'key' | 'value', value: string) => {
    const newEnvVars = [...node.data.envVars];
    newEnvVars[index] = { ...newEnvVars[index], [field]: value };
    updateField('envVars', newEnvVars);
  };

  const removeEnvVar = (index: number) => {
    updateField('envVars', node.data.envVars.filter((_, i) => i !== index));
  };

  const addVolume = () => {
    updateField('volumes', [...node.data.volumes, '']);
  };

  const updateVolume = (index: number, value: string) => {
    const newVolumes = [...node.data.volumes];
    newVolumes[index] = value;
    updateField('volumes', newVolumes);
  };

  const removeVolume = (index: number) => {
    updateField('volumes', node.data.volumes.filter((_, i) => i !== index));
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
            value={node.data.name}
            onChange={(e) => updateField('name', e.target.value)}
            className="bg-white border-[#D1D5DB] text-[#222222]"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-[#222222]">Imagen Docker</Label>
          <Input
            value={node.data.dockerImage}
            onChange={(e) => updateField('dockerImage', e.target.value)}
            className="bg-white border-[#D1D5DB] text-[#222222]"
          />
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
            {node.data.ports.map((port, idx) => (
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
            <Label className="text-[#222222]">Redes</Label>
            <button
              onClick={addNetwork}
              className="p-1 rounded hover:bg-[#E0E0E0] text-blue-600 hover:text-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {node.data.networks.map((network, idx) => (
              <div key={idx} className="flex gap-2">
                <Input
                  value={network}
                  onChange={(e) => updateNetwork(idx, e.target.value)}
                  placeholder="network-name"
                  className="bg-white border-[#D1D5DB] text-[#222222] flex-1"
                />
                <button
                  onClick={() => removeNetwork(idx)}
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
            {node.data.envVars.map((envVar, idx) => (
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
            {node.data.volumes.map((volume, idx) => (
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