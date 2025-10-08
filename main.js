const { app, BrowserWindow, ipcMain } = require('electron')
const { createDB } = require('./db')
const { OpenAIClient } = require('./openai')
const { MCPAdapter } = require('./mcp')
const { MCPManager } = require('./mcp-manager')
const path = require('path')

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  // Guardar referencia global para OpenAI
  global.mainWindow = win

  win.loadFile('index.html')
}

// Variables globales para la base de datos
let dbInstance = null
let openaiClient = null
let mcpAdapter = null
let mcpManager = null

// Función para obtener datos de herramientas MCP
async function getMCPToolsData() {
  try {
    if (!mcpManager) {
      console.log('Main: MCPManager no inicializado')
      return []
    }

    // Obtener herramientas del MCPManager
    const allTools = mcpManager.getAllTools()
    console.log('Main: Total herramientas MCP disponibles:', allTools.length)
    
    // Si no hay herramientas, intentar cargar desde la BD
    if (allTools.length === 0) {
      console.log('Main: No hay herramientas en MCPManager, cargando desde BD...')
      const servers = dbInstance.getMCPServers()
      const connectedServers = servers.filter(server => server.status === 'connected')
      
      let toolsFromDB = []
      for (const server of connectedServers) {
        const tools = dbInstance.getMCPTools(server.id)
        toolsFromDB = toolsFromDB.concat(tools)
      }
      
      console.log('Main: Herramientas desde BD:', toolsFromDB.length)
      return toolsFromDB
    }
    
    return allTools
  } catch (error) {
    console.log('Main: Error obteniendo herramientas MCP:', error.message)
    return []
  }
}

