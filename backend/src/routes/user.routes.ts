import { Router } from 'express';
import { UserController } from '@/controllers/user.controller';
import { requireAdmin, authorizeRoleHierarchy } from '@/middleware/auth';
import { validate, userSchemas, commonSchemas } from '@/middleware/validation';

const router = Router();

// List users
router.get('/', requireAdmin, validate({ query: userSchemas.listQuery }), UserController.list);

// Get by id
router.get('/:id', requireAdmin, validate({ params: commonSchemas.uuidParam }), UserController.getById);

// Create
router.post('/', requireAdmin, validate({ body: userSchemas.create }), UserController.create);

// Update
router.put('/:id', requireAdmin, authorizeRoleHierarchy, validate({ params: commonSchemas.uuidParam, body: userSchemas.update }), UserController.update);

// Deactivate/reactivate
router.post('/:id/deactivate', requireAdmin, authorizeRoleHierarchy, validate({ params: commonSchemas.uuidParam }), UserController.deactivate);
router.post('/:id/reactivate', requireAdmin, authorizeRoleHierarchy, validate({ params: commonSchemas.uuidParam }), UserController.reactivate);

// Delete
router.delete('/:id', requireAdmin, authorizeRoleHierarchy, validate({ params: commonSchemas.uuidParam }), UserController.remove);

export { router as userRoutes };
