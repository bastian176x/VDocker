# VDocker - Editor Visual de Topologías Docker

[![Integración Continua VDocker](https://github.com/bastian176x/VDocker/actions/workflows/ci.yml/badge.svg)](https://github.com/bastian176x/VDocker/actions/workflows/ci.yml)

Una aplicación de escritorio basada en Electron y React para diseñar y gestionar topologías de Docker visualmente.

## 🚀 Descarga Rápida (Recomendado)

Si deseas probar VDocker sin tener que compilar el código fuente, puedes descargar la última versión del instalador (`.exe` para Windows) generada automáticamente por nuestro sistema de Despliegue Continuo:

1. Ve a la pestaña **[Actions](https://github.com/bastian176x/VDocker/actions)** de este repositorio.
2. En el menú lateral izquierdo, selecciona **Despliegue Continuo (Generador de .exe)**.
3. Haz clic en la ejecución más reciente que tenga un check verde (✅).
4. Ve al fondo de la página y, en la sección **Artifacts**, haz clic en `VDocker-Instalador-Windows` para descargar el archivo `.zip` que contiene el ejecutable.

---

## Requisitos Previos (Para Desarrolladores)

Si deseas clonar y modificar el proyecto, asegúrate de tener instalado:

- [Node.js](https://nodejs.org/) (versión recomendada: 18 o superior)
- [npm](https://www.npmjs.com/) (normalmente viene con Node.js)
- Git

## Instalación

1. **Clonar el repositorio:**

   ```bash
   git clone [https://github.com/bastian176x/VDocker.git](https://github.com/bastian176x/VDocker.git)
   cd VDocker
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

## Pruebas (Testing automatizado)

El proyecto cuenta con una robusta suite de pruebas unitarias, de integración y de sistema implementadas con **Jest** para garantizar la integridad de la generación de topologías, el manejo del sistema de archivos y la interacción con el motor de Docker.

Para ejecutar la batería de pruebas localmente y generar el reporte de métricas de cobertura:

```bash
npm test -- --coverage
```

## Construcción (Build manual)

Para empaquetar la aplicación para distribución en tu máquina local:

```bash
npm run build
```

Este proceso:
1. Compilará el frontend de React.
2. Empaquetará la aplicación Electron utilizando `electron-builder`.

Los archivos generados se encontrarán en la carpeta `dist/`.

## Estructura del Proyecto

- `app/` - Código principal del proceso de Electron (`main.js`, preload scripts, etc.).
- `frontend/` - Código fuente de la interfaz de usuario (React, componentes, estilos).
- `dist/` - Carpeta generada con los ejecutables compilados (ignorada en git).
- `scripts/` - Scripts de utilidad para el desarrollo/build.
- `__tests__/` - Suite de pruebas unitarias, de integración y sistema (Jest).
- `.github/workflows/` - Configuración del pipeline de Integración y Despliegue Continuo (CI/CD).

## Solución de Problemas

- **Error de permisos al construir:** Si encuentras errores relacionados con permisos o enlaces simbólicos (symlinks) en Windows durante el build, asegúrate de tener permisos de administrador o que tu usuario tenga los privilegios necesarios ("Crear enlaces simbólicos").
- **Archivos ignorados:** Revisa el archivo `.gitignore` para ver qué archivos y carpetas se excluyen del control de versiones (ej. `node_modules`, carpetas de `dist`, logs, reportes de coverage).