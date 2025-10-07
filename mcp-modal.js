/**
 * MCP Modal - Modal para agregar/editar configuraciones MCP
 */

class MCPModal {
  constructor() {
    this.modal = null;
    this.currentServer = null;
    this.validator = new MCPValidator();
    this.examples = new MCPExamples();
    this.init();
  }

  init() {
    this.createModal();
    this.setupEventListeners();
  }

  createModal() {
    console.log('MCPModal: Creando modal...');
    
    // Crear overlay
    const overlay = document.createElement('div');
    overlay.className = 'mcp-modal-overlay';
    overlay.id = 'mcpModalOverlay';

    // Crear modal
    const modal = document.createElement('div');
    modal.className = 'mcp-modal';
    modal.innerHTML = `
      <div class="mcp-modal-header">
        <h3 id="modalTitle">Agregar MCP</h3>
        <button class="mcp-modal-close" id="modalCloseBtn">&times;</button>
      </div>
      
      <div class="mcp-modal-content">
        <div class="mcp-modal-tabs">
          <button class="tab-btn active" data-tab="editor">Editor JSON</button>
          <button class="tab-btn" data-tab="examples">Ejemplos</button>
          <button class="tab-btn" data-tab="help">Ayuda</button>
        </div>
        
        <div class="tab-content">
          <!-- Editor JSON -->
          <div id="editorTab" class="tab-panel active">
            <div class="json-editor-container">
              <div class="json-editor-header">
                <label for="jsonInput">Configuración MCP (formato estándar):</label>
                <div class="json-editor-actions">
                  <button id="validateBtn" class="btn btn-secondary">Validar</button>
                  <button id="formatBtn" class="btn btn-secondary">Formatear</button>
                </div>
              </div>
              <textarea id="jsonInput" class="json-editor" placeholder='{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/files"]
    }
  }
}'></textarea>
              <div id="validationResult" class="validation-result"></div>
            </div>
          </div>
          
          <!-- Ejemplos -->
          <div id="examplesTab" class="tab-panel">
            <div class="examples-container">
              <h4>Ejemplos de Configuración</h4>
              <div class="examples-grid" id="examplesGrid">
                <!-- Los ejemplos se cargarán dinámicamente -->
              </div>
            </div>
          </div>
          
          <!-- Ayuda -->
          <div id="helpTab" class="tab-panel">
            <div class="help-container">
              <h4>Formato de Configuración MCP</h4>
              <p>El formato estándar MCP permite configurar múltiples servidores en un solo JSON:</p>
              
              <h5>Estructura básica:</h5>
              <pre><code>{
  "mcpServers": {
    "server-id": {
      "command": "npx",
      "args": ["-y", "package-name"],
      "env": {
        "API_KEY": "your-key"
      }
    }
  }
}</code></pre>
              
              <h5>Tipos de conexión:</h5>
              <ul>
                <li><strong>stdio:</strong> Proceso local con comando y argumentos</li>
                <li><strong>websocket:</strong> Servidor remoto con URL</li>
              </ul>
              
              <h5>Campos disponibles:</h5>
              <ul>
                <li><code>command</code>: Comando para ejecutar (stdio)</li>
                <li><code>args</code>: Argumentos del comando (array)</li>
                <li><code>env</code>: Variables de entorno (objeto)</li>
                <li><code>url</code>: URL del servidor (websocket)</li>
                <li><code>headers</code>: Headers HTTP (websocket)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      
      <div class="mcp-modal-footer">
        <button id="cancelBtn" class="btn btn-secondary">Cancelar</button>
        <button id="saveBtn" class="btn btn-primary" disabled>Guardar</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    this.modal = overlay;
    
    // Cargar ejemplos después de que el modal esté en el DOM
    setTimeout(() => {
      this.loadExamples();
    }, 100);
  }

  setupEventListeners() {
    // Cerrar modal
    document.getElementById('modalCloseBtn')?.addEventListener('click', () => this.hide());
    document.getElementById('cancelBtn')?.addEventListener('click', () => this.hide());
    
    // Cerrar con overlay
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.hide();
      }
    });

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    // Validar JSON
    document.getElementById('validateBtn')?.addEventListener('click', () => {
      this.validateJSON();
    });

    // Formatear JSON
    document.getElementById('formatBtn')?.addEventListener('click', () => {
      this.formatJSON();
    });

    // Guardar
    document.getElementById('saveBtn')?.addEventListener('click', () => {
      this.saveMCP();
    });

    // Validación en tiempo real
    document.getElementById('jsonInput')?.addEventListener('input', () => {
      this.debounceValidation();
    });
  }

  show(server = null) {
    console.log('MCPModal: Mostrando modal...', { server: !!server });
    
    this.currentServer = server;
    
    if (server) {
      document.getElementById('modalTitle').textContent = 'Editar MCP';
      document.getElementById('jsonInput').value = JSON.stringify(server.mcp_config || {}, null, 2);
    } else {
      document.getElementById('modalTitle').textContent = 'Agregar MCP';
      document.getElementById('jsonInput').value = '';
    }
    
    this.modal.style.display = 'flex';
    
    // Verificar que los elementos existan
    const jsonInput = document.getElementById('jsonInput');
    const examplesGrid = document.getElementById('examplesGrid');
    
    console.log('MCPModal: Elementos del modal:', {
      modal: !!this.modal,
      jsonInput: !!jsonInput,
      examplesGrid: !!examplesGrid
    });
    
    if (jsonInput) {
      jsonInput.focus();
      this.validateJSON();
    }
    
    // Recargar ejemplos si es necesario
    if (examplesGrid && examplesGrid.innerHTML.trim() === '') {
      this.loadExamples();
    }
  }

  hide() {
    this.modal.style.display = 'none';
    this.currentServer = null;
    document.getElementById('jsonInput').value = '';
    document.getElementById('validationResult').innerHTML = '';
    document.getElementById('saveBtn').disabled = true;
  }

  switchTab(tabName) {
    console.log('MCPModal: Cambiando a pestaña:', tabName);
    
    // Actualizar botones de tab
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Actualizar paneles
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `${tabName}Tab`);
    });
    
    console.log('MCPModal: Pestaña cambiada a:', tabName);
  }

  loadExamples() {
    const examplesGrid = document.getElementById('examplesGrid');
    const allExamples = this.examples.getAllExamples();
    
    console.log('MCPModal: Cargando ejemplos...', {
      examplesGrid: !!examplesGrid,
      examplesCount: allExamples.length
    });
    
    if (!examplesGrid) {
      console.error('MCPModal: No se encontró examplesGrid');
      return;
    }
    
    examplesGrid.innerHTML = allExamples.map(example => `
      <div class="example-card" data-example-id="${example.id}">
        <h5>${example.name}</h5>
        <p>${example.description}</p>
        <button class="btn btn-sm btn-primary use-example-btn" data-example-id="${example.id}">
          Usar este ejemplo
        </button>
      </div>
    `).join('');
    
    // Agregar event listeners a los botones
    examplesGrid.querySelectorAll('.use-example-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const exampleId = e.target.dataset.exampleId;
        this.loadExample(exampleId);
      });
    });
    
    console.log('MCPModal: Ejemplos cargados correctamente');
  }

  loadExample(exampleId) {
    console.log('MCPModal: Cargando ejemplo:', exampleId);
    
    const example = this.examples.getExample(exampleId);
    if (example) {
      console.log('MCPModal: Ejemplo encontrado:', example.name);
      
      const jsonInput = document.getElementById('jsonInput');
      if (jsonInput) {
        jsonInput.value = JSON.stringify(example.config, null, 2);
        this.switchTab('editor');
        this.validateJSON();
        console.log('MCPModal: Ejemplo cargado en el editor');
      } else {
        console.error('MCPModal: No se encontró jsonInput');
      }
    } else {
      console.error('MCPModal: Ejemplo no encontrado:', exampleId);
    }
  }

  validateJSON() {
    const jsonInput = document.getElementById('jsonInput');
    const validationResult = document.getElementById('validationResult');
    const saveBtn = document.getElementById('saveBtn');
    
    const jsonString = jsonInput.value.trim();
    
    if (!jsonString) {
      validationResult.innerHTML = '<div class="validation-info">Ingresa una configuración JSON</div>';
      saveBtn.disabled = true;
      return;
    }

    const result = this.validator.validate(jsonString);
    
    if (result.valid) {
      validationResult.innerHTML = `
        <div class="validation-success">
          ✅ Configuración válida (${result.format} format)
          ${result.serverCount ? `- ${result.serverCount} servidor(es) detectado(s)` : ''}
        </div>
      `;
      saveBtn.disabled = false;
    } else {
      validationResult.innerHTML = `
        <div class="validation-error">
          ❌ Errores encontrados:
          <ul>
            ${result.errors.map(error => `<li>${error}</li>`).join('')}
          </ul>
        </div>
      `;
      saveBtn.disabled = true;
    }

    if (result.warnings && result.warnings.length > 0) {
      validationResult.innerHTML += `
        <div class="validation-warning">
          ⚠️ Advertencias:
          <ul>
            ${result.warnings.map(warning => `<li>${warning}</li>`).join('')}
          </ul>
        </div>
      `;
    }
  }

  formatJSON() {
    const jsonInput = document.getElementById('jsonInput');
    const jsonString = jsonInput.value.trim();
    
    if (!jsonString) return;
    
    try {
      const parsed = JSON.parse(jsonString);
      jsonInput.value = JSON.stringify(parsed, null, 2);
      this.validateJSON();
    } catch (error) {
      this.showError('JSON inválido, no se puede formatear');
    }
  }

  debounceValidation() {
    clearTimeout(this.validationTimeout);
    this.validationTimeout = setTimeout(() => {
      this.validateJSON();
    }, 500);
  }

  async saveMCP() {
    const jsonInput = document.getElementById('jsonInput');
    const jsonString = jsonInput.value.trim();
    
    if (!jsonString) {
      this.showError('No hay configuración para guardar');
      return;
    }

    const result = this.validator.validate(jsonString);
    if (!result.valid) {
      this.showError('La configuración no es válida');
      return;
    }

    try {
      const config = JSON.parse(jsonString);
      
      if (result.format === 'mcp') {
        // Crear servidores desde formato MCP
        const serverIds = await window.api.mcp.createFromFormat(config);
        this.showSuccess(`${serverIds.length} servidor(es) creado(s) correctamente`);
      } else {
        // Crear servidor individual
        const serverData = this.validator.convertMCPToInternal({ mcpServers: { [config.id]: config } })[0];
        const serverId = await window.api.mcp.createServer(serverData);
        this.showSuccess('Servidor creado correctamente');
      }
      
      this.hide();
      
      // Notificar a la UI principal para recargar
      if (window.mcpUIInstance) {
        await window.mcpUIInstance.loadData();
      }
      
    } catch (error) {
      console.error('Error al guardar MCP:', error);
      this.showError(`Error al guardar: ${error.message}`);
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
  module.exports = MCPModal;
} else {
  window.MCPModal = MCPModal;
}

