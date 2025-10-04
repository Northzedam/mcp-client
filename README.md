# MCP Agent Chat

Una aplicación de chat inteligente construida con Electron que integra OpenAI GPT con el protocolo MCP (Model Context Protocol) para permitir interacciones avanzadas con herramientas externas.

## 🚀 Características

- **Chat en tiempo real** con streaming de respuestas
- **Sistema de modos**: Preguntar vs Agente
- **Base de datos SQLite** para persistencia de conversaciones
- **Sistema de políticas** para control de herramientas MCP
- **Interfaz moderna** con diseño responsive
- **IPC seguro** entre procesos de Electron

## 🏗️ Arquitectura

```
Renderer Process ↔ Main Process ↔ OpenAI API
       ↓                ↓              ↓
    UI/Chat.js    →  IPC Handlers  →  Streaming
       ↓                ↓              ↓
   renderer.js    →  Database     →  SQLite
```

## 📁 Estructura del Proyecto

```
MCP-Agent/
├── main.js              # Proceso principal de Electron
├── preload.js           # Script de precarga seguro
├── index.html           # Interfaz de usuario
├── styles.css           # Estilos de la aplicación
├── chat.js              # Lógica del chat
├── renderer.js          # Gestión de UI y modos
├── openai.js            # Cliente OpenAI con streaming
├── mcp.js               # Adaptador MCP (mock)
├── policy.js            # Motor de políticas
├── db/
│   ├── index.js         # Configuración de base de datos
│   └── migrations/      # Migraciones SQL
└── package.json         # Dependencias del proyecto
```

## 🛠️ Instalación

1. **Clonar el repositorio:**
   ```bash
   git clone <repository-url>
   cd MCP-Agent
   ```

2. **Instalar dependencias:**
   ```bash
   yarn install
   # o
   npm install
   ```

3. **Configurar API Key de OpenAI:**
   ```bash
   # Opción 1: Variable de entorno
   export OPENAI_API_KEY="tu-api-key-aqui"
   
   # Opción 2: Desde la aplicación (Developer Console)
   await window.api.settings.set('openai_api_key', 'tu-api-key-aqui')
   ```

4. **Ejecutar la aplicación:**
   ```bash
   yarn start
   # o
   npm start
   ```

## 🎯 Uso

### Modos de Operación

- **Modo "Preguntar"**: Chat básico sin herramientas MCP
- **Modo "Agente"**: Chat con acceso a herramientas MCP

### Herramientas MCP Disponibles

- `filesystem.read` - Lectura de archivos (ALLOW)
- `filesystem.write` - Escritura de archivos (REQUIRE_CONFIRMATION)
- `playwright.goto` - Navegación web (REQUIRE_CONFIRMATION)
- `web_search` - Búsqueda web (ALLOW)

## 🔧 Desarrollo

### Scripts Disponibles

```bash
yarn start          # Ejecutar en modo desarrollo
yarn dev            # Ejecutar con hot reload
```

### Estructura de Base de Datos

- **sessions**: Conversaciones de chat
- **messages**: Mensajes individuales
- **settings**: Configuraciones de la aplicación
- **tools_logs**: Registro de uso de herramientas MCP

## 🔒 Seguridad

- **Context Isolation**: Habilitado para seguridad
- **CSP**: Content Security Policy configurado
- **API Keys**: Almacenadas de forma segura
- **Políticas de herramientas**: Control granular de acceso

## 🚧 Estado del Proyecto

### ✅ Completado
- [x] Interfaz de chat funcional
- [x] Streaming de OpenAI
- [x] Base de datos SQLite
- [x] Sistema de modos
- [x] Panel de herramientas MCP
- [x] Sistema de políticas básico

### 🔄 En Desarrollo
- [ ] Diálogos de confirmación para políticas
- [ ] Integración con servidores MCP reales
- [ ] UI de configuración de API keys
- [ ] Gestión de múltiples sesiones

## 📝 Licencia

MIT License

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor, abre un issue o pull request.

## 📞 Soporte

Para soporte o preguntas, abre un issue en el repositorio.
