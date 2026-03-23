const { pullImages } = require('../app/docker/service');
const docker = require('../app/docker/client');

// Interceptamos el cliente de Docker para no requerir conexión real en el test
jest.mock('../app/docker/client', () => ({
    getImage: jest.fn(),
    pull: jest.fn()
}));

describe('Servicios de Docker (Tabla 4.4)', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('TVAL-03: Rechaza descarga si la imagen no existe o está mal escrita', async () => {
        // Preparar: Simulamos que la imagen no existe localmente (lanza 404)
        docker.getImage.mockReturnValue({
            inspect: jest.fn().mockRejectedValue({ statusCode: 404 })
        });

        // Simulamos que al intentar descargar de Docker Hub, el motor da error de manifest
        docker.pull.mockRejectedValue(new Error('manifest for imagen-inventada:latest not found'));

        // Actuar y Comprobar: Ejecutamos TU función real y validamos tu manejo de errores
        await expect(pullImages(['imagen-inventada:latest'])).rejects.toThrow('no existe en Docker Hub');
    });

});