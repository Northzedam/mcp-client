const { PolicyEngine } = require('./policy')

class MCPAdapter {
  constructor() {
    this.policy = new PolicyEngine()
    this.tools = new Map()
    this.setupMockTools()
  }

  setupMockTools() {
    // Mock tools disponibles
    this.tools.set('filesystem_read', {
      name: 'filesystem_read',
      description: 'Leer contenido de archivo',
      parameters: {
        type: 'object',
        properties: {
          file: { type: 'string', description: 'Ruta del archivo' }
        },
        required: ['file']
      }
    })

    this.tools.set('filesystem_write', {
      name: 'filesystem_write',
      description: 'Escribir contenido a archivo',
      parameters: {
        type: 'object',
        properties: {
          file: { type: 'string', description: 'Ruta del archivo' },
          content: { type: 'string', description: 'Contenido a escribir' }
        },
        required: ['file', 'content']
      }
    })

    this.tools.set('playwright_goto', {
      name: 'playwright_goto',
      description: 'Navegar a URL',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL a navegar' }
        },
        required: ['url']
      }
    })

    this.tools.set('web_search', {
      name: 'web_search',
      description: 'Buscar en web',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Término de búsqueda' }
        },
        required: ['query']
      }
    })
  }

  listTools(mcpToolsData = []) {
    console.log('MCPAdapter: Datos MCP recibidos:', mcpToolsData.length)

    // Solo usar herramientas MCP reales (no más mock)
    const mcpTools = mcpToolsData.map(tool => ({
      type: 'function',
      function: {
        name: this.sanitizeToolName(tool.name),
        description: tool.description,
        parameters: JSON.parse(tool.input_schema || '{}')
      }
    }))

    console.log('MCPAdapter: Herramientas MCP reales formateadas:', mcpTools.length)
    console.log('MCPAdapter: Total herramientas disponibles:', mcpTools.length)

    return mcpTools
  }

  sanitizeToolName(name) {
    // Convertir nombres de herramientas para cumplir con el patrón de OpenAI
    // Reemplazar puntos y otros caracteres no válidos con guiones bajos
    return name.replace(/[^a-zA-Z0-9_-]/g, '_')
  }

  async callTool(name, args, sessionId, mcpToolsData = []) {
    console.log(`MCPAdapter: callTool llamado con name="${name}", args=`, args, 'sessionId=', sessionId)
    console.log(`MCPAdapter: mcpToolsData disponibles:`, mcpToolsData.length)
    
    const tool = this.tools.get(name)
    if (!tool) {
      // Verificar si es una herramienta MCP real
      const mcpTool = mcpToolsData.find(t => this.sanitizeToolName(t.name) === name)
      console.log(`MCPAdapter: Buscando herramienta MCP "${name}", encontrada:`, !!mcpTool)
      if (mcpTool) {
        console.log(`MCPAdapter: Herramienta MCP encontrada:`, mcpTool.name, 'serverId:', mcpTool.serverId)
      }
      if (!mcpTool) {
        throw new Error(`Tool '${name}' no encontrada`)
      }
    }

    // Evaluar política
    const decision = this.policy.evaluate(name, args)
    console.log(`MCPAdapter: Decisión de política para "${name}":`, decision)
    
    // Log de la decisión
    if (global.dbInstance) {
      global.dbInstance.logToolDecision({
        sessionId,
        tool: name,
        args,
        decision
      })
    }

    // Aplicar decisión
    switch (decision) {
      case 'ALLOW':
        return await this.executeTool(name, args, mcpToolsData)
      
      case 'REQUIRE_CONFIRMATION':
        // Por ahora, automáticamente DENY hasta que implementemos UI
        return {
          success: false,
          error: 'DENIED (pending UI)',
          decision: 'REQUIRE_CONFIRMATION'
        }
      
      case 'DENY':
        return {
          success: false,
          error: 'DENIED by policy',
          decision: 'DENY'
        }
      
      default:
        return {
          success: false,
          error: 'Unknown decision',
          decision
        }
    }
  }

  async executeTool(name, args, mcpToolsData = []) {
    console.log(`MCPAdapter: executeTool llamado con name="${name}", args=`, args)
    console.log(`MCPAdapter: mcpToolsData en executeTool:`, mcpToolsData.length)
    
    // Primero verificar si es una herramienta MCP real
    const mcpTool = mcpToolsData.find(t => this.sanitizeToolName(t.name) === name)
    console.log(`MCPAdapter: Herramienta MCP encontrada en executeTool:`, !!mcpTool)
    
    if (mcpTool) {
      console.log(`MCPAdapter: Ejecutando herramienta MCP real: ${mcpTool.name} en servidor ${mcpTool.serverId}`)
      
      try {
        // Obtener el MCPManager desde el proceso principal
        const { mcpManager } = require('./main')
        
        if (!mcpManager) {
          throw new Error('MCPManager no disponible')
        }

        // Ejecutar la herramienta usando el MCPManager real
        const result = await mcpManager.executeTool(mcpTool.serverId, mcpTool.name, args, 'chat-session')
        
        return {
          success: true,
          result: result,
          tool: mcpTool.name,
          serverId: mcpTool.serverId
        }
      } catch (error) {
        console.error(`MCPAdapter: Error ejecutando herramienta MCP: ${error.message}`)
        return {
          success: false,
          error: error.message,
          tool: mcpTool.name
        }
      }
    }

    // Si no es una herramienta MCP real, usar implementaciones mock
    switch (name) {
      case 'filesystem_read':
        return {
          success: true,
          result: `Mock: Leyendo archivo ${args.file}`,
          content: `Contenido mock del archivo ${args.file}`
        }
      
      case 'filesystem_write':
        return {
          success: true,
          result: `Mock: Escribiendo a archivo ${args.file}`,
          bytesWritten: args.content?.length || 0
        }
      
      case 'playwright_goto':
        return {
          success: true,
          result: `Mock: Navegando a ${args.url}`,
          title: 'Mock Page Title'
        }
      
      case 'web_search':
        return {
          success: true,
          result: `Mock: Buscando "${args.query}"`,
          results: [
            { title: 'Resultado 1', url: 'https://example.com/1' },
            { title: 'Resultado 2', url: 'https://example.com/2' }
          ]
        }
      
      default:
        throw new Error(`Tool '${name}' no implementada`)
    }
  }

  // Métodos para gestionar políticas
  addPolicyRule(tool, decision) {
    this.policy.addRule(tool, decision)
  }

  removePolicyRule(tool) {
    this.policy.removeRule(tool)
  }

  listPolicyRules() {
    return this.policy.listRules()
  }
}

module.exports = { MCPAdapter };
