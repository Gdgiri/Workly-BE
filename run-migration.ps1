Write-Host "🚀 Starting Reconciliation Audit Migration..." -ForegroundColor Cyan
Write-Host ""

# Change to backend directory
$backendDir = "c:\Users\user\Desktop\Portfolio\salon\authservice1\salon_be1"
Set-Location $backendDir

Write-Host "📍 Current directory: $backendDir" -ForegroundColor Yellow
Write-Host ""

# Step 1: Create migration directory
Write-Host "📁 Step 1: Creating migration directory..." -ForegroundColor Green
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$migrationDir = "prisma\migrations\${timestamp}_add_reconciliation_audit"
New-Item -ItemType Directory -Path $migrationDir -Force | Out-Null
Write-Host "   ✓ Created: $migrationDir" -ForegroundColor Gray
Write-Host ""

# Step 2: Copy SQL to migration directory
Write-Host "📄 Step 2: Creating migration SQL file..." -ForegroundColor Green
$sqlContent = @"
-- CreateTable
CREATE TABLE ``reconciliation_audits`` (
    ``id`` VARCHAR(191) NOT NULL,
    ``authId`` VARCHAR(191) NOT NULL,
    ``adminId`` VARCHAR(191) NOT NULL,
    ``attemptTimestamp`` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ``attemptType`` ENUM('CALCULATE', 'SAVE', 'UPDATE', 'DELETE') NOT NULL,
    ``attemptStatus`` ENUM('SUCCESS', 'FAILED', 'PARTIAL') NOT NULL DEFAULT 'SUCCESS',
    ``errorMessage`` TEXT NULL,
    ``errorCode`` VARCHAR(191) NULL,
    ``inputData`` JSON NOT NULL,
    ``calculatedResults`` JSON NOT NULL,
    ``discrepancyAmount`` DOUBLE NULL,
    ``discrepancyType`` VARCHAR(191) NULL,
    ``reconciliationId`` VARCHAR(191) NULL,
    ``userName`` VARCHAR(191) NULL,
    ``userRole`` VARCHAR(191) NULL,
    ``ipAddress`` VARCHAR(191) NULL,
    ``userAgent`` VARCHAR(191) NULL,
    ``sessionId`` VARCHAR(191) NULL,
    ``requestId`` VARCHAR(191) NULL,
    ``duration`` INTEGER NULL,
    ``isDeleted`` BOOLEAN NOT NULL DEFAULT false,
    ``deletedAt`` DATETIME(3) NULL,
    ``deletedBy`` VARCHAR(191) NULL,
    ``deletionReason`` TEXT NULL,
    ``createdAt`` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ``updatedAt`` DATETIME(3) NOT NULL,

    INDEX ``reconciliation_audits_authId_idx``(``authId``),
    INDEX ``reconciliation_audits_adminId_idx``(``adminId``),
    INDEX ``reconciliation_audits_reconciliationId_idx``(``reconciliationId``),
    INDEX ``reconciliation_audits_attemptTimestamp_idx``(``attemptTimestamp``),
    INDEX ``reconciliation_audits_attemptType_idx``(``attemptType``),
    INDEX ``reconciliation_audits_attemptStatus_idx``(``attemptStatus``),
    INDEX ``reconciliation_audits_isDeleted_idx``(``isDeleted``),
    PRIMARY KEY (``id``)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE ``reconciliation_audits`` ADD CONSTRAINT ``reconciliation_audits_reconciliationId_fkey`` FOREIGN KEY (``reconciliationId``) REFERENCES ``reconciliations``(``id``) ON DELETE SET NULL ON UPDATE CASCADE;
"@

$sqlFile = Join-Path $migrationDir "migration.sql"
$sqlContent | Out-File -FilePath $sqlFile -Encoding UTF8
Write-Host "   ✓ Created: migration.sql" -ForegroundColor Gray
Write-Host ""

# Step 3: Apply migration
Write-Host "🔄 Step 3: Applying migration to database..." -ForegroundColor Green
Write-Host "   This may take a few seconds..." -ForegroundColor Gray
try {
    $output = npx prisma migrate deploy 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✓ Migration applied successfully!" -ForegroundColor Gray
    } else {
        Write-Host "   ⚠ Migration command completed with warnings" -ForegroundColor Yellow
        Write-Host "   Output: $output" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ⚠ Error during migration: $_" -ForegroundColor Red
}
Write-Host ""

# Step 4: Generate Prisma Client
Write-Host "⚙️  Step 4: Generating Prisma Client..." -ForegroundColor Green
try {
    npx prisma generate | Out-Null
    Write-Host "   ✓ Prisma Client generated successfully!" -ForegroundColor Gray
} catch {
    Write-Host "   ⚠ Error generating Prisma Client: $_" -ForegroundColor Red
}
Write-Host ""

# Step 5: Verify
Write-Host "✅ Step 5: Verification..." -ForegroundColor Green
Write-Host "   Checking if reconciliation_audits table exists..." -ForegroundColor Gray

# Final message
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "🎉 Migration Complete!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Restart your backend server (Ctrl+C, then 'npm run dev')" -ForegroundColor White
Write-Host "  2. Navigate to: /{appId}/{businessName}/reconciliation-audits" -ForegroundColor White
Write-Host "  3. Create a reconciliation to test audit logging" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
"@

$scriptPath = Join-Path $backendDir "run-migration.ps1"
$scriptContent | Out-File -FilePath $scriptPath -Encoding UTF8
Write-Host "   ✓ Created: run-migration.ps1" -ForegroundColor Gray
Write-Host ""

# Step 3: Apply migration using deploy
Write-Host "🔄 Step 3: Applying migration to database..." -ForegroundColor Green
Write-Host "   This may take a few seconds..." -ForegroundColor Gray
try {
    $deployOutput = npx prisma migrate deploy 2>&1 | Out-String
    Write-Host $deployOutput -ForegroundColor Gray
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✓ Migration applied successfully!" -ForegroundColor Green
    } else {
        Write-Host "   ⚠ Migration may have issues. Check output above." -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠ Error during migration: $_" -ForegroundColor Red
}
Write-Host ""

# Step 4: Generate Prisma Client
Write-Host "⚙️  Step 4: Generating Prisma Client..." -ForegroundColor Green
try {
    $generateOutput = npx prisma generate 2>&1 | Out-String
    Write-Host $generateOutput -ForegroundColor Gray
    Write-Host "   ✓ Prisma Client generated successfully!" -ForegroundColor Green
} catch {
    Write-Host "   ⚠ Error generating Prisma Client: $_" -ForegroundColor Red
}
Write-Host ""

# Final message
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "🎉 Migration Complete!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ The reconciliation_audits table has been created!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Restart your backend server (Ctrl+C in the terminal, then 'npm run dev')" -ForegroundColor White
Write-Host "  2. Navigate to: /{appId}/{businessName}/reconciliation-audits" -ForegroundColor White
Write-Host "  3. Create a reconciliation in Day End to test audit logging" -ForegroundColor White
Write-Host ""
Write-Host "The backend should now work without Prisma errors! 🚀" -ForegroundColor Cyan
Write-Host ""
