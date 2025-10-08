/**
 * MCP Manager - Gestiona conexiones y herramientas MCP reales
 */

const { spawn } = require('child_process');
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const execAsync = promisify(exec);

class MCPManager {
  constructor(dbInstance = null) {
    this.dbInstance = dbInstance;
    this.servers = new Map();
    this.tools = new Map();
    this.connections = new Map();
    this.processes = new Map(); // Procesos MCP activos
  }

  /**
   * Carga servidores desde la base de datos
   */
  async loadServers() {
    try {
      console.log('MCPManager: Cargando servidores...');
      
      if (!this.dbInstance) {
        throw new Error('dbInstance no disponible');
      }
      
      const servers = this.dbInstance.getMCPServers();
      console.log('MCPManager: Servidores obtenidos de la BD:', servers.length);
      
      this.servers.clear();
      
      servers.forEach(server => {
        console.log('MCPManager: Cargando servidor:', server.id, server.name);
        this.servers.set(server.id, server);
      });
      
      console.log('MCPManager: Total servidores cargados:', this.servers.size);
      return servers;
    } catch (error) {
      console.error('Error al cargar servidores MCP:', error);
      throw error;
    }
  }

  /**
   * Carga herramientas de un servidor
   */
  async loadTools(serverId) {
    try {
      if (!this.dbInstance) {
        throw new Error('dbInstance no disponible');
      }
      
      const tools = this.dbInstance.getMCPTools(serverId);
      this.tools.set(serverId, tools);
      return tools;
    } catch (error) {
      console.error(`Error al cargar herramientas del servidor ${serverId}:`, error);
      throw error;
    }
  }

  /**
   * Conecta a un servidor MCP real
   */
  async connectServer(serverId) {
    try {
      console.log('MCPManager: Intentando conectar servidor real:', serverId);
      
      const server = this.servers.get(serverId);
      if (!server) {
        throw new Error(`Servidor ${serverId} no encontrado`);
      }

      if (!server.enabled) {
        throw new Error(`Servidor ${serverId} está deshabilitado`);
      }

      // Actualizar estado a conectando
      this.connections.set(serverId, {
        status: 'connecting',
        connectedAt: new Date(),
        error: null
      });

      // Obtener configuración MCP
      let mcpConfig = {};
      if (server.mcp_config) {
        if (typeof server.mcp_config === 'string') {
          mcpConfig = JSON.parse(server.mcp_config);
        } else {
          mcpConfig = server.mcp_config;
        }
      }
      
      // Si no hay mcp_config, usar args como fallback
      if (!mcpConfig.args && server.args) {
        if (typeof server.args === 'string') {
          mcpConfig.args = JSON.parse(server.args);
        } else {
          mcpConfig.args = server.args;
        }
      }
      
      // Normalizar rutas para Windows
      if (mcpConfig.args) {
        mcpConfig.args = mcpConfig.args.map(arg => {
          if (typeof arg === 'string') {
            // Convertir rutas Unix a Windows
            if (arg === '~/Desktop') {
              return path.join(process.env.USERPROFILE || process.env.HOME, 'Desktop');
            }
            if (arg.startsWith('/path/to/')) {
              return path.join(process.env.USERPROFILE || process.env.HOME, 'Documents');
            }
          }
          return arg;
        });
      }
      
      console.log('MCPManager: Servidor completo:', server);
      console.log('MCPManager: Configuración MCP:', mcpConfig);

      // Instalar servidor MCP si es necesario
      await this.ensureMCPServerInstalled(mcpConfig);

      // Ejecutar servidor MCP
      const childProcess = await this.startMCPServer(serverId, mcpConfig);
      this.processes.set(serverId, childProcess);

      // Inicializar comunicación MCP
      await this.initializeMCPCommunication(serverId, childProcess);

      // Descubrir herramientas
      await this.discoverTools(serverId);

      // Actualizar estado a conectado
      this.connections.set(serverId, {
        status: 'connected',
        connectedAt: new Date(),
        error: null
      });

      // Actualizar estado en la base de datos
      if (this.dbInstance) {
        this.dbInstance.updateMCPServer(serverId, { 
          status: 'connected',
          last_connected: new Date().toISOString()
        });
      }

      console.log('MCPManager: Servidor MCP conectado exitosamente:', serverId);
      return { success: true, serverId };
    } catch (error) {
      console.error('MCPManager: Error al conectar servidor MCP:', error);
      this.connections.set(serverId, {
        status: 'error',
        connectedAt: null,
        error: error.message
      });

      // Actualizar estado de error en la base de datos
      if (this.dbInstance) {
        this.dbInstance.updateMCPServer(serverId, { 
          status: 'error',
          error_message: error.message
        });
      }

      throw error;
    }
  }

