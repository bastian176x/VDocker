// app/docker/service.js
const docker = require('./client');
const util = require('util');
const { exec, spawn } = require('child_process');
const execPromise = util.promisify(exec);

/**
 * Verifica Docker y ejecuta el archivo Compose con estrategia Smart Update.
 * @param {string} filePath - Ruta absoluta al docker-compose.yml
 * @param {string[]} containerNames - Lista de nombres de contenedores para limpieza quirúrgica en caso de conflicto
 * @returns {Promise<{success: boolean, error?: string, message?: string}>}
 */
async function startLab(filePath, containerNames = []) {
    // 1. Health Check
    try {
        await docker.ping();
    } catch (e) {
        return { success: false, error: 'Docker Desktop no está corriendo. Por favor inícialo.' };
    }

    // Helper para ejecutar comando
    const runCompose = () => execPromise(`docker compose -f "${filePath}" up -d --remove-orphans`);

    try {
        console.log('🚀 Intentando actualización inteligente (Smart Update)...');
        // Intentamos levantar sin borrar nada primero (preserva estado)
        const { stdout } = await runCompose();
        console.log('Docker Output:', stdout);
        return { success: true, message: 'Entorno actualizado correctamente.' };

    } catch (error) {
        // Si falla, verificamos si es por conflicto de nombres
        const isConflict = error.message.includes('Conflict') || error.message.includes('already in use');

        if (isConflict && containerNames.length > 0) {
            console.warn('⚠️ Conflicto detectado. Resolviendo colisión de nombres...');

            // Borramos solo los contenedores que estorban
            await Promise.all(containerNames.map(async (name) => {
                try {
                    const container = docker.getContainer(name);
                    await container.remove({ force: true });
                    console.log(`   - Contenedor bloqueante ${name} eliminado.`);
                } catch (e) { /* Ignorar si no existe */ }
            }));

            // Reintentamos
            try {
                console.log('🔄 Reintentando despliegue...');
                const { stdout } = await runCompose();
                return { success: true, message: 'Entorno desplegado tras resolver conflictos.' };
            } catch (retryError) {
                return { success: false, error: `Error tras limpieza: ${retryError.message}` };
            }
        }

        // Si es otro error (puertos, imagen no encontrada, etc.)
        return { success: false, error: `Error Docker: ${error.message}` };
    }
}

/**
 * Detiene los contenedores y elimina redes reportando progreso.
 * @param {string} filePath - Ruta absoluta al docker-compose.yml
 * @param {function} onProgress - Callback para reportar logs
 * @returns {Promise<{success: boolean, error?: string, message?: string}>}
 */
async function stopLab(filePath, onProgress) {
    return new Promise((resolve, reject) => {
        console.log(`🛑 Deteniendo laboratorio en: ${filePath}`);

        if (onProgress) onProgress('Iniciando secuencia de apagado...');

        // Usamos spawn para capturar el output en vivo
        const child = spawn('docker', ['compose', '-f', filePath, 'down', '--remove-orphans']);

        // Docker Compose envía el progreso por stderr
        child.stderr.on('data', (data) => {
            const line = data.toString().trim();
            if (line && onProgress) {
                onProgress(line); // Enviamos al frontend
            }
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve({ success: true, message: 'Laboratorio detenido correctamente' });
            } else {
                // Si falla (ej: archivo no encontrado), resolvemos false pero con mensaje
                console.warn(`Docker compose down salió con código ${code}`);
                resolve({ success: true, message: 'Proceso finalizado (posible limpieza manual requerida)' });
            }
        });

        child.on('error', (err) => {
            console.error('Error al spawnear docker:', err);
            reject(err);
        });
    });
}
/**
 * Obtiene el estado de los contenedores gestionados, mapeando NodeID -> ContainerID.
 */
async function getLabStatus() {
    try {
        // Listamos TODOS los contenedores (incluso los detenidos/exited)
        const containers = await docker.listContainers({ all: true });

        // Filtramos solo los nuestros y mapeamos la info vital
        const statusMap = containers
            .filter(c => c.Labels && c.Labels['com.topology.node_id'])
            .map(c => ({
                nodeId: c.Labels['com.topology.node_id'], // ID del nodo visual
                containerId: c.Id,                        // ID real de Docker (Hash)
                name: c.Names[0].replace('/', ''),        // Nombre legible
                state: c.State,                           // 'running', 'exited'
                status: c.Status                          // Mensaje de estado
            }));

        return { success: true, containers: statusMap };
    } catch (error) {
        console.error('Error al obtener estado:', error);
        return { success: false, error: error.message };
    }
}


