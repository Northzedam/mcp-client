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
    // Obtener herramientas mock
    const mockTools = Array.from(this.tools.values()).map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }))

    console.log('MCPAdapter: Herramientas mock disponibles:', mockTools.length)
    console.log('MCPAdapter: Datos MCP recibidos:', mcpToolsData.length)

    // Obtener herramientas MCP reales desde los datos pasados
    const mcpTools = mcpToolsData.map(tool => ({
      type: 'function',
      function: {
        name: this.sanitizeToolName(tool.name),
        description: tool.description,
        parameters: JSON.parse(tool.input_schema || '{}')
      }
    }))

    console.log('MCPAdapter: Herramientas MCP reales formateadas:', mcpTools.length)
    console.log('MCPAdapter: Total herramientas disponibles:', mockTools.length + mcpTools.length)

    return [...mockTools, ...mcpTools]
  }

  sanitizeToolName(name) {
    // Convertir nombres de herramientas para cumplir con el patrón de OpenAI
    // Reemplazar puntos y otros caracteres no válidos con guiones bajos
    return name.replace(/[^a-zA-Z0-9_-]/g, '_')
  }

  async callTool(name, args, sessionId, mcpToolsData = []) {
    const tool = this.tools.get(name)
    if (!tool) {
      // Verificar si es una herramienta MCP real
      const mcpTool = mcpToolsData.find(t => this.sanitizeToolName(t.name) === name)
      if (!mcpTool) {
        throw new Error(`Tool '${name}' no encontrada`)
      }
    }

    // Evaluar política
    const decision = this.policy.evaluate(name, args)
    
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
    // Primero verificar si es una herramienta MCP real
    const mcpTool = mcpToolsData.find(t => this.sanitizeToolName(t.name) === name)
    
    if (mcpTool) {
      console.log(`MCPAdapter: Ejecutando herramienta MCP real: ${mcpTool.name}`)
      // Por ahora, simular ejecución de herramienta MCP real
      return {
        success: true,
        result: `Ejecutando herramienta MCP: ${mcpTool.name}`,
        tool: mcpTool.name,
        args: args
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
