//docker-topology.ts
export type NodeType =
  | 'linux-server'
  | 'router'
  | 'firewall'
  | 'database'
  | 'web-server'
  | 'client'
  | 'vulnerable-service';

export interface DockerNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: {
    name: string;
    containerName?: string;
    dockerImage: string;
    command?: string;
    privileged?: boolean;
    tty?: boolean;
    stdinOpen?: boolean;
    ports: string[];
    networks: string[];
    envVars: { key: string; value: string }[];
    volumes: string[];
  };
}

export type PortPosition = 'top' | 'bottom' | 'left' | 'right';

export interface Connection {
  id: string;
  source: string;
  target: string;
  sourcePort?: PortPosition;
  targetPort?: PortPosition;
}

export type ToolMode = 'select' | 'connect' | 'delete';
