# Contribución al Proyecto VDocker

Este proyecto sigue un flujo de trabajo basado en ramas para mantener el código ordenado, estable y fácil de mantener, incluso trabajando de manera individual.

## 🧱 Estructura de ramas

- **main** → Código estable. Todo lo que está aquí debe compilar y funcionar sin errores.
- **develop** → Rama de desarrollo. Aquí se integran las funcionalidades antes de llegar a `main`.
- **feature/*`** → Nuevas funcionalidades.
- **bugfix/*`** → Correcciones de errores detectados en `develop`.
- **hotfix/*`** → Correcciones urgentes sobre `main`.
- **release/*`** → Preparación de versiones formales del proyecto.

---

## 🚀 Flujo de trabajo

### 1. Crear una nueva funcionalidad
```bash
git checkout develop
git pull
git checkout -b feature/nombre-de-la-feature
