import { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/errorHandler';
import { UserService } from '@/services/user.service';

const toPublicUser = (u: any) => ({
  id: u.id,
  email: u.email,
  firstName: u.firstName,
  lastName: u.lastName,
  role: u.role,
  isActive: u.isActive,
  createdAt: u.createdAt,
  updatedAt: u.updatedAt,
});

export class UserController {
  static list = asyncHandler(async (req: Request, res: Response) => {
    const { page = 1, limit = 10, role, isActive, search } = req.query as any;
    const result = await UserService.list(
      {
        role: role as any,
        isActive: isActive !== undefined ? String(isActive) === 'true' : undefined,
        search: search as string,
      },
      { page: parseInt(String(page)), limit: parseInt(String(limit)) }
    );

    res.json({ success: true, data: result.data, pagination: result.pagination, timestamp: new Date().toISOString() });
  });

  static getById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
  const user = await UserService.getById(id);
  res.json({ success: true, data: toPublicUser(user as any), timestamp: new Date().toISOString() });
  });

  static create = asyncHandler(async (req: Request, res: Response) => {
  const created = await UserService.create(req.body);
  res.status(201).json({ success: true, data: toPublicUser(created as any), timestamp: new Date().toISOString() });
  });

  static update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
  const updated = await UserService.update(id, req.body, req.user!.id);
  res.json({ success: true, data: toPublicUser(updated as any), timestamp: new Date().toISOString() });
  });

  static deactivate = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
  const updated = await UserService.deactivate(id, req.user!.id);
  res.json({ success: true, data: toPublicUser(updated as any), timestamp: new Date().toISOString() });
  });

  static reactivate = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
  const updated = await UserService.reactivate(id, req.user!.id);
  res.json({ success: true, data: toPublicUser(updated as any), timestamp: new Date().toISOString() });
  });

  static remove = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await UserService.delete(id, req.user!.id);
    res.json({ success: true, data: { message: 'User deleted' }, timestamp: new Date().toISOString() });
  });
}
