import { Server, Router, Shield, Database, Globe, User, Bug } from 'lucide-react';
import { NodeType } from '../types/docker-topology';

interface NodeCategory {
  title: string;
  items: {
    type: NodeType;
    label: string;
    icon: React.ReactNode;
  }[];
}

const categories: NodeCategory[] = [
  {
    title: 'Servidores Linux',
    items: [
      { type: 'linux-server', label: 'Linux Server', icon: <Server className="w-5 h-5" /> }
    ]
  },
  {
    title: 'Bases de Datos',
    items: [
      { type: 'database', label: 'Database', icon: <Database className="w-5 h-5" /> }
    ]
  },
  {
    title: 'Web Servers',
    items: [
      { type: 'web-server', label: 'Web Server', icon: <Globe className="w-5 h-5" /> }
    ]
  },
  {
    title: 'Clientes',
    items: [
      { type: 'client', label: 'Client', icon: <User className="w-5 h-5" /> }
    ]
  },
  {
    title: 'Servicios Vulnerables',
    items: [
      { type: 'vulnerable-service', label: 'Vulnerable Service', icon: <Bug className="w-5 h-5" /> }
    ]
  }
];

interface NodePaletteProps {
  onNodeDragStart: (type: NodeType) => void;
}

export function NodePalette({ onNodeDragStart }: NodePaletteProps) {
  return (
    <div className="w-64 bg-[#F2F2F2] border-r border-[#E5E5E5] flex flex-col h-full overflow-y-auto">
      <div className="p-4 border-b border-[#E5E5E5]">
        <h2 className="text-[#222222]">Componentes</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {categories.map((category, idx) => (
          <div key={idx} className="border-b border-[#E0E0E0] last:border-b-0">
            <div className="px-4 py-3 bg-[#E8E8E8]">
              <h3 className="text-[#6B7280] text-sm">{category.title}</h3>
            </div>
            <div className="p-2">
              {category.items.map((item) => (
                <div
                  key={item.type}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('nodeType', item.type);
                    onNodeDragStart(item.type);
                  }}
                  className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-[#E0E0E0] cursor-move transition-colors"
                >
                  <div className="text-blue-600">{item.icon}</div>
                  <span className="text-[#222222] text-sm">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}