import prisma from '../../database/prisma';
import { parsePagination, parseSort } from '../../utils/pagination';
import { paginated } from '../../utils/response';
import { writeAuditLog } from '../../utils/audit';
import { AuthUser, ListQuery } from '../../types';

function generateTicketNumber() {
  const y = new Date().getFullYear();
  const n = Math.floor(10000 + Math.random() * 90000);
  return `TKT-${y}-${n}`;
}

export async function listTicketCategories() {
  return prisma.ticketCategory.findMany({
    where: { status: 'active' },
    orderBy: { name: 'asc' },
  });
}

export async function listTickets(query: ListQuery) {
  const { page, limit, skip } = parsePagination(query);
  const orderBy = parseSort(query, ['createdAt', 'priority', 'status', 'slaDueAt']);

  const where: Record<string, unknown> = {};
  if (query.search) {
    const s = query.search.trim();
    where.OR = [
      { ticketNumber: { contains: s, mode: 'insensitive' } },
      { subject: { contains: s, mode: 'insensitive' } },
      { requesterName: { contains: s, mode: 'insensitive' } },
      { requesterEmail: { contains: s, mode: 'insensitive' } },
    ];
  }
  if (query.status) where.status = query.status;
  if (query.type) where.type = query.type;
  if (query.priority) where.priority = query.priority;
  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.assignedToId) where.assignedToId = query.assignedToId;

  const [items, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        category: { select: { id: true, name: true, code: true, type: true, slaHours: true } },
        member: { select: { id: true, membershipNumber: true, fullName: true } },
      },
    }),
    prisma.ticket.count({ where }),
  ]);

  return paginated(items, total, page, limit);
}

export async function getTicketById(id: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      category: true,
      member: { select: { id: true, membershipNumber: true, fullName: true, email: true, mobile: true } },
      comments: { orderBy: { createdAt: 'asc' } },
      history: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!ticket) throw new Error('NOT_FOUND');
  return ticket;
}

export async function createTicket(
  input: {
    type: string;
    categoryId: string;
    subject: string;
    description: string;
    priority?: string;
    memberId?: string;
    requesterName: string;
    requesterEmail: string;
    requesterMobile?: string;
  },
  actor?: AuthUser
) {
  const category = await prisma.ticketCategory.findUnique({ where: { id: input.categoryId } });
  if (!category) throw new Error('Invalid ticket category');

  let ticketNumber = generateTicketNumber();
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.ticket.findUnique({ where: { ticketNumber } });
    if (!exists) break;
    ticketNumber = generateTicketNumber();
  }

  const slaDueAt = new Date();
  slaDueAt.setHours(slaDueAt.getHours() + (category.slaHours || 72));

  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber,
      type: input.type || category.type,
      categoryId: input.categoryId,
      subject: input.subject,
      description: input.description,
      priority: input.priority || 'medium',
      status: 'open',
      memberId: input.memberId || null,
      requesterName: input.requesterName,
      requesterEmail: input.requesterEmail,
      requesterMobile: input.requesterMobile || null,
      slaDueAt,
      createdById: actor?.id || null,
      history: {
        create: {
          action: 'CREATED',
          toStatus: 'open',
          performedBy: actor?.fullName || 'System',
          notes: 'Ticket created',
        },
      },
    },
    include: { category: true },
  });

  await writeAuditLog({
    user: actor,
    action: 'CREATE',
    module: 'tickets',
    recordId: ticket.id,
    newData: { ticketNumber: ticket.ticketNumber, subject: ticket.subject },
  });

  return ticket;
}

export async function assignTicket(id: string, assignedToId: string, actor?: AuthUser) {
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) throw new Error('NOT_FOUND');

  const updated = await prisma.ticket.update({
    where: { id },
    data: {
      assignedToId,
      assignedAt: new Date(),
      status: ticket.status === 'open' ? 'assigned' : ticket.status,
      history: {
        create: {
          action: 'ASSIGNED',
          fromStatus: ticket.status,
          toStatus: ticket.status === 'open' ? 'assigned' : ticket.status,
          performedBy: actor?.fullName || 'System',
          notes: `Assigned to user ${assignedToId}`,
        },
      },
    },
    include: { category: true },
  });
  return updated;
}

export async function updateTicketStatus(
  id: string,
  status: string,
  notes?: string,
  resolution?: string,
  actor?: AuthUser
) {
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) throw new Error('NOT_FOUND');

  const data: Record<string, unknown> = { status };
  if (status === 'resolved') {
    data.resolvedAt = new Date();
    if (resolution) data.resolution = resolution;
  }
  if (status === 'closed') {
    data.closedAt = new Date();
  }

  const updated = await prisma.ticket.update({
    where: { id },
    data: {
      ...data,
      history: {
        create: {
          action: 'STATUS_CHANGE',
          fromStatus: ticket.status,
          toStatus: status,
          performedBy: actor?.fullName || 'System',
          notes: notes || resolution || undefined,
        },
      },
    },
    include: {
      category: true,
      comments: { orderBy: { createdAt: 'asc' } },
      history: { orderBy: { createdAt: 'desc' } },
    },
  });
  return updated;
}

export async function addTicketComment(
  id: string,
  body: string,
  isInternal: boolean,
  actor?: AuthUser
) {
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) throw new Error('NOT_FOUND');

  const comment = await prisma.ticketComment.create({
    data: {
      ticketId: id,
      authorId: actor?.id || null,
      authorName: actor?.fullName || 'Anonymous',
      body,
      isInternal: !!isInternal,
    },
  });

  await prisma.ticketHistory.create({
    data: {
      ticketId: id,
      action: 'COMMENT',
      performedBy: actor?.fullName || 'Anonymous',
      notes: isInternal ? 'Internal note added' : 'Comment added',
    },
  });

  return comment;
}

export async function submitTicketFeedback(
  id: string,
  rating: number,
  comment?: string
) {
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) throw new Error('NOT_FOUND');
  if (!['resolved', 'closed'].includes(ticket.status)) {
    throw new Error('Feedback only allowed on resolved/closed tickets');
  }

  return prisma.ticket.update({
    where: { id },
    data: {
      feedbackRating: rating,
      feedbackComment: comment || null,
    },
  });
}

export async function getTicketStats() {
  const [open, assigned, inProgress, pending, resolved, closed, total] = await Promise.all([
    prisma.ticket.count({ where: { status: 'open' } }),
    prisma.ticket.count({ where: { status: 'assigned' } }),
    prisma.ticket.count({ where: { status: 'in_progress' } }),
    prisma.ticket.count({ where: { status: 'pending' } }),
    prisma.ticket.count({ where: { status: 'resolved' } }),
    prisma.ticket.count({ where: { status: 'closed' } }),
    prisma.ticket.count(),
  ]);
  return { open, assigned, inProgress, pending, resolved, closed, total };
}
