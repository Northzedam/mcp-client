class PolicyEngine {
  constructor() {
    this.rules = new Map()
    this.setupDefaultRules()
  }

  setupDefaultRules() {
    // Reglas por defecto
    this.rules.set('filesystem.read', 'ALLOW')
    this.rules.set('filesystem.write', 'REQUIRE_CONFIRMATION')
    this.rules.set('filesystem.delete', 'REQUIRE_CONFIRMATION')
    this.rules.set('playwright.goto', 'REQUIRE_CONFIRMATION')
    this.rules.set('playwright.click', 'REQUIRE_CONFIRMATION')
    this.rules.set('playwright.type', 'REQUIRE_CONFIRMATION')
    this.rules.set('web_search', 'ALLOW')
    this.rules.set('codebase_search', 'ALLOW')
    this.rules.set('read_file', 'ALLOW')
    this.rules.set('write_file', 'REQUIRE_CONFIRMATION')
    this.rules.set('delete_file', 'REQUIRE_CONFIRMATION')
    
    // Reglas para herramientas MCP reales
    // Herramientas de filesystem MCP
    this.rules.set('read_file', 'ALLOW')
    this.rules.set('read_text_file', 'ALLOW')
    this.rules.set('read_media_file', 'ALLOW')
    this.rules.set('read_multiple_files', 'ALLOW')
    this.rules.set('write_file', 'REQUIRE_CONFIRMATION')
    this.rules.set('edit_file', 'REQUIRE_CONFIRMATION')
    this.rules.set('create_directory', 'REQUIRE_CONFIRMATION')
    this.rules.set('list_directory', 'ALLOW')
    this.rules.set('list_directory_with_sizes', 'ALLOW')
    this.rules.set('directory_tree', 'ALLOW')
    this.rules.set('move_file', 'REQUIRE_CONFIRMATION')
    this.rules.set('search_files', 'ALLOW')
    this.rules.set('get_file_info', 'ALLOW')
    this.rules.set('list_allowed_directories', 'ALLOW')
    
    // Herramientas de Playwright MCP
    this.rules.set('browser_close', 'ALLOW')
    this.rules.set('browser_resize', 'ALLOW')
    this.rules.set('browser_console_messages', 'ALLOW')
    this.rules.set('browser_handle_dialog', 'REQUIRE_CONFIRMATION')
    this.rules.set('browser_evaluate', 'REQUIRE_CONFIRMATION')
    this.rules.set('browser_file_upload', 'REQUIRE_CONFIRMATION')
    this.rules.set('browser_fill_form', 'REQUIRE_CONFIRMATION')
    this.rules.set('browser_install', 'ALLOW')
    this.rules.set('browser_press_key', 'REQUIRE_CONFIRMATION')
    this.rules.set('browser_type', 'REQUIRE_CONFIRMATION')
    this.rules.set('browser_navigate', 'REQUIRE_CONFIRMATION')
    this.rules.set('browser_navigate_back', 'ALLOW')
    this.rules.set('browser_network_requests', 'ALLOW')
    this.rules.set('browser_take_screenshot', 'ALLOW')
    this.rules.set('browser_snapshot', 'ALLOW')
    this.rules.set('browser_click', 'REQUIRE_CONFIRMATION')
    this.rules.set('browser_drag', 'REQUIRE_CONFIRMATION')
    this.rules.set('browser_hover', 'ALLOW')
    this.rules.set('browser_select_option', 'REQUIRE_CONFIRMATION')
    this.rules.set('browser_tabs', 'ALLOW')
    this.rules.set('browser_wait_for', 'ALLOW')
  }

  evaluate(tool, args = {}) {
    // Verificar reglas específicas
    const rule = this.rules.get(tool)
    if (rule) {
      // Aplicar lógica adicional basada en argumentos
      return this.applyContextualRules(tool, args, rule)
    }

    // Regla por defecto: DENY para herramientas desconocidas
    return 'DENY'
  }

  applyContextualRules(tool, args, baseRule) {
    // Verificar rutas fuera del sandbox
    if (this.isOutsideSandbox(args)) {
      return 'DENY'
    }

    // Verificar operaciones peligrosas
    if (this.isDangerousOperation(tool, args)) {
      return 'DENY'
    }

    return baseRule
  }

  isOutsideSandbox(args) {
    const dangerousPaths = ['../', '..\\', '/etc/', 'C:\\Windows\\', '/System/']
    const filePath = args.file || args.path || args.filePath || ''
    
    return dangerousPaths.some(dangerous => 
      filePath.includes(dangerous) || filePath.startsWith(dangerous)
    )
  }

  isDangerousOperation(tool, args) {
    // Operaciones que siempre deben ser denegadas
    const dangerousOps = [
      'system.exec',
      'process.kill',
      'network.request',
      'database.drop',
      'user.delete'
    ]

    return dangerousOps.includes(tool)
  }

  // Métodos para gestionar reglas dinámicamente
  addRule(tool, decision) {
    this.rules.set(tool, decision)
  }

  removeRule(tool) {
    this.rules.delete(tool)
  }

  listRules() {
    return Array.from(this.rules.entries()).map(([tool, decision]) => ({
      tool,
      decision
    }))
  }
}

module.exports = { PolicyEngine };
