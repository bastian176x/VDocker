//__tests__/generator.test.js
const { generateComposeYAML } = require('../app/topology/generator');

describe('Módulo Validador y Generador de docker-compose (Tabla 4.4)', () => {

    test('TVAL-01: Permite despliegue de nodos individuales sin conexión (Comportamiento actualizado)', () => {
        // Preparar: Un nodo solitario sin conexiones
        const nodos = [
            { id: 'node-1', data: { name: 'ubuntu-solo', dockerImage: 'ubuntu:latest' } }
        ];
        const conexiones = [];

        // Actuar: Ejecutamos tu función REAL
        const yamlResult = generateComposeYAML(nodos, conexiones);

        // Comprobar: Verificamos que NO lance error y contenga el servicio
        expect(yamlResult).toContain('ubuntu-solo_container');
        expect(yamlResult).toContain('ubuntu:latest');
    });

    test('TVAL-02: Detecta conflicto de puertos y lanza error crítico', () => {
        const nodosConConflicto = [
            { id: 'node-1', data: { name: 'web1', ports: ['8080:80'] } },
            { id: 'node-2', data: { name: 'web2', ports: ['8080:80'] } }
        ];
        expect(() => { generateComposeYAML(nodosConConflicto, []); }).toThrow('CONFLICTO CRÍTICO');
    });

    test('TVAL-04: Detecta conflicto de nombres de nodo duplicados', () => {
        const nodosNombresDuplicados = [
            { id: 'node-1', data: { name: 'kali-linux' } },
            { id: 'node-2', data: { name: 'kali-linux' } }
        ];
        expect(() => { generateComposeYAML(nodosNombresDuplicados, []); }).toThrow('CONFLICTO CRÍTICO');
    });

    test('TGEN-01: Genera YAML válido con servicios y redes correctamente', () => {
        const nodos = [
            { id: 'node-1', data: { name: 'kali', dockerImage: 'kalilinux/kali-rolling' } },
            { id: 'node-2', data: { name: 'victima', dockerImage: 'tleemcjr/metasploitable2' } }
        ];
        const conexiones = [{ id: 'conn-1', source: 'node-1', target: 'node-2' }];
        const yamlResult = generateComposeYAML(nodos, conexiones);

        expect(yamlResult).toContain('kali_container');
        expect(yamlResult).toContain('victima_container');
        expect(yamlResult).toContain('net_island_0');
        expect(yamlResult).toContain('version:');
    });

    test('TGEN-02: Incluye variables de entorno y volúmenes correctamente', () => {
        const nodos = [{
            id: 'node-1',
            data: {
                name: 'db', dockerImage: 'mysql:5.7',
                envVars: [{ key: 'MYSQL_ROOT_PASSWORD', value: 'admin123' }],
                volumes: ['./data:/var/lib/mysql']
            }
        }];
        const yamlResult = generateComposeYAML(nodos, []);
        expect(yamlResult).toContain('MYSQL_ROOT_PASSWORD: admin123');
        expect(yamlResult).toContain('./data:/var/lib/mysql');
    });
});