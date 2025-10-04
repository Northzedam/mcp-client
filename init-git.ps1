Write-Host "Inicializando repositorio Git..." -ForegroundColor Green

# Inicializar repositorio Git
git init

# Agregar archivo .gitignore
git add .gitignore

# Agregar todos los archivos del proyecto
git add .

# Hacer commit inicial
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

Write-Host ""
Write-Host "Repositorio inicializado exitosamente!" -ForegroundColor Green
Write-Host ""
Write-Host "Para conectar con GitHub:" -ForegroundColor Yellow
Write-Host "1. Crear repositorio en GitHub" -ForegroundColor White
Write-Host "2. Ejecutar: git remote add origin <repository-url>" -ForegroundColor White
Write-Host "3. Ejecutar: git push -u origin main" -ForegroundColor White
Write-Host ""
Read-Host "Presiona Enter para continuar"