app.whenReady().then(() => {
  // Inicializar base de datos
  const dbPath = path.join(__dirname, 'data.db')
  const { 
    db, migrate, 
    getSessions, createSession, deleteSession, listMessages, appendMessage,
    setSetting, getSetting, listSettings,
    logToolDecision, listToolLogs,
    getMCPServers, getMCPServer, createMCPServer, updateMCPServer, deleteMCPServer,
    getMCPTools, createMCPTool, deleteMCPTools,
    logMCPToolExecution, listMCPToolLogs,
    convertMCPFormatToInternal, createMCPServersFromMCPFormat
  } = createDB(dbPath)
  migrate()
  
  // Guardar instancia de DB y funciones
  dbInstance = { 
    db, 
    getSessions, createSession, deleteSession, listMessages, appendMessage,
    setSetting, getSetting, listSettings,
    logToolDecision, listToolLogs,
    getMCPServers, getMCPServer, createMCPServer, updateMCPServer, deleteMCPServer,
    getMCPTools, createMCPTool, deleteMCPTools,
    logMCPToolExecution, listMCPToolLogs,
    convertMCPFormatToInternal, createMCPServersFromMCPFormat
  }
  
  // Inicializar OpenAI (usar API key de variable de entorno o settings)
  const apiKey = process.env.OPENAI_API_KEY  || dbInstance.getSetting('openai_api_key')
  
  if (apiKey) {
    openaiClient = new OpenAIClient(apiKey)
    console.log('OpenAI client inicializado correctamente')
  } else {
    console.warn('⚠️  OpenAI API key no configurada. Configura OPENAI_API_KEY como variable de entorno o usa la UI para configurarla.')
  }
  
  // Inicializar MCP Adapter
  mcpAdapter = new MCPAdapter()
  
  // Inicializar MCP Manager
  mcpManager = new MCPManager(dbInstance)
  
  // Cargar servidores MCP y conectar los habilitados
  mcpManager.loadServers().then(async () => {
    console.log('MCPManager: Conectando servidores habilitados...')
    await mcpManager.connectEnabledServers()
  }).catch(error => {
    console.error('Error cargando servidores MCP:', error)
  })
  
  // Hacer dbInstance global para MCP
  global.dbInstance = dbInstance
  
  // Exportar mcpManager para uso en otros módulos
  module.exports = { mcpManager }
  
  // Configurar handlers IPC
  setupIpcHandlers()
  
  createWindow()


app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

// Configurar handlers IPC
function setupIpcHandlers() {
  // Handlers para sesiones
  ipcMain.handle('sessions:list', async () => {
    try {
      return dbInstance.getSessions()
    } catch (error) {
      console.error('Error al listar sesiones:', error)
      throw error
    }
  })

  ipcMain.handle('sessions:create', async (event, title) => {
    try {
      return dbInstance.createSession(title)
    } catch (error) {
      console.error('Error al crear sesión:', error)
      throw error
    }
  })

  ipcMain.handle('sessions:delete', async (event, sessionId) => {
    try {
      return dbInstance.deleteSession(sessionId)
    } catch (error) {
      console.error('Error al eliminar sesión:', error)
      throw error
    }
  })

  // Handlers para mensajes
  ipcMain.handle('messages:list', async (event, sessionId) => {
    try {
      return dbInstance.listMessages(sessionId)
    } catch (error) {
      console.error('Error al listar mensajes:', error)
      throw error
    }
  })

  ipcMain.handle('messages:append', async (event, message) => {
    try {
      return dbInstance.appendMessage(message)
    } catch (error) {
      console.error('Error al agregar mensaje:', error)
      throw error
    }
  })

  // Handlers para settings
  ipcMain.handle('settings:set', async (event, key, value) => {
    try {
      dbInstance.setSetting(key, value)
      
      // Si se está configurando la API key, reinicializar el cliente OpenAI
      if (key === 'openai_api_key' && value) {
        openaiClient = new OpenAIClient(value)
        console.log('OpenAI client reinicializado con nueva API key')
      }
      
      return { success: true }
    } catch (error) {
      console.error('Error al guardar setting:', error)
      throw error
    }
  })

  ipcMain.handle('settings:get', async (event, key) => {
    try {
      return dbInstance.getSetting(key)
    } catch (error) {
      console.error('Error al obtener setting:', error)
      throw error
    }
  })

  ipcMain.handle('settings:list', async () => {
    try {
      return dbInstance.listSettings()
    } catch (error) {
      console.error('Error al listar settings:', error)
      throw error
    }
  })

  // Handlers para tool logs
  ipcMain.handle('tools:log', async (event, logData) => {
    try {
      return dbInstance.logToolDecision(logData)
    } catch (error) {
      console.error('Error al registrar tool log:', error)
      throw error
    }
  })

  ipcMain.handle('tools:logs', async (event, options) => {
    try {
      return dbInstance.listToolLogs(options)
    } catch (error) {
      console.error('Error al listar tool logs:', error)
      throw error
    }
  })

  // Handler para chat streaming
  ipcMain.handle('chat:stream', async (event, { sessionId, messages, model, opts, mode }) => {
    try {
      console.log('Main: Handler chat:stream ejecutándose, modo:', mode);
      if (!openaiClient) {
        throw new Error('OpenAI client no inicializado. Configura OPENAI_API_KEY')
      }

      // Obtener herramientas MCP disponibles
      const mcpToolsData = await getMCPToolsData()
      const mcpTools = mcpAdapter.listTools(mcpToolsData)
      console.log('Main: Herramientas MCP disponibles:', mcpTools.length)

      const fullResponse = await openaiClient.streamChat({
        sessionId,
        messages,
        model,
        opts,
        tools: mcpTools,
        mcpAdapter: mcpAdapter,
        mcpToolsData: mcpToolsData
      })

      // Persistir mensaje del asistente
      await dbInstance.appendMessage({
        sessionId,
        role: 'assistant',
        content: fullResponse
      })

      return { success: true, fullResponse }
    } catch (error) {
      console.error('Error en chat streaming:', error)
      throw error
    }
  })

  // Handlers para MCP
  ipcMain.handle('mcp:listTools', async () => {
    try {
      return mcpAdapter.listTools()
    } catch (error) {
      console.error('Error al listar tools MCP:', error)
      throw error
    }
  })

  ipcMain.handle('mcp:callTool', async (event, { name, args, sessionId }) => {
    try {
      return await mcpAdapter.callTool(name, args, sessionId)
    } catch (error) {
      console.error('Error al llamar tool MCP:', error)
      throw error
    }
  })

  // Handlers para MCP servers
  ipcMain.handle('mcp:getServers', async () => {
    try {
      return dbInstance.getMCPServers()
    } catch (error) {
      console.error('Error al obtener servidores MCP:', error)
      throw error
    }
  })

  ipcMain.handle('mcp:getServer', async (event, id) => {
    try {
      return dbInstance.getMCPServer(id)
    } catch (error) {
      console.error('Error al obtener servidor MCP:', error)
      throw error
    }
  })

  ipcMain.handle('mcp:createServer', async (event, serverData) => {
    try {
      return dbInstance.createMCPServer(serverData)
    } catch (error) {
      console.error('Error al crear servidor MCP:', error)
      throw error
    }
  })

  ipcMain.handle('mcp:updateServer', async (event, id, updates) => {
    try {
      return dbInstance.updateMCPServer(id, updates)
    } catch (error) {
      console.error('Error al actualizar servidor MCP:', error)
      throw error
    }
  })

  ipcMain.handle('mcp:deleteServer', async (event, id) => {
    try {
      return dbInstance.deleteMCPServer(id)
    } catch (error) {
      console.error('Error al eliminar servidor MCP:', error)
      throw error
    }
  })

  // Handlers para MCP tools
  ipcMain.handle('mcp:getTools', async (event, serverId) => {
    try {
      return dbInstance.getMCPTools(serverId)
    } catch (error) {
      console.error('Error al obtener tools MCP:', error)
      throw error
    }
  })

  ipcMain.handle('mcp:createTool', async (event, toolData) => {
    try {
      return dbInstance.createMCPTool(toolData)
    } catch (error) {
      console.error('Error al crear tool MCP:', error)
      throw error
    }
  })

  ipcMain.handle('mcp:deleteTools', async (event, serverId) => {
    try {
      return dbInstance.deleteMCPTools(serverId)
    } catch (error) {
      console.error('Error al eliminar tools MCP:', error)
      throw error
    }
  })

  // Handlers para MCP tool logs
  ipcMain.handle('mcp:logExecution', async (event, logData) => {
    try {
      return dbInstance.logMCPToolExecution(logData)
    } catch (error) {
      console.error('Error al registrar ejecución de tool MCP:', error)
      throw error
    }
  })

  ipcMain.handle('mcp:listLogs', async (event, options) => {
    try {
      return dbInstance.listMCPToolLogs(options)
    } catch (error) {
      console.error('Error al listar logs de tools MCP:', error)
      throw error
    }
  })

  // Handlers para conversión de formato MCP
  ipcMain.handle('mcp:convertFormat', async (event, mcpConfig) => {
    try {
      return dbInstance.convertMCPFormatToInternal(mcpConfig)
    } catch (error) {
      console.error('Error al convertir formato MCP:', error)
      throw error
    }
  })

  ipcMain.handle('mcp:createFromFormat', async (event, mcpConfig) => {
    try {
      return dbInstance.createMCPServersFromMCPFormat(mcpConfig)
    } catch (error) {
      console.error('Error al crear servidores desde formato MCP:', error)
      throw error
    }
  })

  // Handlers para conexión MCP real
  ipcMain.handle('mcp:connectServer', async (event, serverId) => {
    try {
      if (!mcpManager) {
        throw new Error('MCPManager no inicializado')
      }
      return await mcpManager.connectServer(serverId)
    } catch (error) {
      console.error('Error al conectar servidor MCP:', error)
      throw error
    }
  })

  ipcMain.handle('mcp:disconnectServer', async (event, serverId) => {
    try {
      if (!mcpManager) {
        throw new Error('MCPManager no inicializado')
      }
      return await mcpManager.disconnectServer(serverId)
    } catch (error) {
      console.error('Error al desconectar servidor MCP:', error)
      throw error
    }
  })

  ipcMain.handle('mcp:getConnectionStatus', async (event, serverId) => {
    try {
      if (!mcpManager) {
        throw new Error('MCPManager no inicializado')
      }
      return mcpManager.getConnectionStatus(serverId)
    } catch (error) {
      console.error('Error al obtener estado de conexión MCP:', error)
      throw error
    }
  })

  // Handlers para policy
  ipcMain.handle('policy:addRule', async (event, { tool, decision }) => {
    try {
      mcpAdapter.addPolicyRule(tool, decision)
      return { success: true }
    } catch (error) {
      console.error('Error al agregar regla de policy:', error)
      throw error
    }
  })

  ipcMain.handle('policy:removeRule', async (event, { tool }) => {
    try {
      mcpAdapter.removePolicyRule(tool)
      return { success: true }
    } catch (error) {
      console.error('Error al remover regla de policy:', error)
      throw error
    }
  })

  ipcMain.handle('policy:listRules', async () => {
    try {
      return mcpAdapter.listPolicyRules()
    } catch (error) {
      console.error('Error al listar reglas de policy:', error)
      throw error
    }
  })
}