class Sidebar {
  constructor() {
    this.sidebar = null;
    this.conversationsList = null;
    this.currentSessionId = null;
    this.onNewChat = null;
    this.onSessionSelect = null;
    
    this.initializeElements();
    this.setupEventListeners();
    this.loadConversations();
  }

  initializeElements() {
    // Crear el sidebar si no existe
    if (!document.getElementById('sidebar')) {
      this.createSidebarHTML();
    }
    
    this.sidebar = document.getElementById('sidebar');
    this.conversationsList = document.getElementById('conversationsList');
    this.newChatButton = document.getElementById('newChatButton');
    
    console.log('Sidebar: Elementos inicializados');
  }

  createSidebarHTML() {
    const sidebarHTML = `
      <div id="sidebar" class="sidebar">
        <div class="sidebar-header">
          <h3>Conversaciones</h3>
          <button id="toggleSidebar" class="toggle-sidebar" title="Ocultar/Mostrar sidebar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
            </svg>
          </button>
        </div>
        
        <div class="sidebar-content">
          <button id="newChatButton" class="new-chat-button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            Nuevo Chat
          </button>
          
          <div class="conversations-section">
            <h4>Historial</h4>
            <div id="conversationsList" class="conversations-list">
              <div class="empty-conversations">
                <p>No hay conversaciones</p>
                <small>Inicia un nuevo chat para comenzar</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Insertar el sidebar al inicio del body
    document.body.insertAdjacentHTML('afterbegin', sidebarHTML);
  }

  setupEventListeners() {
    // Botón nuevo chat
    if (this.newChatButton) {
      this.newChatButton.addEventListener('click', () => {
        this.handleNewChat();
      });
    }

    // Botón toggle sidebar
    const toggleButton = document.getElementById('toggleSidebar');
    if (toggleButton) {
      toggleButton.addEventListener('click', () => {
        this.toggleSidebar();
      });
    }

    console.log('Sidebar: Event listeners configurados');
  }

  async loadConversations() {
    try {
      console.log('Sidebar: Cargando conversaciones...');
      
      if (!window.api || !window.api.sessions) {
        console.warn('Sidebar: API no disponible');
        return;
      }

      const sessions = await window.api.sessions.list();
      console.log('Sidebar: Conversaciones cargadas:', sessions.length);
      
      this.renderConversations(sessions);
    } catch (error) {
      console.error('Sidebar: Error cargando conversaciones:', error);
      this.showError('Error al cargar conversaciones');
    }
  }

  renderConversations(sessions) {
    if (!this.conversationsList) return;

    // Limpiar lista
    this.conversationsList.innerHTML = '';

    if (sessions.length === 0) {
      this.conversationsList.innerHTML = `
        <div class="empty-conversations">
          <p>No hay conversaciones</p>
          <small>Inicia un nuevo chat para comenzar</small>
        </div>
      `;
      return;
    }

    // Renderizar cada conversación
    sessions.forEach(session => {
      const conversationElement = this.createConversationElement(session);
      this.conversationsList.appendChild(conversationElement);
    });
  }

  createConversationElement(session) {
    const div = document.createElement('div');
    div.className = `conversation-item ${session.id === this.currentSessionId ? 'active' : ''}`;
    div.dataset.sessionId = session.id;
    
    const date = new Date(session.createdAt);
    const timeAgo = this.getTimeAgo(date);
    
    div.innerHTML = `
      <div class="conversation-content">
        <div class="conversation-title">${this.truncateTitle(session.title)}</div>
        <div class="conversation-meta">
          <span class="conversation-time">${timeAgo}</span>
        </div>
      </div>
      <button class="conversation-delete" title="Eliminar conversación">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
        </svg>
      </button>
    `;

    // Event listeners para la conversación
    div.addEventListener('click', (e) => {
      if (!e.target.closest('.conversation-delete')) {
        this.handleSessionSelect(session.id);
      }
    });

    // Botón eliminar
    const deleteButton = div.querySelector('.conversation-delete');
    deleteButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleDeleteSession(session.id);
    });

    return div;
  }

  handleNewChat() {
    console.log('Sidebar: Nuevo chat solicitado');
    if (this.onNewChat) {
      this.onNewChat();
    }
  }

  handleSessionSelect(sessionId) {
    console.log('Sidebar: Seleccionando sesión:', sessionId);
    this.setActiveSession(sessionId);
    if (this.onSessionSelect) {
      this.onSessionSelect(sessionId);
    }
  }

  async handleDeleteSession(sessionId) {
    if (!confirm('¿Estás seguro de que quieres eliminar esta conversación?')) {
      return;
    }

    try {
      console.log('Sidebar: Eliminando sesión:', sessionId);
      
      // Eliminar la sesión de la base de datos
      const deleted = await window.api.sessions.delete(sessionId);
      
      if (!deleted) {
        alert('No se pudo eliminar la conversación');
        return;
      }
      
      console.log('Sidebar: Sesión eliminada exitosamente');
      
      // Recargar la lista de conversaciones
      await this.loadConversations();
      
      // Si era la sesión activa, crear una nueva
      if (sessionId === this.currentSessionId) {
        this.handleNewChat();
      }
    } catch (error) {
      console.error('Sidebar: Error eliminando sesión:', error);
      alert('Error al eliminar la conversación: ' + error.message);
    }
  }

  setActiveSession(sessionId) {
    // Remover clase active de todos los elementos
    const items = this.conversationsList.querySelectorAll('.conversation-item');
    items.forEach(item => item.classList.remove('active'));
    
    // Agregar clase active al elemento seleccionado
    const activeItem = this.conversationsList.querySelector(`[data-session-id="${sessionId}"]`);
    if (activeItem) {
      activeItem.classList.add('active');
    }
    
    this.currentSessionId = sessionId;
  }

  toggleSidebar() {
    if (this.sidebar) {
      this.sidebar.classList.toggle('collapsed');
      console.log('Sidebar: Toggle sidebar');
    }
  }

  showError(message) {
    if (this.conversationsList) {
      this.conversationsList.innerHTML = `
        <div class="error-message">
          <p>${message}</p>
        </div>
      `;
    }
  }

  // Helpers
  truncateTitle(title, maxLength = 30) {
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength) + '...';
  }

  getTimeAgo(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Hace un momento';
    if (diffInSeconds < 3600) return `Hace ${Math.floor(diffInSeconds / 60)} min`;
    if (diffInSeconds < 86400) return `Hace ${Math.floor(diffInSeconds / 3600)} h`;
    if (diffInSeconds < 2592000) return `Hace ${Math.floor(diffInSeconds / 86400)} días`;
    
    return date.toLocaleDateString();
  }

  // Métodos públicos para integración
  setCallbacks({ onNewChat, onSessionSelect }) {
    this.onNewChat = onNewChat;
    this.onSessionSelect = onSessionSelect;
  }

  refresh() {
    this.loadConversations();
  }

  setCurrentSession(sessionId) {
    this.setActiveSession(sessionId);
  }
}

// Exportar para uso global
window.Sidebar = Sidebar;
