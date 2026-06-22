// app/filesystem/projectManager.js
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const os = require('os');

const tempDir = path.join(os.tmpdir(), 'docker-topology-lab');

function saveFullProject(filePath, topologyData) {
    return new Promise((resolve, reject) => {
        try {
            const zip = new AdmZip();

            // 1. Guardar el JSON del proyecto
            zip.addFile("topology.json", Buffer.from(JSON.stringify(topologyData, null, 2), "utf8"));

            // 2. Guardar solo los volúmenes correspondientes a nodos válidos de la topología
            const volumesDir = path.join(tempDir, 'volumes');
            if (fs.existsSync(volumesDir)) {
                const nodes = topologyData.topologia?.nodes || topologyData.nodes || [];
                const safeNames = new Set(
                    nodes.map(node => {
                        const rawName = node.data.name || `service-${node.id}`;
                        return rawName.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
                    })
                );
                const subfolders = fs.readdirSync(volumesDir);
                for (const folder of subfolders) {
                    const folderPath = path.join(volumesDir, folder);
                    if (fs.statSync(folderPath).isDirectory() && safeNames.has(folder)) {
                        zip.addLocalFolder(folderPath, path.join("volumes", folder));
                    }
                }
            }

            // 3. Escribir el archivo .aglab
            zip.writeZip(filePath);
            resolve({ success: true, filePath });
        } catch (error) {
            reject({ success: false, error: error.message });
        }
    });
}

function loadFullProject(filePath) {
    return new Promise((resolve, reject) => {
        try {
            const zip = new AdmZip(filePath);

            // 1. Asegurar que existe el directorio temporal
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

            // Limpiar volúmenes anteriores para no mezclar proyectos
            const volumesDir = path.join(tempDir, 'volumes');
            if (fs.existsSync(volumesDir)) {
                fs.rmSync(volumesDir, { recursive: true, force: true });
            }

            // 2. Extraer todo en la carpeta temporal
            zip.extractAllTo(tempDir, true);

            // 3. Leer el JSON
            const jsonPath = path.join(tempDir, 'topology.json');
            if (!fs.existsSync(jsonPath)) {
                throw new Error("El archivo no contiene topology.json válido.");
            }

            const content = fs.readFileSync(jsonPath, 'utf8');
            const data = JSON.parse(content);

            resolve({ success: true, data });
        } catch (error) {
            reject({ success: false, error: error.message });
        }
    });
}

module.exports = { saveFullProject, loadFullProject };
