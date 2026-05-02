import { Router } from 'express';
import { asyncHandler } from '../../middleware/async';
import { authenticate } from '../../middleware/auth';
import { ok, created } from '../../lib/response';
import { personService } from './person.service';

export const personRouter = Router();
personRouter.use(authenticate);

personRouter.get('/', asyncHandler(async (req, res) => {
  const groupId = (req.query['groupId'] as string) || undefined;
  ok(res, await personService.list(req.userId!, groupId));
}));

personRouter.post('/', asyncHandler(async (req, res) => {
  created(res, await personService.create(req.userId!, req.body));
}));

personRouter.get('/birthdays/today', asyncHandler(async (req, res) => {
  ok(res, await personService.todayBirthdays(req.userId!));
}));

personRouter.get('/:id', asyncHandler(async (req, res) => {
  ok(res, await personService.detail(req.userId!, String(req.params['id'])));
}));

personRouter.put('/:id', asyncHandler(async (req, res) => {
  ok(res, await personService.update(req.userId!, String(req.params['id']), req.body));
}));

personRouter.delete('/:id', asyncHandler(async (req, res) => {
  await personService.remove(req.userId!, String(req.params['id']));
  ok(res, null);
}));

personRouter.get('/:id/dates', asyncHandler(async (req, res) => {
  ok(res, await personService.importantDates(req.userId!, String(req.params['id'])));
}));

personRouter.post('/:id/dates', asyncHandler(async (req, res) => {
  created(res, await personService.addImportantDate(req.userId!, String(req.params['id']), req.body));
}));

personRouter.get('/:id/memories', asyncHandler(async (req, res) => {
  ok(res, await personService.memories(req.userId!, String(req.params['id'])));
}));

personRouter.post('/:id/memories', asyncHandler(async (req, res) => {
  created(res, await personService.addMemory(req.userId!, String(req.params['id']), req.body));
}));

export const personGroupRouter = Router();
personGroupRouter.use(authenticate);

personGroupRouter.get('/', asyncHandler(async (req, res) => {
  ok(res, await personService.groups(req.userId!));
}));

personGroupRouter.post('/', asyncHandler(async (req, res) => {
  created(res, await personService.createGroup(req.userId!, req.body.name));
}));
