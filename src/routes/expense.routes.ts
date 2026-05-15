import { Router } from 'express';
import { expenseController } from '../controllers/expense.controller';
import { optionalAuth } from '../middleware/optionalAuth';

const router = Router();

// Apply optional auth middleware to capture user info
router.use(optionalAuth);

router.get('/', expenseController.getAllExpenses);
router.get('/:id', expenseController.getExpenseById);
router.post('/', expenseController.createExpense);
router.put('/:id', expenseController.updateExpense);
router.delete('/:id', expenseController.deleteExpense);

export default router;
