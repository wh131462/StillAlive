import { Router } from 'express';
import { asyncHandler } from '../../middleware/async';
import { authenticate } from '../../middleware/auth';
import { ok, created } from '../../lib/response';
import { checkinService } from './checkin.service';

export const checkinRouter = Router();
checkinRouter.use(authenticate);

checkinRouter.post('/', asyncHandler(async (req, res) => {
  const result = await checkinService.checkIn(req.userId!, req.body);
  created(res, result);
}));

checkinRouter.post('/retroactive', asyncHandler(async (req, res) => {
  const result = await checkinService.retroactive(req.userId!, req.body.date, req.body);
  created(res, result);
}));

checkinRouter.put('/:id', asyncHandler(async (req, res) => {
  const result = await checkinService.update(req.userId!, String(req.params['id']), req.body);
  ok(res, result);
}));

checkinRouter.get('/', asyncHandler(async (req, res) => {
  const from = (req.query['from'] as string) || undefined;
  const to = (req.query['to'] as string) || undefined;
  const result = await checkinService.list(req.userId!, from, to);
  ok(res, result);
}));

checkinRouter.get('/stats', asyncHandler(async (req, res) => {
  const result = await checkinService.stats(req.userId!);
  ok(res, result);
}));

checkinRouter.get('/:date', asyncHandler(async (req, res) => {
  const result = await checkinService.byDate(req.userId!, String(req.params['date']));
  ok(res, result);
}));
