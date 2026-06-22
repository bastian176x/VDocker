// app/topology/generator.js
const yaml = require('js-yaml');

/**
 * Generates a Docker Compose v3.8 YAML string from an array of nodes.
 * @param {Array} nodes - Array of DockerNode objects.
 * @returns {string} - The generated YAML string.
 */
/**
 * Generates a Docker Compose v3.8 YAML string from nodes and connections.
 * @param {Array} nodes - Array of DockerNode objects.
 * @param {Array} connections - Array of Connection objects.
 * @returns {string} - The generated YAML string.
 */
function generateComposeYAML(nodes, connections = []) {
    const version = '3.8';
    const services = {};
    const networks = {};
    const usedHostPorts = new Set(); // SET para detectar colisiones
    const usedServiceNames = new Set(); // NUEVO: Para evitar sobrescritura de nodos
    const usedContainerNames = new Set(); // NUEVO: Para evitar conflictos en el host

    if (!nodes || !Array.isArray(nodes)) {
        return yaml.dump({ version, services: {} });
    }

    // --- FIX: FILTRADO DE CONEXIONES FANTASMA ---
    // Solo consideramos conexiones válidas donde ambos nodos existen.
    const validConnections = connections.filter(conn => {
        const sourceExists = nodes.some(n => n.id === conn.source);
        const targetExists = nodes.some(n => n.id === conn.target);
        return sourceExists && targetExists;
    });
    // ---------------------------------------------

    // 1. Generar redes por Componentes Conexos (BFS)
    const adjList = {};
    nodes.forEach(n => adjList[n.id] = []);
    validConnections.forEach(conn => {
        if (adjList[conn.source] && adjList[conn.target]) {
            adjList[conn.source].push(conn.target);
            adjList[conn.target].push(conn.source);
        }
    });

    const visited = new Set();
    const islands = [];
    nodes.forEach(node => {
        if (!visited.has(node.id)) {
            const component = [];
            const queue = [node.id];
            visited.add(node.id);
            while (queue.length > 0) {
                const current = queue.shift();
                component.push(current);
                adjList[current].forEach(neighbor => {
                    if (!visited.has(neighbor)) {
                        visited.add(neighbor);
                        queue.push(neighbor);
                    }
                });
            }
            if (component.length > 1) islands.push(component);
        }
    });

    islands.forEach((_, index) => {
        networks[`net_island_${index}`] = { driver: 'bridge' };
    });

    // 2. Generate Services
    nodes.forEach(node => {
        if (!node.data) return;

        // --- FIX 1: SANITIZACIÓN DE NOMBRES ---
        const rawName = node.data.name || `service-${node.id}`;
        // Solo permitimos letras, números y guiones bajo.
        const safeServiceName = rawName.toLowerCase().replace(/[^a-z0-9_-]/g, '_');

        // VALIDACIÓN DE NODO DUPLICADO
        if (usedServiceNames.has(safeServiceName)) {
            throw new Error(`CONFLICTO CRÍTICO: El nombre de nodo "${rawName}" está duplicado. Cada nodo debe tener un nombre único.`);
        }
        usedServiceNames.add(safeServiceName);

        const finalContainerName = node.data.containerName || `${safeServiceName}_container`;

        // VALIDACIÓN DE CONTENEDOR DUPLICADO
        if (usedContainerNames.has(finalContainerName)) {
            throw new Error(`CONFLICTO CRÍTICO: El nombre de contenedor "${finalContainerName}" está en uso por otro nodo. Cámbialo.`);
        }
        usedContainerNames.add(finalContainerName);

        const serviceConfig = {
            image: node.data.dockerImage || 'alpine:latest',
            container_name: finalContainerName, // Usamos la variable validada
            labels: {
                'com.topology.node_id': node.id,
                'com.topology.managed': 'true'
            },
            cap_add: ['NET_ADMIN', 'NET_RAW']
        };

        // 1. SOPORTE PARA COMANDO PERSONALIZADO
        if (node.data.command) {
            // Si el usuario escribió un comando, lo usamos.
            // Docker Compose acepta string o array. Lo pasamos directo.
            serviceConfig.command = node.data.command;
        }

        // 2. SOPORTE PARA MODO PRIVILEGIADO
        if (node.data.privileged) {
            serviceConfig.privileged = true;
        }

        // Redes: Asignar red de la isla (componente conexo) del nodo
        const nodeNetworks = [];
        islands.forEach((island, index) => {
            if (island.includes(node.id)) {
                nodeNetworks.push(`net_island_${index}`);
            }
        });

        if (nodeNetworks.length > 0) {
            serviceConfig.networks = nodeNetworks;
        } else {
            // FIX: Si no tiene cables, NO lo aislamos con 'none' si tiene puertos expuestos.
            // Dejamos que use la red 'default' de Docker para que funcionen los port-mappings.
            // Solo usamos 'none' si realmente queremos aislamiento total.
            if (!node.data.ports || node.data.ports.length === 0) {
                //serviceConfig.network_mode = 'none';
                console.log(`Nodo ${safeServiceName} sin conexiones, usando red por defecto.`);
            }
        }

        if (node.data.tty) serviceConfig.tty = true;
        if (node.data.stdinOpen) serviceConfig.stdin_open = true;

        // --- FIX 2: VALIDACIÓN DE PUERTOS (Anti-Colisión) ---
        if (node.data.ports && node.data.ports.length > 0) {
            serviceConfig.ports = [];
            node.data.ports.forEach(p => {
                // Formato esperado: "8080:80" o "80"
                const parts = p.split(':');
                const hostPort = parts.length > 1 ? parts[0] : null;

                if (hostPort) {
                    if (usedHostPorts.has(hostPort)) {
                        throw new Error(`CONFLICTO CRÍTICO: El puerto ${hostPort} ya está en uso por otro nodo. Cámbialo.`);
                    }
                    usedHostPorts.add(hostPort);
                }
                serviceConfig.ports.push(p);
            });
        }

        // Volúmenes y EnvVars
        // Inyección de Volumen Persistente Automático
        const autoVolume = `./volumes/${safeServiceName}:/root`;
        if (node.data.volumes && node.data.volumes.length > 0) {
            serviceConfig.volumes = [autoVolume, ...node.data.volumes];
        } else {
            serviceConfig.volumes = [autoVolume];
        }
        if (node.data.envVars) {
            const envObj = {};
            node.data.envVars.forEach(e => { if (e.key) envObj[e.key] = e.value || ''; });
            serviceConfig.environment = envObj;
        }

        services[safeServiceName] = serviceConfig;
    });

    const composeObj = { version, services };
    if (Object.keys(networks).length > 0) composeObj.networks = networks;

    return yaml.dump(composeObj);
}

module.exports = { generateComposeYAML };
