class ChatApp {
  constructor() {
    console.log('ChatApp: Constructor iniciado');
    this.currentSessionId = null;
    this.isStreaming = false;
    this.sidebar = null;
    this.initializeElements();
    this.setupEventListeners();
    this.initializeApp();
  }

  initializeElements() {
    console.log('ChatApp: Inicializando elementos');
    this.messagesContainer = document.getElementById('messagesContainer');
    this.messageInput = document.getElementById('messageInput');
    this.sendButton = document.getElementById('sendButton');
    this.statusIndicator = document.getElementById('statusIndicator');
    this.statusText = document.getElementById('statusText');
    
    console.log('ChatApp: Elementos encontrados:', {
      messagesContainer: !!this.messagesContainer,
      messageInput: !!this.messageInput,
      sendButton: !!this.sendButton,
      statusIndicator: !!this.statusIndicator,
      statusText: !!this.statusText
    });
  }

  setupEventListeners() {
    console.log('ChatApp: Configurando event listeners');
    
    this.sendButton.addEventListener('click', () => {
      console.log('ChatApp: Botón clickeado');
      this.sendMessage();
    });
    
    this.messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        console.log('ChatApp: Enter presionado');
        this.sendMessage();
      }
    });
    
    this.messageInput.addEventListener('input', () => {
      console.log('ChatApp: Input cambiado');
      this.updateSendButton();
    });
    
    this.updateSendButton();
  }

  async initializeApp() {
    console.log('ChatApp: Inicializando aplicación');
    try {
      console.log('ChatApp: Probando conexión...');
      await this.testConnection();
      console.log('ChatApp: Conexión exitosa');
      this.updateStatus('connected', 'Conectado');
      
      console.log('ChatApp: Inicializando sidebar...');
      this.initializeSidebar();
      console.log('ChatApp: Sidebar inicializado');
      
      console.log('ChatApp: Inicializando sesión...');
      await this.initializeSession();
      console.log('ChatApp: Sesión inicializada:', this.currentSessionId);
      
      console.log('ChatApp: Cargando mensajes...');
      await this.loadMessages();
      console.log('ChatApp: Mensajes cargados');
    } catch (error) {
      console.error('ChatApp: Error inicializando app:', error);
      this.updateStatus('error', 'Error de conexión');
      this.showError('Error al conectar con el servidor: ' + error.message);
    }
  }

  initializeSidebar() {
    console.log('ChatApp: Inicializando sidebar...');
    
    if (typeof Sidebar === 'undefined') {
      console.error('ChatApp: Clase Sidebar no encontrada');
      return;
    }
    
    this.sidebar = new Sidebar();
    
    // Configurar callbacks del sidebar
    this.sidebar.setCallbacks({
      onNewChat: () => {
        console.log('ChatApp: Nuevo chat solicitado desde sidebar');
        this.createNewSession();
      },
      onSessionSelect: (sessionId) => {
        console.log('ChatApp: Sesión seleccionada desde sidebar:', sessionId);
        this.switchToSession(sessionId);
      }
    });
    
    console.log('ChatApp: Sidebar configurado correctamente');
  }

  async createNewSession() {
    try {
      console.log('ChatApp: Creando nueva sesión...');
      
      // Crear nueva sesión
      const sessionId = await window.api.sessions.create('Nueva conversación');
      console.log('ChatApp: Nueva sesión creada:', sessionId);
      
      // Cambiar a la nueva sesión
      await this.switchToSession(sessionId);
      
      // Actualizar sidebar
      if (this.sidebar) {
        this.sidebar.refresh();
        this.sidebar.setCurrentSession(sessionId);
      }
      
    } catch (error) {
      console.error('ChatApp: Error creando nueva sesión:', error);
      alert('Error al crear nueva conversación');
    }
  }

  async switchToSession(sessionId) {
    try {
      console.log('ChatApp: Cambiando a sesión:', sessionId);
      
      this.currentSessionId = sessionId;
      
      // Limpiar mensajes actuales
      this.messagesContainer.innerHTML = '';
      
      // Cargar mensajes de la nueva sesión
      await this.loadMessages();
      
      // Actualizar sidebar
      if (this.sidebar) {
        this.sidebar.setCurrentSession(sessionId);
      }
      
      console.log('ChatApp: Cambio de sesión completado');
      
    } catch (error) {
      console.error('ChatApp: Error cambiando sesión:', error);
      alert('Error al cambiar de conversación');
    }
  }

  async testConnection() {
    console.log('ChatApp: Probando conexión con API...');
    const result = await window.api.sessions.list();
    console.log('ChatApp: Resultado de conexión:', result);
  }

  async initializeSession() {
    console.log('ChatApp: Inicializando sesión...');
    const sessions = await window.api.sessions.list();
    console.log('ChatApp: Sesiones existentes:', sessions);
    
    if (sessions.length > 0) {
      this.currentSessionId = sessions[0].id;
      console.log('ChatApp: Usando sesión existente:', this.currentSessionId);
    } else {
      this.currentSessionId = await window.api.sessions.create('Chat Session');
      console.log('ChatApp: Nueva sesión creada:', this.currentSessionId);
    }
  }

  async loadMessages() {
    if (!this.currentSessionId) {
      console.log('ChatApp: No hay sesión, saltando carga de mensajes');
      return;
    }
    
    console.log('ChatApp: Cargando mensajes para sesión:', this.currentSessionId);
    const messages = await window.api.messages.list(this.currentSessionId);
    console.log('ChatApp: Mensajes cargados:', messages);
    
    this.messagesContainer.innerHTML = '';
    
    if (messages.length === 0) {
      this.showEmptyState();
    } else {
      messages.forEach(message => this.addMessage(message, false));
    }
  }

  updateStatus(status, text) {
    console.log('ChatApp: Actualizando estado:', status, text);
    this.statusIndicator.className = 'status-indicator ' + status;
    this.statusText.textContent = text;
  }

  updateSendButton() {
    const hasText = this.messageInput.value.trim().length > 0;
    this.sendButton.disabled = !hasText || this.isStreaming;
    console.log('ChatApp: updateSendButton:', { 
      hasText, 
      isStreaming: this.isStreaming, 
      disabled: this.sendButton.disabled,
      inputValue: this.messageInput.value
    });
  }

  showEmptyState() {
    console.log('ChatApp: Mostrando estado vacío');
    this.messagesContainer.innerHTML = '<div class="empty-state"><h3>¡Hola! 👋</h3><p>Comienza una conversación escribiendo un mensaje abajo.</p></div>';
  }

  showError(message) {
    console.log('ChatApp: Mostrando error:', message);
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    this.messagesContainer.appendChild(errorDiv);
  }

  addMessage(message, isStreaming = false) {
    console.log('ChatApp: Agregando mensaje:', message, 'streaming:', isStreaming);
    
    const emptyState = this.messagesContainer.querySelector('.empty-state');
    if (emptyState) {
      emptyState.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + message.role + (isStreaming ? ' streaming' : '');
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = message.role === 'user' ? 'U' : 'A';
    
    const content = document.createElement('div');
    content.className = 'message-content';
    content.textContent = message.content;
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);
    
    this.messagesContainer.appendChild(messageDiv);
    this.scrollToBottom();
    
    return messageDiv;
  }

  async sendMessage() {
    console.log('ChatApp: sendMessage iniciado');
    const text = this.messageInput.value.trim();
    console.log('ChatApp: Texto a enviar:', text);
    
    if (!text || this.isStreaming || !this.currentSessionId) {
      console.log('ChatApp: Condiciones no cumplidas:', {
        hasText: !!text,
        isStreaming: this.isStreaming,
        hasSession: !!this.currentSessionId
      });
      return;
    }

    console.log('ChatApp: Enviando mensaje:', text);

    this.messageInput.value = '';
    this.updateSendButton();
    this.isStreaming = true;

    try {
      console.log('ChatApp: Agregando mensaje del usuario...');
      await window.api.messages.append({
        sessionId: this.currentSessionId,
        role: 'user',
        content: text
      });

      console.log('ChatApp: Mostrando mensaje del usuario...');
      this.addMessage({ role: 'user', content: text });

      console.log('ChatApp: Creando mensaje del asistente...');
      const assistantMessageDiv = this.addMessage({ 
        role: 'assistant', 
        content: '' 
      }, true);

      const contentElement = assistantMessageDiv.querySelector('.message-content');
      let fullResponse = '';

      console.log('ChatApp: Iniciando streaming...');
      
      // Obtener modo actual
      const currentMode = window.getCurrentMode ? window.getCurrentMode() : 'ask';
      console.log('ChatApp: Modo actual:', currentMode);
      
      await window.api.chat.stream({
        sessionId: this.currentSessionId,
        messages: await this.getConversationHistory(),
        model: 'gpt-4',
        opts: {},
        mode: currentMode
      }, (delta) => {
        fullResponse += delta.content;
        contentElement.textContent = fullResponse;
        this.scrollToBottom();
      });

      console.log('ChatApp: Streaming completado');
      assistantMessageDiv.classList.remove('streaming');

    } catch (error) {
      console.error('ChatApp: Error enviando mensaje:', error);
      this.showError('Error: ' + error.message);
    } finally {
      this.isStreaming = false;
      this.updateSendButton();
      this.messageInput.focus();
      
      // Actualizar sidebar después de enviar mensaje
      if (this.sidebar) {
        this.sidebar.refresh();
      }
    }
  }

  async getConversationHistory() {
    console.log('ChatApp: Obteniendo historial de conversación...');
    const messages = await window.api.messages.list(this.currentSessionId);
    const history = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    console.log('ChatApp: Historial obtenido:', history);
    return history;
  }

  scrollToBottom() {
    this.messagesContainer.scrollTo({
      top: this.messagesContainer.scrollHeight,
      behavior: 'smooth'
    });
  }
}

console.log('ChatApp: Script cargado, esperando DOM...');
document.addEventListener('DOMContentLoaded', () => {
  console.log('ChatApp: DOM cargado, inicializando...');
  new ChatApp();
});
