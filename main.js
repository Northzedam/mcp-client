const { app, BrowserWindow, ipcMain } = require('electron')
const { createDB } = require('./db')
const { OpenAIClient } = require('./openai')
const { MCPAdapter } = require('./mcp')
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

app.whenReady().then(() => {
  // Inicializar base de datos
  const dbPath = path.join(__dirname, 'data.db')
  const { 
    db, migrate, 
    getSessions, createSession, deleteSession, listMessages, appendMessage,
    setSetting, getSetting, listSettings,
    logToolDecision, listToolLogs
  } = createDB(dbPath)
  migrate()
  
  // Guardar instancia de DB y funciones
  dbInstance = { 
    db, 
    getSessions, createSession, deleteSession, listMessages, appendMessage,
    setSetting, getSetting, listSettings,
    logToolDecision, listToolLogs
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
  
  // Hacer dbInstance global para MCP
  global.dbInstance = dbInstance
  
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
  ipcMain.handle('chat:stream', async (event, { sessionId, messages, model, opts }) => {
    try {
      if (!openaiClient) {
        throw new Error('OpenAI client no inicializado. Configura OPENAI_API_KEY')
      }

      const fullResponse = await openaiClient.streamChat({
        sessionId,
        messages,
        model,
        opts
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