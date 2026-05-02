import { Router } from 'express';
import { asyncHandler } from '../../middleware/async';
import { authenticate } from '../../middleware/auth';
import { ok } from '../../lib/response';
import { profileService } from './profile.service';

export const profileRouter = Router();
profileRouter.use(authenticate);

profileRouter.get('/death-confirmation', asyncHandler(async (req, res) => {
  ok(res, await profileService.getDeathConfirmation(req.userId!));
}));

profileRouter.put('/death-confirmation', asyncHandler(async (req, res) => {
  ok(res, await profileService.upsertDeathConfirmation(req.userId!, req.body));
}));