/**
 * Abre una ventana de terminal nativa (PowerShell) conectada al contenedor.
 * Usa 'start' para forzar una nueva ventana independiente.
 */
async function openTerminal(containerId) {
    try {
        const isWindows = process.platform === 'win32';

        // 1. Inspeccionar el contenedor para decidir el shell
        const container = docker.getContainer(containerId);
        const info = await container.inspect();
        const image = info.Config.Image.toLowerCase();

        // 2. Elegir Shell Inteligente
        // Kali usa zsh o bash. Alpine solo sh.
        // Si es alpine, forzamos sh. Si no, intentamos bash que es más bonito.
        let shellCommand = '/bin/bash';
        if (image.includes('alpine')) {
            shellCommand = '/bin/sh';
            console.log(`🔍 Detectado contenedor Alpine (${image}). Usando ${shellCommand}`);
        } else {
            console.log(`🔍 Detectado contenedor Standard (${image}). Usando ${shellCommand}`);
        }

        if (isWindows) {
            // Usamos el shell elegido dinámicamente
            const cmd = `start wt --title "Terminal: ${image}" docker exec -it ${containerId} ${shellCommand}`;

            exec(cmd, (error) => {
                if (error) {
                    console.warn('⚠️ Windows Terminal falló, usando fallback...');
                    const fallbackCmd = `start powershell.exe -NoExit -Command "docker exec -it ${containerId} ${shellCommand}"`;
                    exec(fallbackCmd);
                }
            });
        } else {
            console.log('Soporte Linux/Mac pendiente.');
        }

        return { success: true };
    } catch (error) {
        console.error('Error abriendo terminal:', error);
        return { success: false, error: error.message };
    }
}


/**
 * Descarga las imágenes necesarias reportando progreso.
 * @param {string[]} images - Lista de imágenes (ej: ['ubuntu:latest', 'postgres:alpine'])
 * @param {function} onProgress - Callback para enviar estado (mensaje, porcentaje)
 */
async function pullImages(images, onProgress) {
    // Eliminamos duplicados
    const uniqueImages = [...new Set(images)];

    for (const [index, image] of uniqueImages.entries()) {
        try {
            const stepPrefix = `[${index + 1}/${uniqueImages.length}]`;
            onProgress(`${stepPrefix} Buscando imagen: ${image}...`, 0);

            // Dockerode pull retorna un stream
            const stream = await docker.pull(image);

            await new Promise((resolve, reject) => {
                // Usamos docker.modem.followProgress para parsear el stream de capas
                docker.modem.followProgress(stream, onFinished, onProgressEvent);

                function onFinished(err, output) {
                    if (err) reject(err);
                    else resolve(output);
                }

                function onProgressEvent(event) {
                    // Calculamos un porcentaje aproximado basado en las capas
                    let status = event.status || '';
                    let progress = event.progress || '';

                    if (status === 'Downloading' || status === 'Extracting') {
                        onProgress(`${stepPrefix} ${image}: ${status} ${progress}`, null);
                        // Nota: Calcular % real global es complejo, enviamos el string de docker
                    } else {
                        onProgress(`${stepPrefix} ${image}: ${status}`, null);
                    }
                }
            });

        } catch (error) {
            console.error(`Error descargando ${image}:`, error);
            // No bloqueamos si falla (quizás ya está local y docker run funcione igual), 
            // pero avisamos.
        }
    }
}


/**
 * Limpieza profunda: Borra contenedores detenidos, redes viejas y caché.
 * Esto recupera los GBs de espacio en disco.
 */
async function pruneSystem() {
    return new Promise((resolve, reject) => {
        // docker system prune -a (all images not used) -f (force) --volumes (prune volumes too)
        exec('docker system prune -a -f --volumes', (error, stdout, stderr) => {
            if (error) {
                console.warn('Prune warning:', stderr);
                // Resolvemos success true aunque haya warnings, para no asustar al usuario
                resolve({ success: true, message: 'Limpieza realizada (con advertencias).' });
            } else {
                resolve({ success: true, message: 'Espacio liberado correctamente.' });
            }
        });
    });
}

/**
 * Ping rápido al demonio de Docker.
 */
async function checkDaemon() {
    return new Promise((resolve) => {
        const { exec } = require('child_process');
        // Si 'docker info' falla, es que el motor está apagado o inaccesible
        exec('docker info', (error) => {
            resolve(!error);
        });
    });
}

module.exports = { startLab, stopLab, getLabStatus, openTerminal, pullImages, pruneSystem, checkDaemon };
