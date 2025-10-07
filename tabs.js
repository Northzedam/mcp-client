class TabsManager {
  constructor() {
    this.tabButtons = null;
    this.tabContents = null;
    this.activeTab = 'chat';
    
    this.initializeElements();
    this.setupEventListeners();
  }

  initializeElements() {
    this.tabButtons = document.querySelectorAll('.tab-button');
    this.tabContents = document.querySelectorAll('.tab-content');
    
    console.log('TabsManager: Elementos inicializados', {
      buttons: this.tabButtons.length,
      contents: this.tabContents.length
    });
  }

  setupEventListeners() {
    this.tabButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const tabName = e.currentTarget.dataset.tab;
        this.switchTab(tabName);
      });
    });

    console.log('TabsManager: Event listeners configurados');
  }

  switchTab(tabName) {
    console.log('TabsManager: Cambiando a pestaña:', tabName);
    
    // Remover clase active de todos los botones
    this.tabButtons.forEach(button => {
      button.classList.remove('active');
    });
    
    // Remover clase active de todos los contenidos FORZADAMENTE
    this.tabContents.forEach(content => {
      content.classList.remove('active');
      // Forzar ocultamiento
      content.style.display = 'none';
    });
    
    // Agregar clase active al botón seleccionado
    const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeButton) {
      activeButton.classList.add('active');
    }
    
    // Agregar clase active al contenido seleccionado y mostrarlo FORZADAMENTE
    const activeContent = document.getElementById(`${tabName}Tab`);
    if (activeContent) {
      activeContent.classList.add('active');
      // Forzar visualización
      activeContent.style.display = 'flex';
    }
    
    this.activeTab = tabName;
    
    // Emitir evento personalizado
    this.dispatchTabChangeEvent(tabName);
    
    console.log('TabsManager: Pestaña cambiada a:', tabName);
    console.log('TabsManager: Contenido activo:', activeContent ? activeContent.id : 'ninguno');
  }

  dispatchTabChangeEvent(tabName) {
    const event = new CustomEvent('tabChanged', {
      detail: { tabName }
    });
    document.dispatchEvent(event);
    
    // Inicializar MCP UI si se cambia a la pestaña MCP
    if (tabName === 'mcp' && !window.mcpUIInstance) {
      this.initializeMCPUI();
    }
  }

  initializeMCPUI() {
    try {
      const mcpContainer = document.getElementById('mcpContainer');
      if (mcpContainer && window.MCPUI) {
        window.mcpUIInstance = new MCPUI('mcpContainer');
        console.log('MCP UI inicializada correctamente');
      }
    } catch (error) {
      console.error('Error al inicializar MCP UI:', error);
    }
  }

  getActiveTab() {
    return this.activeTab;
  }

  setActiveTab(tabName) {
    this.switchTab(tabName);
  }

  // Método para integrar con el modo selector
  updateMCPTabVisibility(mode) {
    const mcpButton = document.querySelector('[data-tab="mcp"]');
    if (mcpButton) {
      if (mode === 'agent') {
        mcpButton.style.display = 'flex';
      } else {
        mcpButton.style.display = 'none';
        // Si estamos en la pestaña MCP y cambiamos a modo 'ask', cambiar a chat
        if (this.activeTab === 'mcp') {
          this.switchTab('chat');
        }
      }
    }
  }
}

// Exportar para uso global
window.TabsManager = TabsManager;
