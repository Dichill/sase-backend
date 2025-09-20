import { Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { BaseSupabaseAuthGuard } from 'nestjs-supabase-js';
import { Request } from 'express';

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
}
