import type { User } from 'better-auth/types';
import type {
  Invitation,
  Member,
  Organization,
} from 'better-auth/plugins/organization';

export type { User, Organization, Member, Invitation };

export type SessionUser = Pick<User, 'id' | 'name' | 'email' | 'image'>;
