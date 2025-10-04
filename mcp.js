const { PolicyEngine } = require('./policy')

class MCPAdapter {
  constructor() {
    this.policy = new PolicyEngine()
    this.tools = new Map()
    this.setupMockTools()
  }

  setupMockTools() {
    // Mock tools disponibles
    this.tools.set('filesystem.read', {
      name: 'filesystem.read',
      description: 'Leer contenido de archivo',
      parameters: {
        type: 'object',
        properties: {
          file: { type: 'string', description: 'Ruta del archivo' }
        },
        required: ['file']
      }
    })

    this.tools.set('filesystem.write', {
      name: 'filesystem.write',
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

    this.tools.set('playwright.goto', {
      name: 'playwright.goto',
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

  listTools() {
    return Array.from(this.tools.values())
  }

  async callTool(name, args, sessionId) {
    const tool = this.tools.get(name)
    if (!tool) {
      throw new Error(`Tool '${name}' no encontrada`)
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
        return await this.executeTool(name, args)
      
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

  async executeTool(name, args) {
    // Mock implementations
    switch (name) {
      case 'filesystem.read':
        return {
          success: true,
          result: `Mock: Leyendo archivo ${args.file}`,
          content: `Contenido mock del archivo ${args.file}`
        }
      
      case 'filesystem.write':
        return {
          success: true,
          result: `Mock: Escribiendo a archivo ${args.file}`,
          bytesWritten: args.content?.length || 0
        }
      
      case 'playwright.goto':
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
