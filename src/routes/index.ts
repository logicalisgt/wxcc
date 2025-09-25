import { Router } from 'express';
import { overrideController } from '../controllers/overrideController';
import { mappingController } from '../controllers/mappingController';

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

// Agent mapping endpoints
router.get('/overrides/mappings', mappingController.getAllMappings.bind(mappingController));
router.post('/overrides/map', mappingController.createMapping.bind(mappingController));
router.patch('/overrides/working-hours', mappingController.updateWorkingHours.bind(mappingController));

export { router as apiRoutes };