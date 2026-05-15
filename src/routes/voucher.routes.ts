
import { Router } from 'express';
import { voucherController } from '../controllers/voucher.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Campaigns
router.get('/', authenticate, voucherController.getAllVouchers);
router.post('/', authenticate, voucherController.createVoucher);
router.patch('/:id/status', authenticate, voucherController.updateVoucherStatus);
router.delete('/:id', authenticate, voucherController.deleteVoucher);

// Claims / Issuance
router.get('/claims', authenticate, voucherController.getAllClaims);
router.post('/issue', authenticate, voucherController.issueVoucher);

// Redemption (Sales integration)
// router.post('/redeem', voucherController.redeemVoucher); // Not strictly needed if handled by Sales, but good to have

export default router;
