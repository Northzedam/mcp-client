@echo off
echo Inicializando repositorio Git...

REM Inicializar repositorio Git
git init

REM Agregar archivo .gitignore
git add .gitignore

REM Agregar todos los archivos del proyecto
git add .

REM Hacer commit inicial
git commit -m "feat: Initial commit - MCP Agent Chat

- Chat funcional con streaming de OpenAI
- Sistema de modos (Preguntar/Agente)
- Base de datos SQLite con migraciones
- Panel de herramientas MCP con políticas
- UI moderna con estilos profesionales
- IPC seguro entre renderer y main process
- Sistema de persistencia de conversaciones

Tecnologias:
- Electron + Node.js
- OpenAI API con streaming
- SQLite con better-sqlite3
- HTML/CSS/JavaScript vanilla
- Sistema de políticas para MCP"

echo.
echo Repositorio inicializado exitosamente!
echo.
echo Para conectar con GitHub:
echo 1. Crear repositorio en GitHub
echo 2. Ejecutar: git remote add origin <repository-url>
echo 3. Ejecutar: git push -u origin main
echo.
pause
