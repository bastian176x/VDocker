// __tests__/integration.test.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { generateComposeYAML } = require('../app/topology/generator');
const projectManager = require('../app/filesystem/projectManager');
const dockerService = require('../app/docker/service');

describe('Pruebas de Integración (Tabla de Casos TINT)', () => {
    let tempDir;

    // Antes de todas las pruebas, creamos una carpeta temporal real en el SO
    beforeAll(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vdocker-integration-'));
    });

    // Después de todas las pruebas, limpiamos la basura del disco duro
    afterAll(() => {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (error) {
            // Ignoramos errores de permisos de root (comunes en CI Linux con Docker)
            console.log(`Nota: Limpieza omitida en CI (${error.code})`);
        }
    });
    // ==========================================
    // TINT-01 y TINT-02: Integración Validador + Generador
    // ==========================================
    test('TINT-01: Validación y generación exitosa de YAML con topología válida', () => {
        const yamlPath = path.join(tempDir, 'compose_tint01.yml');
        const nodos = [
            { id: 'node-1', data: { name: 'web', dockerImage: 'nginx:latest', ports: ['8080:80'] } }
        ];

        // Flujo integrado: generación -> escritura en disco
        const yamlResult = generateComposeYAML(nodos, []);
        fs.writeFileSync(yamlPath, yamlResult);

        // El archivo existe físicamente y su contenido es correcto
        expect(fs.existsSync(yamlPath)).toBe(true);
        const contenidoEnDisco = fs.readFileSync(yamlPath, 'utf8');
        expect(contenidoEnDisco).toContain('version:');
        expect(contenidoEnDisco).toContain('nginx:latest');
        expect(contenidoEnDisco).toContain('8080:80');
    });

    test('TINT-02: Intercepción de conflictos detiene la generación del archivo', () => {
        const yamlPath = path.join(tempDir, 'compose_tint02.yml');
        const nodosConflicto = [
            { id: 'node-1', data: { name: 'web1', dockerImage: 'nginx:latest', ports: ['8080:80'] } },
            { id: 'node-2', data: { name: 'web2', dockerImage: 'apache:latest', ports: ['8080:80'] } }
        ];

        // El flujo se corta en validación: nunca se llega a escribir
        expect(() => {
            const yamlResult = generateComposeYAML(nodosConflicto, []);
            fs.writeFileSync(yamlPath, yamlResult);
        }).toThrow('CONFLICTO CRÍTICO');

        // Verificamos físicamente que NO se creó ningún archivo en disco
        expect(fs.existsSync(yamlPath)).toBe(false);
    });

    // ==========================================
    // TINT-03: Integración BackendCore + FileSystem
    // ==========================================
    test('TINT-03: Guardado y carga consistente de un laboratorio (.vdlab) en disco', async () => {
        const filePath = path.join(tempDir, 'lab_integracion.vdlab');
        const topologiaOriginal = {
            metadata: { fechaCreacion: Date.now(), nombre: 'Test Lab' },
            nodes: [{ id: 'n1', data: { name: 'router' } }],
            connections: []
        };

        // 1. Guardamos en el disco duro REAL
        const saveResult = await projectManager.saveFullProject(filePath, topologiaOriginal);
        expect(saveResult.success).toBe(true);
        expect(fs.existsSync(filePath)).toBe(true); // Verificamos físicamente el archivo

        // 2. Cargamos desde el disco duro REAL
        const loadResult = await projectManager.loadFullProject(filePath);
        expect(loadResult.success).toBe(true);

        // 3. Verificamos consistencia de datos (Deep Equal)
        expect(loadResult.data.nodes[0].id).toBe('n1');
        expect(loadResult.data.metadata.nombre).toBe('Test Lab');
    });

    // ==========================================
    // TINT-04: Integración Plantillas + FileSystem
    // ==========================================
    test('TINT-04: Aplicación de un ArchivoPlantilla en disco para crear un nuevo laboratorio', () => {
        const plantillaPath = path.join(tempDir, 'plantilla_database.json');
        const yamlPath = path.join(tempDir, 'compose_tint04.yml');

        // 1. El catálogo define una plantilla de servicio con su configuración
        //    predefinida (imagen base, puertos y variables de entorno).
        //    La persistimos como ArchivoPlantilla en el sistema de archivos.
        const archivoPlantilla = {
            type: 'database',
            defaults: {
                name: 'db-postgres-1838',
                dockerImage: 'postgres:15-alpine',
                envVars: [{ key: 'POSTGRES_PASSWORD', value: 'admin123' }],
                ports: ['5432'],
                volumes: []
            }
        };
        fs.writeFileSync(plantillaPath, JSON.stringify(archivoPlantilla, null, 2), 'utf8');
        expect(fs.existsSync(plantillaPath)).toBe(true);

        // 2. El sistema lee la plantilla desde disco y la aplica para crear el nodo
        const plantillaLeida = JSON.parse(fs.readFileSync(plantillaPath, 'utf8'));
        const nodosDesdePlantilla = [
            {
                id: 'node-tint04',
                type: plantillaLeida.type,
                position: { x: 200, y: 150 },
                data: { ...plantillaLeida.defaults }
            }
        ];

        // 3. Flujo integrado: ArchivoPlantilla (FS) -> nodo -> generación de YAML
        const yamlResult = generateComposeYAML(nodosDesdePlantilla, []);
        fs.writeFileSync(yamlPath, yamlResult);

        // 4. El laboratorio creado refleja fielmente la configuración de la plantilla
        expect(fs.existsSync(yamlPath)).toBe(true);
        const contenidoEnDisco = fs.readFileSync(yamlPath, 'utf8');
        expect(contenidoEnDisco).toContain('postgres:15-alpine');
        expect(contenidoEnDisco).toContain('POSTGRES_PASSWORD: admin123');
        expect(contenidoEnDisco).toContain('5432');
        expect(contenidoEnDisco).toContain('db-postgres-1838_container');
    });
    // ==========================================
    // TINT-05 y TINT-06: Integración BackendCore + DockerEngine
    // ==========================================
    // IMPORTANTE: Le damos 30 segundos de timeout a estas pruebas porque Docker real tarda en responder
    test('TINT-05: Iniciar un laboratorio a partir de un docker-compose.yml de prueba', async () => {
        // 1. Creamos un YAML real minimalista (un contenedor alpine que no hace nada y se apaga)
        const composePath = path.join(tempDir, 'docker-compose.test.yml');
        const composeContent = `
version: '3.8'
services:
  test_integration_node:
    image: alpine:latest
    command: sleep 10
`;
        fs.writeFileSync(composePath, composeContent);

        // 2. Ejecutamos el módulo real contra Docker Desktop
        const startResult = await dockerService.startLab(composePath);
        expect(startResult.success).toBe(true);

        // 3. Limpiamos / Detenemos el contenedor
        const stopResult = await dockerService.stopLab(composePath);
        expect(stopResult.success).toBe(true);
    }, 30000);

    test('TINT-06: Intentar iniciar laboratorio con YAML inexistente o mal formado', async () => {
        const badPath = path.join(tempDir, 'no-existo.yml');

        // Ejecutamos el inicio de lab con una ruta falsa
        const result = await dockerService.startLab(badPath);

        // Verificamos que el sistema atrape el error controladamente y NO crashee
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        // Docker arroja un error quejándose de que no encuentra el archivo
        expect(result.error).toMatch(/Error Docker:/);
    }, 15000);

});