  /**
   * Asegura que el servidor MCP esté instalado
   */
  async ensureMCPServerInstalled(mcpConfig) {
    try {
      // Buscar el primer argumento que sea un paquete npm
      const packageName = mcpConfig.args?.find(arg => arg.startsWith('@') || arg.startsWith('mcp-'));
      
      if (!packageName) {
        console.log('MCPManager: No se detectó paquete npm para instalar');
        return;
      }

      console.log(`MCPManager: Verificando instalación de ${packageName}...`);
      
      try {
        // Verificar si está instalado globalmente
        await execAsync(`npm list -g ${packageName}`);
        console.log(`MCPManager: ${packageName} ya está instalado`);
      } catch (error) {
        // No está instalado, instalarlo
        console.log(`MCPManager: Instalando ${packageName}...`);
        await execAsync(`npm install -g ${packageName}`);
        console.log(`MCPManager: ${packageName} instalado exitosamente`);
      }
    } catch (error) {
      console.error('MCPManager: Error instalando servidor MCP:', error);
      throw error;
    }
  }

  /**
   * Inicia un servidor MCP como proceso
   */
  async startMCPServer(serverId, mcpConfig) {
    try {
      console.log('MCPManager: Iniciando proceso MCP:', mcpConfig.command, mcpConfig.args);
      
      const childProcess = spawn(mcpConfig.command, mcpConfig.args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...mcpConfig.env },
        shell: true, // Necesario para Windows
        windowsHide: true // Ocultar ventana de consola en Windows
      });

      // Capturar errores de stderr
      childProcess.stderr.on('data', (data) => {
        console.error(`MCPManager: Error stderr ${serverId}:`, data.toString());
      });

      // Manejar errores del proceso
      childProcess.on('error', (error) => {
        console.error(`MCPManager: Error en proceso MCP ${serverId}:`, error);
        this.connections.set(serverId, {
          status: 'error',
          connectedAt: null,
          error: error.message
        });
      });

      childProcess.on('exit', (code) => {
        console.log(`MCPManager: Proceso MCP ${serverId} terminó con código:`, code);
        this.connections.set(serverId, {
          status: 'disconnected',
          connectedAt: null,
          error: code !== 0 ? `Proceso terminó con código ${code}` : null
        });
        this.processes.delete(serverId);
      });

