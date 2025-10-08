const { contextBridge, ipcRenderer } = require('electron')

// Exponer API segura al renderer process
contextBridge.exposeInMainWorld('api', {
  sessions: {
    list: () => ipcRenderer.invoke('sessions:list'),
    create: (title) => ipcRenderer.invoke('sessions:create', title),
    delete: (sessionId) => ipcRenderer.invoke('sessions:delete', sessionId)
  },
  messages: {
    list: (sessionId) => ipcRenderer.invoke('messages:list', sessionId),
    append: (message) => ipcRenderer.invoke('messages:append', message)
  },
  settings: {
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
    get: (key) => ipcRenderer.invoke('settings:get', key),
    list: () => ipcRenderer.invoke('settings:list')
  },
  tools: {
    log: (logData) => ipcRenderer.invoke('tools:log', logData),
    logs: (options) => ipcRenderer.invoke('tools:logs', options)
  },
  chat: {
    stream: async (payload, onDelta) => {
      // Configurar listeners para streaming
      const deltaListener = (event, data) => {
        if (data.sessionId === payload.sessionId && onDelta) {
          onDelta(data)
        }
      }
      
      const endListener = (event, data) => {
        if (data.sessionId === payload.sessionId) {
          // Enviar la respuesta final al callback
          if (onDelta && data.fullResponse) {
            onDelta({ content: data.fullResponse, fullResponse: data.fullResponse })
          }
          ipcRenderer.removeListener('chat:stream:delta', deltaListener)
          ipcRenderer.removeListener('chat:stream:end', endListener)
          ipcRenderer.removeListener('chat:stream:error', errorListener)
        }
      }
      
      const errorListener = (event, data) => {
        if (data.sessionId === payload.sessionId) {
          ipcRenderer.removeListener('chat:stream:delta', deltaListener)
          ipcRenderer.removeListener('chat:stream:end', endListener)
          ipcRenderer.removeListener('chat:stream:error', errorListener)
        }
      }
      
      ipcRenderer.on('chat:stream:delta', deltaListener)
      ipcRenderer.on('chat:stream:end', endListener)
      ipcRenderer.on('chat:stream:error', errorListener)
      
      return await ipcRenderer.invoke('chat:stream', payload)
    }
  },
  mcp: {
    // Funciones legacy (mock)
    listTools: () => ipcRenderer.invoke('mcp:listTools'),
    callTool: (name, args, sessionId) => ipcRenderer.invoke('mcp:callTool', { name, args, sessionId }),
    
    // Funciones de servidores MCP
    getServers: () => ipcRenderer.invoke('mcp:getServers'),
    getServer: (id) => ipcRenderer.invoke('mcp:getServer', id),
    createServer: (serverData) => ipcRenderer.invoke('mcp:createServer', serverData),
    updateServer: (id, updates) => ipcRenderer.invoke('mcp:updateServer', id, updates),
    deleteServer: (id) => ipcRenderer.invoke('mcp:deleteServer', id),
    
    // Funciones de tools MCP
    getTools: (serverId) => ipcRenderer.invoke('mcp:getTools', serverId),
    createTool: (toolData) => ipcRenderer.invoke('mcp:createTool', toolData),
    deleteTools: (serverId) => ipcRenderer.invoke('mcp:deleteTools', serverId),
    
    // Funciones de logs MCP
    logExecution: (logData) => ipcRenderer.invoke('mcp:logExecution', logData),
    listLogs: (options) => ipcRenderer.invoke('mcp:listLogs', options),
    
    // Funciones de conversión de formato
    convertFormat: (mcpConfig) => ipcRenderer.invoke('mcp:convertFormat', mcpConfig),
    createFromFormat: (mcpConfig) => ipcRenderer.invoke('mcp:createFromFormat', mcpConfig),
    
    // Funciones de conexión MCP real
    connectServer: (serverId) => ipcRenderer.invoke('mcp:connectServer', serverId),
    disconnectServer: (serverId) => ipcRenderer.invoke('mcp:disconnectServer', serverId),
    getConnectionStatus: (serverId) => ipcRenderer.invoke('mcp:getConnectionStatus', serverId)
  },
  policy: {
    addRule: (tool, decision) => ipcRenderer.invoke('policy:addRule', { tool, decision }),
    removeRule: (tool) => ipcRenderer.invoke('policy:removeRule', { tool }),
    listRules: () => ipcRenderer.invoke('policy:listRules')
  }
})
