import { Router } from 'express';
import { AdvantageController } from '../controllers/AdvantageController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const advantageController = new AdvantageController();

// Rota pública - Listar vantagens ativas (para alunos)
router.get('/', advantageController.findAll.bind(advantageController));

// Rotas públicas para demonstração (sem autenticação)
// Em produção, estas rotas devem ser removidas ou protegidas
// IMPORTANTE: Estas rotas devem vir antes de /:id para evitar conflitos
router.post('/demo', advantageController.createDemo.bind(advantageController));
router.put('/demo/:id', advantageController.updateDemo.bind(advantageController));
router.put('/demo/:id/toggle', advantageController.toggleActiveDemo.bind(advantageController));
router.delete('/demo/:id', advantageController.deleteDemo.bind(advantageController));

// Rotas protegidas - Resgate de vantagem pelo aluno
router.post('/:id/redeem', authenticateToken, advantageController.redeem.bind(advantageController));
router.get('/student/my-redemptions', authenticateToken, advantageController.getStudentRedemptions.bind(advantageController));

// Rotas protegidas - Requerem autenticação de empresa
router.post('/', authenticateToken, advantageController.create.bind(advantageController));
router.get('/company/my-advantages', authenticateToken, advantageController.findByCompany.bind(advantageController));
router.put('/:id', authenticateToken, advantageController.update.bind(advantageController));
router.put('/:id/toggle', authenticateToken, advantageController.toggleActive.bind(advantageController));
router.delete('/:id', authenticateToken, advantageController.delete.bind(advantageController));

// Rota pública - Buscar vantagem por ID (deve vir por último para não conflitar)
router.get('/:id', advantageController.findById.bind(advantageController));

export default router;

