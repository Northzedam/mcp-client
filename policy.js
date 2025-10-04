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
