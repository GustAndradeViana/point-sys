import { Router } from 'express';
import { TransactionController } from '../controllers/TransactionController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const transactionController = new TransactionController();

router.use(authenticateToken);

router.get('/balance', transactionController.getBalance.bind(transactionController));
router.get('/', transactionController.getTransactions.bind(transactionController));
router.post('/send', transactionController.sendCoins.bind(transactionController));
router.get('/professor/students-with-redemptions', transactionController.getStudentsWithRedemptions.bind(transactionController));

export default router;
