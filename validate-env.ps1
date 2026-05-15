# Validate .env file for Workly Salon Backend

Write-Host "🔍 Validating .env file..." -ForegroundColor Cyan
Write-Host ""

$envPath = ".env"

if (-not (Test-Path $envPath)) {
    Write-Host "❌ .env file not found!" -ForegroundColor Red
    Write-Host "💡 Copy .env.template to .env and update with your database credentials" -ForegroundColor Yellow
    exit 1
}

$envContent = Get-Content $envPath -Raw

# Check for DATABASE_URL
if ($envContent -match 'DATABASE_URL\s*=\s*"([^"]+)"') {
    $dbUrl = $matches[1]
    Write-Host "✅ DATABASE_URL found" -ForegroundColor Green
    Write-Host "   Value: $dbUrl" -ForegroundColor Gray
    
    # Validate MySQL URL format
    if ($dbUrl -match '^mysql://') {
        Write-Host "✅ MySQL protocol detected" -ForegroundColor Green
        
        # Extract components
        if ($dbUrl -match 'mysql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)') {
            $user = $matches[1]
            $host = $matches[3]
            $port = $matches[4]
            $database = $matches[5]
            
            Write-Host "   User: $user" -ForegroundColor Gray
            Write-Host "   Host: $host" -ForegroundColor Gray
            Write-Host "   Port: $port" -ForegroundColor Gray
            Write-Host "   Database: $database" -ForegroundColor Gray
        }
    }
    else {
        Write-Host "⚠️  DATABASE_URL should start with 'mysql://'" -ForegroundColor Yellow
    }
}
else {
    Write-Host "❌ DATABASE_URL not found or incorrectly formatted" -ForegroundColor Red
    Write-Host "💡 Expected format: DATABASE_URL=\"mysql://user:password@host:port/database\"" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Check for other required variables
$requiredVars = @('NODE_ENV', 'PORT', 'JWT_SECRET', 'CORS_ORIGIN', 'TZ')

foreach ($var in $requiredVars) {
    if ($envContent -match "$var\s*=") {
        Write-Host "✅ $var found" -ForegroundColor Green
    }
    else {
        Write-Host "⚠️  $var not found" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "🎯 Next step: Run 'npx prisma db push' to create database tables" -ForegroundColor Cyan
