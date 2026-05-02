import { Router } from 'express';
import { asyncHandler } from '../../middleware/async';
import { authenticate, optionalAuth } from '../../middleware/auth';
import { ok, created } from '../../lib/response';
import { storyService } from './story.service';

export const storyRouter = Router();

storyRouter.get('/', asyncHandler(async (req, res) => {
  const category = (req.query['category'] as string) || undefined;
  const cursor = (req.query['cursor'] as string) || undefined;
  const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : undefined;
  ok(res, await storyService.list({ category, cursor, limit }));
}));

storyRouter.get('/random', asyncHandler(async (req, res) => {
  const category = (req.query['category'] as string) || undefined;
  ok(res, await storyService.random(category));
}));

storyRouter.get('/mine', authenticate, asyncHandler(async (req, res) => {
  ok(res, await storyService.myStories(req.userId!));
}));

storyRouter.get('/:id', asyncHandler(async (req, res) => {
  ok(res, await storyService.detail(String(req.params['id'])));
}));

storyRouter.post('/', optionalAuth, asyncHandler(async (req, res) => {
  created(res, await storyService.submit(req.body, req.userId));
}));

storyRouter.post('/:id/resonance', optionalAuth, asyncHandler(async (req, res) => {
  ok(res, await storyService.resonate(String(req.params['id']), {
    userId: req.userId,
    deviceId: req.body.deviceId,
  }));
}));

storyRouter.get('/admin/pending', authenticate, asyncHandler(async (req, res) => {
  ok(res, await storyService.listPending());
}));

storyRouter.post('/admin/:id/approve', authenticate, asyncHandler(async (req, res) => {
  ok(res, await storyService.approve(String(req.params['id'])));
}));

storyRouter.post('/admin/:id/reject', authenticate, asyncHandler(async (req, res) => {
  ok(res, await storyService.reject(String(req.params['id'])));
}));
