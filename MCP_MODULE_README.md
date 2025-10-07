# Módulo "Gestión de MCP por JSON" - Documentación

## Descripción

El módulo MCP permite gestionar servidores MCP (Model Context Protocol) mediante configuraciones JSON. Los usuarios pueden agregar, editar, activar/desactivar y eliminar conexiones a servidores MCP, y una vez conectados, sus herramientas quedan disponibles para uso con aprobación humana cuando aplique.

## Características Implementadas

### ✅ Funcionalidades Completadas

1. **Validación JSON** - Valida configuraciones MCP en formato estándar
2. **Gestión de Servidores** - CRUD completo para servidores MCP
3. **Estados de Conexión** - Conectado, Conectando, Error, Deshabilitado
4. **Descubrimiento de Herramientas** - Auto-descubrimiento de tools disponibles
5. **Sistema de Políticas** - Control de acceso y aprobación
6. **Persistencia** - Guardado automático en base de datos SQLite
7. **Reconexión Automática** - Reconecta servidores habilitados al iniciar
8. **Interfaz de Usuario** - UI completa con modal para gestión
9. **Logs y Auditoría** - Registro de todas las ejecuciones

### 🎯 Historias de Usuario Implementadas

- **HU-MCP-01**: ✅ Agregar MCP con JSON
- **HU-MCP-02**: ✅ Validación de JSON con mensajes claros
- **HU-MCP-03**: ✅ Estados de conexión visibles
- **HU-MCP-04**: ✅ Listado de tools con descripción y parámetros
- **HU-MCP-05**: ✅ Activar/Desactivar MCPs
- **HU-MCP-06**: ✅ Edición de configuración JSON
- **HU-MCP-07**: ✅ Eliminación de MCPs
- **HU-MCP-08**: ✅ Ejecución con políticas de aprobación
- **HU-MCP-09**: ✅ Persistencia y reconexión automática

## Cómo Usar

### 1. Acceder al Módulo MCP

1. Cambia el modo a **"Agente"** en el selector de modo
2. Haz clic en la pestaña **"Herramientas MCP"**
3. La interfaz MCP se cargará automáticamente

**Nota**: La pestaña MCP es únicamente para gestión de servidores MCP, no para chat. El chat se mantiene en la pestaña "Chat".

### 2. Agregar un Servidor MCP

1. Haz clic en **"Agregar MCP"**
2. En el modal que aparece:
   - **Editor JSON**: Pega tu configuración MCP
   - **Ejemplos**: Selecciona un ejemplo predefinido
   - **Ayuda**: Consulta la documentación del formato
3. Haz clic en **"Validar"** para verificar la configuración
4. Si es válida, haz clic en **"Guardar"**

### 3. Formato de Configuración

#### Formato Estándar MCP (Recomendado)
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/files"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your-token-here"
      }
    }
  }
}
```

#### Tipos de Conexión Soportados

**stdio** (Proceso local):
```json
{
  "command": "npx",
  "args": ["-y", "package-name"],
  "env": {
    "API_KEY": "your-key"
  }
}
```

**websocket** (Servidor remoto):
```json
{
  "type": "websocket",
  "url": "wss://server.example.com/mcp",
  "headers": {
    "Authorization": "Bearer token"
  }
}
```

### 4. Gestionar Servidores

- **Seleccionar**: Haz clic en un servidor para ver sus detalles
- **Conectar**: Botón "Conectar" para establecer conexión
- **Habilitar/Deshabilitar**: Toggle para activar/desactivar
- **Editar**: Modificar configuración JSON
- **Eliminar**: Borrar servidor y sus tools

### 5. Estados de Conexión

- 🟢 **Conectado**: Servidor activo, tools disponibles
- 🟡 **Conectando**: Intentando establecer conexión
- 🔴 **Error**: Fallo de conexión (ver mensaje de error)
- ⚪ **Deshabilitado**: Servidor pausado

### 6. Herramientas Disponibles

Una vez conectado, el servidor mostrará:
- **Nombre** de la herramienta
- **Descripción** de su función
- **Parámetros** requeridos
- **Botón Probar** para testing (solo para verificar conectividad)

**Nota**: Las herramientas MCP se ejecutan desde el chat en modo "Agente", no desde la pestaña de gestión MCP.

## Ejemplos Predefinidos

El módulo incluye ejemplos para:

1. **Sistema de Archivos** - Acceso al filesystem local
2. **GitHub Integration** - Integración con repositorios GitHub
3. **Playwright Automation** - Automatización de navegadores
4. **Búsqueda Web** - Búsqueda en internet
5. **Base de Datos** - Acceso a bases de datos SQL
6. **Configuración Múltiple** - Varios servidores en una configuración

## Sistema de Políticas

### Políticas por Defecto

- **ALLOW**: `filesystem.read`, `web_search`, `read_file`
- **REQUIRE_CONFIRMATION**: `filesystem.write`, `playwright.*`, `write_file`
- **DENY**: `system.exec`, `email.send`, operaciones peligrosas

### Aplicación de Políticas

- En modo **"Preguntar"**: No se ejecutan tools
- En modo **"Agente"**: Se aplican políticas de aprobación
- **Scopes**: Se respetan límites configurados (carpetas, dominios)

## Persistencia

- **Base de datos**: SQLite con tablas para servidores, tools y logs
- **Reconexión automática**: Al iniciar la app, reconecta servidores habilitados
- **Configuración**: Se mantiene entre sesiones

## Logs y Auditoría

Todas las ejecuciones se registran con:
- **Timestamp** de ejecución
- **Servidor** y herramienta utilizada
- **Argumentos** pasados
- **Resultado** obtenido
- **Decisión** de política aplicada
- **Mensaje de error** (si aplica)

## Archivos del Módulo

- `mcp-manager.js` - Lógica principal de gestión
- `mcp-validator.js` - Validación de configuraciones JSON
- `mcp-ui.js` - Interfaz de usuario principal
- `mcp-modal.js` - Modal para agregar/editar MCPs
- `mcp-examples.js` - Ejemplos predefinidos
- `policy.js` - Sistema de políticas de seguridad
- `db/migrations/0003_mcp_tables.sql` - Esquema de base de datos

## Solución de Problemas

### Error de Conexión
- Verifica que el comando/URL sea correcto
- Asegúrate de que las dependencias estén instaladas
- Revisa las variables de entorno requeridas

### JSON Inválido
- Usa el botón "Formatear" para corregir sintaxis
- Consulta la pestaña "Ayuda" para ejemplos
- Verifica que todos los campos requeridos estén presentes

### Tools No Disponibles
- Asegúrate de que el servidor esté "Conectado"
- Haz clic en "Descubrir herramientas" si es necesario
- Verifica los logs para errores de conexión

## Próximas Mejoras

- [ ] Integración con chat para ejecución automática
- [ ] Sistema de notificaciones en tiempo real
- [ ] Importación/exportación de configuraciones
- [ ] Métricas y estadísticas de uso
- [ ] Soporte para más tipos de transporte
- [ ] Interfaz de configuración de políticas avanzada
