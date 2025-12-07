# VDocker - Editor Visual de Topologías Docker

Una aplicación de escritorio basada en Electron y React para diseñar y gestionar topologías de Docker visualmente.

## Requisitos Previos

Antes de comenzar, asegúrate de tener instalado:

- [Node.js](https://nodejs.org/) (versión recomendada: 18 o superior)
- [npm](https://www.npmjs.com/) (normalmente viene con Node.js)
- Git

## Instalación

1. **Clonar el repositorio:**

   ```bash
   git clone <URL_DEL_REPOSITORIO>
   cd my-electron-app
   ```

2. **Instalar dependencias del proyecto raíz (Electron):**

   ```bash
   npm install
   ```

3. **Instalar dependencias del frontend (React/Vite):**

   ```bash
   cd frontend
   npm install
   cd ..
   ```

> [!NOTE]
> Es importante realizar la instalación en **ambas** carpetas (`/` y `/frontend`) para que todos los comandos funcionen correctamente.

## Desarrollo

Para iniciar la aplicación en modo desarrollo (con recarga en caliente tanto para el frontend como para Electron):

```bash
npm run dev
```

Este comando ejecutará concurrentemente:
- Servidor de desarrollo de Vite (Frontend)
- Ventana de Electron

## Construcción (Build)

Para empaquetar la aplicación para distribución (production ready):

```bash
npm run build
```

Este proceso:
1. Compilará el frontend de React.
2. Empaquetará la aplicación Electron utilizando `electron-builder`.

Los archivos generados (instaladores y ejecutables) se encontrarán en la carpeta:
- `dist/`

## Estructura del Proyecto

- `app/` - Código principal del proceso de Electron (`main.js`, preload scripts, etc.).
- `frontend/` - Código fuente de la interfaz de usuario (React, componentes, estilos).
- `dist/` - Carpeta generada con los ejecutables compilados (ignorada en git).
- `scripts/` - Scripts de utilidad para el desarrollo/build.

## Solución de Problemas

- **Error de permisos al construir:** Si encuentras errores relacionados con permisos o enlaces simbólicos (symlinks) en Windows durante el build, asegúrate de tener permisos de administrador o que tu usuario tenga los privilegios necesarios ("Crear enlaces simbólicos").
- **Archivos ignorados:** Revisa el archivo `.gitignore` para ver qué archivos y carpetas se excluyen del control de versiones (ej. `node_modules`, carpetas de `dist`, logs).