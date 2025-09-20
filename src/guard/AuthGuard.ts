import { Injectable, ExecutionContext } from '@nestjs/common';
import { SupabaseClient, User } from '@supabase/supabase-js';
import { BaseSupabaseAuthGuard } from 'nestjs-supabase-js';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user?: User;
}

@Injectable()
export class AuthGuard extends BaseSupabaseAuthGuard {
  public constructor(supabaseClient: SupabaseClient) {
    super(supabaseClient);
  }

  protected extractTokenFromRequest(request: Request): string | undefined {
    const authHeader = request.headers?.authorization;
    return typeof authHeader === 'string'
      ? authHeader.replace('Bearer ', '')
      : undefined;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractTokenFromRequest(request);

    if (!token) {
      return false;
    }

    try {
      const {
        data: { user },
        error,
      } = await this.supabaseClient.auth.getUser(token);

      if (error || !user) {
        return false;
      }

      request.user = user;
      return true;
    } catch {
      return false;
    }
  }
}
