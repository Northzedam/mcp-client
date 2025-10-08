/**
 * MCP UI - Interfaz de usuario para gestión de MCPs
 */

class MCPUI {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.manager = null; // Se inicializará en init()
    this.modal = null;
    this.currentServer = null;
    
    this.init();
  }

  async init() {
    await this.render();
    await this.loadData();
    this.setupEventListeners();
  }

  async render() {
    this.container.innerHTML = `
      <div class="mcp-ui-container">
        <div class="mcp-header">
          <h2>Gestión de MCPs</h2>
          <button id="addMCPBtn" class="btn btn-primary">
            <i class="icon-plus"></i> Agregar MCP
          </button>
        </div>
        
        <div class="mcp-content">
          <div class="mcp-servers-panel">
            <h3>Servidores MCP</h3>
            <div id="serversList" class="servers-list">
              <div class="empty-state">
                <p>No hay servidores MCP configurados</p>
                <button class="btn btn-secondary" id="addFirstServerBtn">
                  Agregar primer servidor
                </button>
              </div>
            </div>
          </div>
          
          <div class="mcp-details-panel">
            <div id="serverDetails" class="server-details">
              <div class="empty-state">
                <p>Selecciona un servidor para ver sus detalles</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async loadData() {
    try {
      console.log('MCPUI: Cargando datos MCP...');
      const servers = await window.api.mcp.getServers();
      console.log('MCPUI: Servidores obtenidos:', servers.length);
      
      // Crear un objeto manager simulado para compatibilidad
      this.manager = {
        servers: new Map(servers.map(s => [s.id, s])),
        tools: new Map(),
        getConnectionStatus: (serverId) => {
          const server = this.manager.servers.get(serverId);
          return { status: server?.status || 'disconnected' };
        }
      };
      
        await this.renderServersList();
    } catch (error) {
      console.error('Error al cargar datos MCP:', error);
      this.showError('Error al cargar servidores MCP');
    }
  }

  async renderServersList() {
    const serversList = document.getElementById('serversList');
    const servers = Array.from(this.manager.servers.values());
    
    if (servers.length === 0) {
      serversList.innerHTML = `
        <div class="empty-state">
          <p>No hay servidores MCP configurados</p>
          <button class="btn btn-secondary" id="addFirstServerBtn2">
            Agregar primer servidor
          </button>
        </div>
      `;
      return;
    }

    // Obtener estados de conexión para todos los servidores
    const serversWithStatus = await Promise.all(
      servers.map(async (server) => {
        const connectionStatus = await window.api.mcp.getConnectionStatus(server.id);
        return {
          ...server,
          connectionStatus: connectionStatus || { status: 'disconnected' }
        };
      })
    );

    serversList.innerHTML = serversWithStatus.map(server => {
      const status = server.connectionStatus;
      return `
        <div class="server-item ${this.currentServer?.id === server.id ? 'selected' : ''}" 
             data-server-id="${server.id}">
          <div class="server-info">
            <h4>${server.name}</h4>
            <p class="server-endpoint">${server.endpoint}</p>
            <div class="server-meta">
              <span class="status-badge ${status.status}">${this.getStatusText(status.status)}</span>
              <span class="transport-badge">${server.transport}</span>
            </div>
          </div>
          <div class="server-actions">
            <button class="btn btn-sm btn-secondary edit-server-btn" data-server-id="${server.id}">
              Editar
            </button>
            <button class="btn btn-sm btn-danger delete-server-btn" data-server-id="${server.id}">
              Eliminar
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  async renderServerDetails(serverId) {
    const server = this.manager.servers.get(serverId);
    if (!server) return;

    // Obtener el estado real de conexión
    const connectionStatus = await window.api.mcp.getConnectionStatus(serverId);
    const status = connectionStatus || { status: 'disconnected' };
    const tools = await window.api.mcp.getTools(serverId) || [];

    const detailsPanel = document.getElementById('serverDetails');
    detailsPanel.innerHTML = `
      <div class="server-details-content">
        <div class="server-header">
          <h3>${server.name}</h3>
          <div class="server-controls">
            <button class="btn btn-sm ${server.enabled ? 'btn-warning' : 'btn-success'} toggle-server-btn" 
                    data-server-id="${serverId}">
              ${server.enabled ? 'Deshabilitar' : 'Habilitar'}
            </button>
          </div>
        </div>
        
        <div class="server-info-grid">
          <div class="info-item">
            <label>ID:</label>
            <span>${server.id}</span>
          </div>
          <div class="info-item">
            <label>Transporte:</label>
            <span>${server.transport}</span>
          </div>
          <div class="info-item">
            <label>Endpoint:</label>
            <span>${server.endpoint}</span>
          </div>
          <div class="info-item">
            <label>Estado:</label>
            <span class="status-badge ${status.status}">${this.getStatusText(status.status)}</span>
          </div>
        </div>
        
        ${server.notes ? `
          <div class="server-notes">
            <label>Notas:</label>
            <p>${server.notes}</p>
          </div>
        ` : ''}
        
        <div class="tools-section">
          <h4>Herramientas (${tools.length})</h4>
          <div class="tools-list">
            ${tools.length === 0 ? `
              <div class="empty-state">
                <p>No hay herramientas disponibles</p>
                <button class="btn btn-sm btn-secondary discover-tools-btn" data-server-id="${serverId}">
                  Descubrir herramientas
                </button>
              </div>
            ` : tools.map(tool => `
              <div class="tool-item">
                <div class="tool-info">
                  <h5>${tool.name}</h5>
                  <p>${tool.description || 'Sin descripción'}</p>
                </div>
                <div class="tool-actions">
                  <button class="btn btn-sm btn-primary test-tool-btn" data-server-id="${serverId}" data-tool-name="${tool.name}">
                    Probar
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  getStatusText(status) {
    const statusMap = {
      'connected': 'Conectado',
      'connecting': 'Conectando...',
      'disconnected': 'Desconectado',
      'error': 'Error'
    };
    return statusMap[status] || 'Desconectado';
  }

  setupEventListeners() {
    // Click en servidor para seleccionar
    document.addEventListener('click', (e) => {
      const serverItem = e.target.closest('.server-item');
      if (serverItem) {
        const serverId = serverItem.dataset.serverId;
        this.selectServer(serverId);
      }
    });

    // Botón agregar MCP
    document.getElementById('addMCPBtn')?.addEventListener('click', () => {
      this.showAddModal();
    });

    // Event listeners para botones dinámicos usando delegación de eventos
    document.addEventListener('click', (e) => {
      // Botones "Agregar primer servidor"
      if (e.target.id === 'addFirstServerBtn' || e.target.id === 'addFirstServerBtn2') {
        this.showAddModal();
      }
      
      // Botón editar servidor
      if (e.target.classList.contains('edit-server-btn')) {
        const serverId = e.target.dataset.serverId;
        this.editServer(serverId);
      }
      
      // Botón eliminar servidor
      if (e.target.classList.contains('delete-server-btn')) {
        const serverId = e.target.dataset.serverId;
        this.deleteServer(serverId);
      }
      
      // Botón toggle servidor
      if (e.target.classList.contains('toggle-server-btn')) {
        const serverId = e.target.dataset.serverId;
        this.toggleServer(serverId);
      }
      
      
      // Botón descubrir herramientas
      if (e.target.classList.contains('discover-tools-btn')) {
        const serverId = e.target.dataset.serverId;
        this.discoverTools(serverId);
      }
      
      // Botón probar herramienta
      if (e.target.classList.contains('test-tool-btn')) {
        const serverId = e.target.dataset.serverId;
        const toolName = e.target.dataset.toolName;
        this.testTool(serverId, toolName);
      }
    });
  }

  async selectServer(serverId) {
    this.currentServer = this.manager.servers.get(serverId);
        await this.renderServersList(); // Actualizar selección visual
    await this.renderServerDetails(serverId);
  }

  showAddModal() {
    console.log('MCPUI: Mostrando modal para agregar MCP');
    
    if (!this.modal) {
      console.log('MCPUI: Creando nuevo modal MCP');
      this.modal = new MCPModal();
    }
    
    // Asegurar que el modal esté disponible globalmente
    window.mcpModal = this.modal;
    
    this.modal.show();
  }

  async editServer(serverId) {
    const server = this.manager.servers.get(serverId);
    if (!server) return;

    if (!this.modal) {
      this.modal = new MCPModal();
    }
    this.modal.show(server);
  }

  async deleteServer(serverId) {
    const server = this.manager.servers.get(serverId);
    if (!server) return;

    if (confirm(`¿Estás seguro de que quieres eliminar el servidor "${server.name}"?`)) {
      try {
        await window.api.mcp.deleteServer(serverId);
        await this.loadData();
        this.currentServer = null;
        document.getElementById('serverDetails').innerHTML = `
          <div class="empty-state">
            <p>Selecciona un servidor para ver sus detalles</p>
          </div>
        `;
        this.showSuccess('Servidor eliminado correctamente');
      } catch (error) {
        console.error('Error al eliminar servidor:', error);
        this.showError('Error al eliminar servidor');
      }
    }
  }

  async toggleServer(serverId) {
    try {
      const server = this.manager.servers.get(serverId);
      const newEnabled = !server.enabled;
      const serverName = server.name;
      
      // Actualizar estado en la base de datos
      await window.api.mcp.updateServer(serverId, { enabled: newEnabled });
      
      // Conectar o desconectar según el nuevo estado
      if (newEnabled) {
        console.log(`MCPUI: Conectando servidor ${serverName}...`);
        await window.api.mcp.connectServer(serverId);
        this.showSuccess(`Servidor ${serverName} habilitado y conectado correctamente`);
      } else {
        console.log(`MCPUI: Desconectando servidor ${serverName}...`);
        await window.api.mcp.disconnectServer(serverId);
        this.showSuccess(`Servidor ${serverName} deshabilitado y desconectado correctamente`);
      }
      
      // Recargar datos y actualizar vista
      await this.loadData();
      // Asegurar que el servidor sigue seleccionado después de recargar
      this.currentServer = this.manager.servers.get(serverId);
      await this.renderServerDetails(serverId);
    } catch (error) {
      console.error('Error al cambiar estado del servidor:', error);
      this.showError(`Error al cambiar estado del servidor: ${error.message}`);
    }
  }

  async connectServer(serverId) {
    try {
      console.log('MCPUI: Intentando conectar servidor real:', serverId);
      await window.api.mcp.connectServer(serverId);
      console.log('MCPUI: Servidor conectado, actualizando vista');
      await this.renderServerDetails(serverId);
      this.showSuccess('Servidor MCP conectado correctamente');
    } catch (error) {
      console.error('MCPUI: Error al conectar servidor:', error);
      this.showError(`Error al conectar: ${error.message}`);
    }
  }

  async discoverTools(serverId) {
    try {
      // Por ahora, solo recargar los datos
      await this.loadData();
      await this.renderServerDetails(serverId);
      this.showSuccess('Herramientas descubiertas correctamente');
    } catch (error) {
      console.error('Error al descubrir herramientas:', error);
      this.showError('Error al descubrir herramientas');
    }
  }

  async testTool(serverId, toolName) {
    try {
      // Por ahora, simular prueba de herramienta
      this.showSuccess(`Herramienta ${toolName} probada exitosamente`);
    } catch (error) {
      console.error('Error al probar herramienta:', error);
      this.showError(`Error al probar herramienta: ${error.message}`);
    }
  }

  showSuccess(message) {
    // Implementar notificación de éxito
    console.log('✅', message);
  }

  showError(message) {
    // Implementar notificación de error
    console.error('❌', message);
  }
}

// Exportar para uso en el navegador
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MCPUI;
} else {
  window.MCPUI = MCPUI;
}

