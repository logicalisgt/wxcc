import { Router } from 'express';
import { overrideController } from '../controllers/overrideController';

const router = Router();

// Health check endpoint
router.get('/health', overrideController.healthCheck.bind(overrideController));

// Override container endpoints
router.get('/overrides/containers', overrideController.getAllContainers.bind(overrideController));
router.get('/overrides/containers/:id', overrideController.getContainerById.bind(overrideController));

// Agent management endpoint
router.put('/overrides/containers/:containerId/agents/:agentId', 
  overrideController.updateAgentSchedule.bind(overrideController)
);

// Active agents endpoint
router.get('/overrides/active', overrideController.getActiveAgents.bind(overrideController));

export { router as apiRoutes };