      return childProcess;
    } catch (error) {
      console.error('MCPManager: Error iniciando proceso MCP:', error);
      throw error;
    }
  }

  /**
   * Inicializa la comunicación MCP
   */
  async initializeMCPCommunication(serverId, process) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout inicializando comunicación MCP'));
      }, 10000);

      let initialized = false;

      // Escuchar respuestas del servidor MCP
      process.stdout.on('data', (data) => {
        try {
          const messages = data.toString().split('\n').filter(Boolean);
          messages.forEach(message => {
            const response = JSON.parse(message);
            console.log('MCPManager: Respuesta MCP:', JSON.stringify(response, null, 2));
            
            if (response.id === 1 && response.result && !initialized) {
              initialized = true;
              clearTimeout(timeout);
              console.log('MCPManager: Comunicación MCP inicializada');
              resolve();
            }
          });
        } catch (error) {
          console.error('MCPManager: Error parseando respuesta MCP:', error);
        }
      });

      // Enviar mensaje de inicialización
      const initMessage = {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {}
          },
          clientInfo: {
            name: "MCP-Agent",
            version: "1.0.0"
          }
        }
      };

      console.log('MCPManager: Enviando inicialización MCP:', initMessage);
      process.stdin.write(JSON.stringify(initMessage) + '\n');
    });
  }

  /**
   * Descubre herramientas de un servidor MCP
   */
  async discoverTools(serverId) {
    try {
      const process = this.processes.get(serverId);
      if (!process) {
        throw new Error(`Proceso MCP no encontrado para servidor ${serverId}`);
      }

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout descubriendo herramientas'));
        }, 5000);

        process.stdout.once('data', (data) => {
          try {
            const messages = data.toString().split('\n').filter(Boolean);
            messages.forEach(message => {
              const response = JSON.parse(message);
              if (response.id === 2 && response.result) {
                clearTimeout(timeout);
                const tools = response.result.tools || [];
                console.log(`MCPManager: Herramientas descubiertas en ${serverId}:`, tools.length);
                
                // Guardar herramientas en la base de datos
                this.saveToolsToDatabase(serverId, tools);
                resolve(tools);
              }
            });
          } catch (error) {
            console.error('MCPManager: Error parseando herramientas:', error);
            reject(error);
          }
        });

        // Solicitar lista de herramientas
        const toolsMessage = {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/list"
        };

        console.log('MCPManager: Solicitando herramientas MCP:', toolsMessage);
        process.stdin.write(JSON.stringify(toolsMessage) + '\n');
      });
    } catch (error) {
      console.error(`Error al descubrir herramientas del servidor ${serverId}:`, error);
      throw error;
    }
  }

  /**
   * Guarda herramientas en la base de datos
   */
  async saveToolsToDatabase(serverId, tools) {
    try {
      if (!this.dbInstance) {
        throw new Error('dbInstance no disponible');
      }
      
      for (const tool of tools) {
        this.dbInstance.createMCPTool({
          mcp_server_id: serverId,
          name: tool.name,
          description: tool.description,
          input_schema: JSON.stringify(tool.inputSchema || {})
        });
      }
      
      // Actualizar cache local
      this.tools.set(serverId, tools);
      
      console.log(`MCPManager: ${tools.length} herramientas guardadas en BD`);
    } catch (error) {
      console.error('MCPManager: Error guardando herramientas:', error);
    }
  }

  /**
   * Ejecuta una herramienta MCP real
   */
  async executeTool(serverId, toolName, args, sessionId) {
    try {
      const process = this.processes.get(serverId);
      if (!process) {
        throw new Error(`Proceso MCP no encontrado para servidor ${serverId}`);
      }

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout ejecutando herramienta'));
        }, 30000);

        const requestId = Date.now();

        process.stdout.once('data', (data) => {
          try {
            const messages = data.toString().split('\n').filter(Boolean);
            messages.forEach(message => {
              const response = JSON.parse(message);
              if (response.id === requestId && response.result) {
                clearTimeout(timeout);
                console.log('MCPManager: Herramienta ejecutada exitosamente:', toolName);
                console.log('MCPManager: Resultado completo de la herramienta:', JSON.stringify(response.result, null, 2));
                resolve(response.result);
              } else if (response.id === requestId && response.error) {
                clearTimeout(timeout);
                reject(new Error(response.error.message));
              }
            });
          } catch (error) {
            console.error('MCPManager: Error parseando resultado:', error);
            reject(error);
          }
        });

        // Ejecutar herramienta
        const toolMessage = {
          jsonrpc: "2.0",
          id: requestId,
          method: "tools/call",
          params: {
            name: toolName,
            arguments: args
          }
        };

        console.log('MCPManager: Ejecutando herramienta MCP:', toolMessage);
        process.stdin.write(JSON.stringify(toolMessage) + '\n');
      });
    } catch (error) {
      console.error(`Error ejecutando herramienta ${toolName}:`, error);
      throw error;
    }
  }

  /**
   * Desconecta un servidor MCP
   */
  async disconnectServer(serverId) {
    try {
      const process = this.processes.get(serverId);
      if (process) {
        process.kill();
        this.processes.delete(serverId);
      }

      this.connections.set(serverId, {
        status: 'disconnected',
        connectedAt: null,
        error: null
      });

      console.log(`MCPManager: Servidor ${serverId} desconectado`);
    } catch (error) {
      console.error(`Error desconectando servidor ${serverId}:`, error);
      throw error;
    }
  }

  /**
   * Obtiene el estado de conexión de un servidor
   */
  getConnectionStatus(serverId) {
    return this.connections.get(serverId) || {
      status: 'disconnected',
      connectedAt: null,
      error: null
    };
  }

  /**
   * Obtiene todas las herramientas disponibles
   */
  getAllTools() {
    const allTools = [];
    for (const [serverId, tools] of this.tools) {
      const server = this.servers.get(serverId);
      const connection = this.connections.get(serverId);
      
      tools.forEach(tool => {
        allTools.push({
          ...tool,
          serverId,
          serverName: server?.name,
          connected: connection?.status === 'connected'
        });
      });
    }
    return allTools;
  }

  /**
   * Conecta todos los servidores habilitados
   */
  async connectEnabledServers() {
    console.log('MCPManager: Conectando servidores habilitados...');
    
    for (const [serverId, server] of this.servers) {
      if (server.enabled) {
        try {
          console.log(`MCPManager: Conectando servidor habilitado: ${server.name}`);
          await this.connectServer(serverId);
        } catch (error) {
          console.error(`Error conectando servidor ${serverId}:`, error);
        }
      }
    }
  }

  /**
   * Reinicia todas las conexiones
   */
  async restartConnections() {
    console.log('MCPManager: Reiniciando conexiones MCP...');
    
    // Desconectar todas las conexiones activas
    for (const [serverId, process] of this.processes) {
      try {
        process.kill();
      } catch (error) {
        console.error(`Error matando proceso ${serverId}:`, error);
      }
    }
    
    this.processes.clear();
    this.connections.clear();
    
    // Reconectar servidores habilitados
    await this.connectEnabledServers();
  }
}

// Exportar para uso en el renderer
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MCPManager };
} else {
  window.MCPManager = MCPManager;
}
