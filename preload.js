const { contextBridge, ipcRenderer } = require('electron')

// Exponer API segura al renderer process
contextBridge.exposeInMainWorld('api', {
  sessions: {
    list: () => ipcRenderer.invoke('sessions:list'),
    create: (title) => ipcRenderer.invoke('sessions:create', title)
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
    listTools: () => ipcRenderer.invoke('mcp:listTools'),
    callTool: (name, args, sessionId) => ipcRenderer.invoke('mcp:callTool', { name, args, sessionId })
  },
  policy: {
    addRule: (tool, decision) => ipcRenderer.invoke('policy:addRule', { tool, decision }),
    removeRule: (tool) => ipcRenderer.invoke('policy:removeRule', { tool }),
    listRules: () => ipcRenderer.invoke('policy:listRules')
  }
})
