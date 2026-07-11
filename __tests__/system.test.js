// __tests__/system.test.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { generateComposeYAML } = require('../app/topology/generator');
const projectManager = require('../app/filesystem/projectManager');
const dockerService = require('../app/docker/service');

describe('Pruebas de Sistema Subcutáneas (Tabla TSIS)', () => {
    let tempDir;
    let originalPing;

    beforeAll(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vdocker-system-'));
        // Guardamos la función original por si necesitamos alterarla en un test
        originalPing = require('../app/docker/client').ping;
    });

    afterAll(() => {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (error) {
            // Ignoramos errores de permisos de root (comunes en CI Linux con Docker)
            console.log(`Nota: Limpieza omitida en CI (${error.code})`);
        }
    });

    // ==========================================
    // TSIS-02: Guardado, carga y ejecución de laboratorio
    // ==========================================
    test('TSIS-02: Flujo completo de guardado, carga y ejecución sin errores', async () => {
        const filePath = path.join(tempDir, 'tsis02_lab.vdlab');
        const yamlPath = path.join(tempDir, 'docker-compose.tsis02.yml');

        // 1. El usuario diseña un laboratorio (Simulado desde el frontend)
        const topologiaFrontend = {
            nodes: [
                { id: 'node-a', data: { name: 'ubuntusys', dockerImage: 'ubuntu:latest', command: 'sleep 10' } }
            ],
            connections: []
        };

        // 2. Lo guarda en el sistema de archivos
        const saveResult = await projectManager.saveFullProject(filePath, topologiaFrontend);
        expect(saveResult.success).toBe(true);

        // 3. Cierra y vuelve a abrir (Simulamos cargando el archivo de nuevo)
        const loadResult = await projectManager.loadFullProject(filePath);
        expect(loadResult.success).toBe(true);
        expect(loadResult.data.nodes[0].data.name).toBe('ubuntusys'); // Mismos datos

        // 4. Solicita su ejecución
        const yamlContent = generateComposeYAML(loadResult.data.nodes, loadResult.data.connections);
        fs.writeFileSync(yamlPath, yamlContent);

        const startResult = await dockerService.startLab(yamlPath);
        expect(startResult.success).toBe(true); // Se inicia correctamente

        // Limpieza del contenedor real creado
        await dockerService.stopLab(yamlPath);
    }, 40000); // 40 segundos porque hace todo el ciclo real

    // ==========================================
    // TSIS-04: Manejo de errores de validación
    // ==========================================
    test('TSIS-04: Conflicto de puertos muestra error y bloquea generación', async () => {
        const yamlPath = path.join(tempDir, 'docker-compose.tsis04.yml');

        // 1. El usuario diseña una topología con conflicto de puertos
        const topologiaInvalida = [
            { id: 'n1', data: { name: 'web1', dockerImage: 'nginx', ports: ['80:80'] } },
            { id: 'n2', data: { name: 'web2', dockerImage: 'apache', ports: ['80:80'] } }
        ];

        // 2. Solicita la ejecución: el backend intenta generar y desplegar
        let errorCapturado = null;
        let despliegueIntentado = false;
        try {
            const yamlContent = generateComposeYAML(topologiaInvalida, []);
            fs.writeFileSync(yamlPath, yamlContent);
            despliegueIntentado = true;
            await dockerService.startLab(yamlPath);
        } catch (error) {
            errorCapturado = error.message;
        }

        // 3. Mensaje claro de error
        expect(errorCapturado).not.toBeNull();
        expect(errorCapturado).toContain('CONFLICTO CRÍTICO');
        expect(errorCapturado).toContain('puerto 80 ya está en uso');

        // 4. No se generó YAML ni se alcanzó el despliegue de contenedores
        expect(fs.existsSync(yamlPath)).toBe(false);
        expect(despliegueIntentado).toBe(false);
    });

    // ==========================================
    // TSIS-06: Comportamiento ante indisponibilidad de Docker
    // ==========================================
    test('TSIS-06: Falla controlada y sin bloqueos cuando Docker está apagado', async () => {
        const yamlPath = path.join(tempDir, 'docker-compose.fake.yml');
        fs.writeFileSync(yamlPath, `version: '3.8'\nservices:\n  fake:\n    image: alpine`);

        // 1. Simulamos (Mock) que el motor de Docker está apagado o inaccesible
        const dockerClient = require('../app/docker/client');
        dockerClient.ping = jest.fn().mockRejectedValue(new Error('connect ENOENT /var/run/docker.sock'));

        // 2. El usuario intenta ejecutar el laboratorio
        const startResult = await dockerService.startLab(yamlPath);

        // 3. Resultado esperado: Detecta el fallo, no crashea, devuelve mensaje adecuado
        expect(startResult.success).toBe(false);
        expect(startResult.error).toContain('Docker Desktop no está corriendo');

        // Restauramos el ping normal para no romper otras pruebas
        dockerClient.ping = originalPing;
    });
});