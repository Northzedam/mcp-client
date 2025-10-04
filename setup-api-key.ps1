# Script para configurar la API key de OpenAI de forma segura
param(
    [Parameter(Mandatory=$true)]
    [string]$ApiKey
)

Write-Host "Configurando API key de OpenAI..." -ForegroundColor Green

# Verificar que la API key tenga el formato correcto
if (-not $ApiKey.StartsWith("sk-")) {
    Write-Host "⚠️  Advertencia: La API key no parece tener el formato correcto (debería empezar con 'sk-')" -ForegroundColor Yellow
    $confirm = Read-Host "¿Continuar de todos modos? (y/N)"
    if ($confirm -ne "y" -and $confirm -ne "Y") {
        Write-Host "Operación cancelada." -ForegroundColor Red
        exit 1
    }
}

# Configurar variable de entorno para la sesión actual
$env:OPENAI_API_KEY = $ApiKey

Write-Host "✅ API key configurada para la sesión actual" -ForegroundColor Green
Write-Host ""
Write-Host "Para hacer la configuración permanente:" -ForegroundColor Yellow
Write-Host "1. Abre las Variables de Entorno del Sistema" -ForegroundColor White
Write-Host "2. Agrega una nueva variable de usuario:" -ForegroundColor White
Write-Host "   - Nombre: OPENAI_API_KEY" -ForegroundColor White
Write-Host "   - Valor: $ApiKey" -ForegroundColor White
Write-Host ""
Write-Host "O ejecuta este comando en PowerShell como administrador:" -ForegroundColor Yellow
Write-Host "[Environment]::SetEnvironmentVariable('OPENAI_API_KEY', '$ApiKey', 'User')" -ForegroundColor Cyan
Write-Host ""
Write-Host "Ahora puedes ejecutar: yarn start" -ForegroundColor Green
