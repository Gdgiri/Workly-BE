# Workly Salon Backend - Setup Script

Write-Host "🚀 Starting Workly Salon Backend Setup..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Generate Prisma Client
Write-Host "📦 Step 1: Generating Prisma Client..." -ForegroundColor Yellow
npx prisma generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to generate Prisma Client" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Prisma Client generated successfully" -ForegroundColor Green
Write-Host ""

# Step 2: Run Database Migrations
Write-Host "🗄️  Step 2: Running database migrations..." -ForegroundColor Yellow
npx prisma migrate dev --name init
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to run migrations" -ForegroundColor Red
    Write-Host "💡 Trying db push instead..." -ForegroundColor Yellow
    npx prisma db push
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to push database schema" -ForegroundColor Red
        exit 1
    }
}
Write-Host "✅ Database schema created successfully" -ForegroundColor Green
Write-Host ""

# Step 3: Seed Database
Write-Host "🌱 Step 3: Seeding database..." -ForegroundColor Yellow
npm run prisma:seed
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to seed database" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Database seeded successfully" -ForegroundColor Green
Write-Host ""

# Step 4: Run Tests
Write-Host "🧪 Step 4: Running tests..." -ForegroundColor Yellow
npm test
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Some tests failed" -ForegroundColor Yellow
} else {
    Write-Host "✅ All tests passed" -ForegroundColor Green
}
Write-Host ""

Write-Host "🎉 Setup completed!" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Run: npm run dev" -ForegroundColor White
Write-Host "  2. Server will start on http://localhost:4000" -ForegroundColor White
Write-Host "  3. Health check: http://localhost:4000/health" -ForegroundColor White
Write-Host ""
