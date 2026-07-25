import { createClerkClient } from '@clerk/backend';
import type { FastifyInstance } from 'fastify';
import type { MeResponse } from '@daleelex/shared';
import { prisma } from '../db.js';
import { requireClerkUser } from '../clerkAuth.js';

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

export async function meRoute(app: FastifyInstance) {
  app.get('/me', { preHandler: requireClerkUser }, async (req): Promise<MeResponse> => {
    const clerkUser = await clerkClient.users.getUser(req.clerkUserId!);

    const email = clerkUser.primaryEmailAddress?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress ?? '';
    const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || null;

    const user = await prisma.user.upsert({
      where: { id: clerkUser.id },
      create: { id: clerkUser.id, email, name, avatarUrl: clerkUser.imageUrl, lastSeenAt: new Date() },
      update: { email, name, avatarUrl: clerkUser.imageUrl, lastSeenAt: new Date() },
    });

    return { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl };
  });
}
