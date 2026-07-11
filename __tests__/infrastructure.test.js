// __tests__/infrastructure.test.js
// Interceptamos librerías nativas y externas
jest.mock('fs');
jest.mock('adm-zip');
jest.mock('child_process');
// Interceptamos tu cliente de Dockerode para no necesitar el motor encendido
jest.mock('../app/docker/client', () => ({
    ping: jest.fn(),
    getContainer: jest.fn(),
}));

const fs = require('fs');
const AdmZip = require('adm-zip');
const { exec } = require('child_process');
const { saveFullProject, loadFullProject } = require('../app/filesystem/projectManager');
// AHORA SÍ IMPORTAMOS TU SERVICIO REAL
const dockerService = require('../app/docker/service');
const dockerClient = require('../app/docker/client');

describe('Adaptadores de Infraestructura y Mocks (Tabla 4.4)', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ==========================================
    // CASOS DEL SISTEMA DE ARCHIVOS (TFS)
    // ==========================================

    test('TFS-01: Guarda un laboratorio válido en una ruta existente sin errores', async () => {
        const mockData = { nodes: [{ id: '1' }], connections: [] };
        const filePath = 'laboratorio_prueba.vdlab';

        const mockZipInstance = {
            addFile: jest.fn(),
            addLocalFolder: jest.fn(),
            writeZip: jest.fn()
        };
        AdmZip.mockImplementation(() => mockZipInstance);
        fs.existsSync.mockReturnValue(false);

        const result = await saveFullProject(filePath, mockData);

        expect(result.success).toBe(true);
        expect(result.filePath).toBe(filePath);
        expect(mockZipInstance.writeZip).toHaveBeenCalledWith(filePath);
    });

    test('TFS-02: Maneja lectura de archivo con JSON mal formado', async () => {
        const filePath = 'corrupto.vdlab';
        const mockZipInstance = { extractAllTo: jest.fn() };
        AdmZip.mockImplementation(() => mockZipInstance);

        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockReturnValue('{ "nodos": [ falta cerrar llaves...');

        await expect(loadFullProject(filePath)).rejects.toMatchObject({
            success: false
        });
    });

    // ==========================================
    // CASOS DE DOCKER (TEXE)
    // ==========================================

    test('TEXE-01: Solicitud de iniciar un laboratorio construye el comando correcto', async () => {
        // Preparar (Arrange): 
        // 1. Simulamos que Docker Desktop SÍ está corriendo (ping devuelve OK)
        dockerClient.ping.mockResolvedValue('OK');

        // 2. Simulamos que el comando exec de consola funciona sin errores
        // Como tu código usa util.promisify(exec), debemos simular el callback nativo de Node
        exec.mockImplementation((cmd, callback) => {
            callback(null, { stdout: 'Contenedores creados exitosamente' }, '');
        });

        const rutaCompose = 'C:/temp/docker-compose.generated.yml';

        // Actuar (Act): LLAMAMOS A TU FUNCIÓN REAL DE APP/DOCKER/SERVICE.JS
        const result = await dockerService.startLab(rutaCompose);

        // Comprobar (Assert):
        expect(result.success).toBe(true);
        // Verificamos que tu código real haya intentado ejecutar el string exacto que programaste
        expect(exec).toHaveBeenCalledWith(
            expect.stringContaining(`docker compose -f "${rutaCompose}" up -d --remove-orphans`),
            expect.any(Function)
        );
    });

});