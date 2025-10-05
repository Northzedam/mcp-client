// Global mode state
let currentMode = 'ask';

class UIManager {
  constructor() {
    this.modeSelect = null;
    this.tabsManager = null;
    this.initializeElements();
    this.setupEventListeners();
    this.initializeMode();
  }

  initializeElements() {
    this.modeSelect = document.getElementById('modeSelect');
    
    // Inicializar TabsManager si está disponible
    if (typeof TabsManager !== 'undefined') {
      this.tabsManager = new TabsManager();
      console.log('UIManager: TabsManager inicializado');
    }
    
    console.log('UIManager: Elementos inicializados');
  }

  setupEventListeners() {
    if (this.modeSelect) {
      this.modeSelect.addEventListener('change', (e) => {
        this.handleModeChange(e.target.value);
      });
      console.log('UIManager: Event listeners configurados');
    }
  }

  async initializeMode() {
    try {
      console.log('UIManager: Inicializando modo...');
      const savedMode = await window.api.settings.get('ui.mode') || 'ask';
      console.log('UIManager: Modo guardado:', savedMode);
      
      currentMode = savedMode;
      
      if (this.modeSelect) {
        this.modeSelect.value = savedMode;
        console.log('UIManager: Selector configurado a:', savedMode);
      }
      
      this.updateModeDisplay();
    } catch (error) {
      console.error('UIManager: Error inicializando modo:', error);
      currentMode = 'ask';
      this.updateModeDisplay();
    }
  }

  async handleModeChange(newMode) {
    try {
      console.log('UIManager: Cambiando modo a:', newMode);
      currentMode = newMode;
      
      // Guardar en settings
      await window.api.settings.set('ui.mode', newMode);
      console.log('UIManager: Modo guardado en settings');
      
      // Actualizar UI
      this.updateModeDisplay();
      
      // Lógica específica por modo
      this.handleModeSpecificLogic(newMode);
      
    } catch (error) {
      console.error('UIManager: Error cambiando modo:', error);
    }
  }

  updateModeDisplay() {
    // Actualizar indicador visual del modo
    const modeIndicator = document.getElementById('modeIndicator');
    if (modeIndicator) {
      modeIndicator.textContent = currentMode === 'ask' ? 'Preguntar' : 'Agente';
      modeIndicator.className = `mode-indicator ${currentMode}`;
    }
    
    console.log('UIManager: Modo actual:', currentMode);
  }

  handleModeSpecificLogic(mode) {
    if (mode === 'ask') {
      // En modo "Preguntar", ocultar pestaña MCP
      this.hideMCPTab();
    } else if (mode === 'agent') {
      // En modo "Agente", mostrar pestaña MCP
      this.showMCPTab();
    }
  }

  hideMCPTab() {
    // Ocultar pestaña MCP usando TabsManager
    if (this.tabsManager) {
      this.tabsManager.updateMCPTabVisibility('ask');
    }
    console.log('UIManager: Pestaña MCP ocultada');
  }

  showMCPTab() {
    // Mostrar pestaña MCP usando TabsManager
    if (this.tabsManager) {
      this.tabsManager.updateMCPTabVisibility('agent');
    }
    console.log('UIManager: Pestaña MCP mostrada');
  }

  // Método para obtener el modo actual (para uso en chat.js)
  getCurrentMode() {
    return currentMode;
  }
}

// Función global para obtener el modo actual
function getCurrentMode() {
  return currentMode;
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  console.log('UIManager: DOM cargado, inicializando...');
  window.uiManager = new UIManager();
});
