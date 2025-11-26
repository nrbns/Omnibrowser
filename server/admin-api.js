/**
 * Admin API Routes (ES Module)
 * Admin-only endpoints for managing bounties, skills, and system administration
 */

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'change-me-in-production';

/**
 * Middleware to check admin authentication
 */
export function requireAdmin(request, reply, done) {
  const authHeader = request.headers.authorization;
  const token = authHeader?.replace('Bearer ', '') || request.query?.adminToken;

  if (token !== ADMIN_TOKEN) {
    return reply.status(401).send({ error: 'unauthorized', message: 'Admin access required' });
  }

  done();
}

/**
 * Register admin routes
 */
export function registerAdminRoutes(fastify) {
  // Admin authentication check route
  fastify.get('/admin/auth', { preHandler: requireAdmin }, async () => {
    return { authenticated: true, role: 'admin' };
  });

  // Get all bounty submissions (admin only)
  fastify.get('/admin/bounties/all', { preHandler: requireAdmin }, async () => {
    // TODO: Fetch from database or storage
    return { submissions: [], total: 0 };
  });

  // Approve a bounty submission
  fastify.post(
    '/admin/bounties/:id/approve',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = request.params ?? {};
      if (!id) {
        return reply.status(400).send({ error: 'missing-id' });
      }

      // TODO: Update submission status in database
      return { ok: true, id, status: 'approved' };
    }
  );

  // Reject a bounty submission
  fastify.post(
    '/admin/bounties/:id/reject',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = request.params ?? {};
      if (!id) {
        return reply.status(400).send({ error: 'missing-id' });
      }

      // TODO: Update submission status in database
      return { ok: true, id, status: 'rejected' };
    }
  );

  // Process payout for approved submission
  fastify.post(
    '/admin/bounties/:id/payout',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = request.params ?? {};
      if (!id) {
        return reply.status(400).send({ error: 'missing-id' });
      }

      // TODO: Process UPI payout and update status
      return { ok: true, id, status: 'paid', paidAt: Date.now() };
    }
  );

  // Get admin analytics
  fastify.get('/admin/analytics', { preHandler: requireAdmin }, async () => {
    return {
      totalSubmissions: 0,
      pendingReview: 0,
      approved: 0,
      paid: 0,
      totalViews: 0,
      totalPayouts: 0,
      topCreators: [],
    };
  });

  // Manage skills (approve/reject community skills)
  fastify.post(
    '/admin/skills/:id/approve',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = request.params ?? {};
      if (!id) {
        return reply.status(400).send({ error: 'missing-id' });
      }

      // TODO: Approve skill for public registry
      return { ok: true, id, approved: true };
    }
  );

  fastify.post('/admin/skills/:id/reject', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params ?? {};
    if (!id) {
      return reply.status(400).send({ error: 'missing-id' });
    }

    // TODO: Reject skill submission
    return { ok: true, id, rejected: true };
  });
}
