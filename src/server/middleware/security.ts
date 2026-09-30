import { Request, Response, NextFunction } from 'express';

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  next();
}
