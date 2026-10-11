import prisma from '../../database/prisma';
import { parsePagination, parseSort } from '../../utils/pagination';
import { paginated } from '../../utils/response';
import { generateEventCode, generateApplicationNumber } from '../../utils/membership-number';
import { writeAuditLog } from '../../utils/audit';
import { AuthUser, ListQuery } from '../../types';
import { z } from 'zod';

export const createEventSchema = z.object({
  name: z.string().min(2),
  typeId: z.string().uuid(),
  description: z.string().optional(),
  organizer: z.string().optional(),
  centre: z.string().optional(),
  venue: z.string().optional(),
  isOnline: z.boolean().optional(),
  startDate: z.string(),
  endDate: z.string(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  registrationStart: z.string().optional(),
  registrationEnd: z.string().optional(),
  capacity: z.number().int().positive().optional(),
  registrationFee: z.number().min(0).optional(),
  status: z
    .enum([
      'draft',
      'published',
      'registration_open',
      'registration_closed',
      'ongoing',
      'completed',
      'cancelled',
    ])
    .optional(),
  featuredImageUrl: z.string().url().optional().or(z.literal('')),
});

export const registerEventSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  mobile: z.string().optional(),
  memberId: z.string().uuid().optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type RegisterEventInput = z.infer<typeof registerEventSchema>;

export async function listEvents(query: ListQuery, publicOnly = false) {
  const { page, limit, skip } = parsePagination(query);
  const orderBy = parseSort(query, ['createdAt', 'startDate', 'name', 'status']);

  const where: Record<string, unknown> = {};
  if (publicOnly) {
    where.status = { in: ['published', 'registration_open', 'registration_closed', 'ongoing', 'completed'] };
  }
  if (query.search) {
    const s = query.search.trim();
    where.OR = [
      { name: { contains: s, mode: 'insensitive' } },
      { eventCode: { contains: s, mode: 'insensitive' } },
      { venue: { contains: s, mode: 'insensitive' } },
    ];
  }
  if (query.status) where.status = query.status;
  if (query.typeId) where.typeId = query.typeId;

  const [items, total] = await Promise.all([
    prisma.event.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        type: true,
        _count: { select: { registrations: true } },
      },
    }),
    prisma.event.count({ where }),
  ]);

  return paginated(items, total, page, limit);
}

export async function getEventById(id: string) {
  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      type: true,
      _count: { select: { registrations: true } },
    },
  });
  if (!event) throw new Error('NOT_FOUND');
  return event;
}

export async function createEvent(input: CreateEventInput, actor?: AuthUser) {
  const type = await prisma.eventType.findUnique({ where: { id: input.typeId } });
  if (!type) throw new Error('Invalid event type');

  const event = await prisma.event.create({
    data: {
      eventCode: generateEventCode(),
      name: input.name,
      typeId: input.typeId,
      description: input.description,
      organizer: input.organizer,
      centre: input.centre,
      venue: input.venue,
      isOnline: input.isOnline ?? false,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      startTime: input.startTime,
      endTime: input.endTime,
      registrationStart: input.registrationStart
        ? new Date(input.registrationStart)
        : null,
      registrationEnd: input.registrationEnd ? new Date(input.registrationEnd) : null,
      capacity: input.capacity,
      registrationFee: input.registrationFee ?? 0,
      status: input.status || 'draft',
      featuredImageUrl: input.featuredImageUrl || null,
      createdBy: actor?.id,
    },
    include: { type: true },
  });

  await writeAuditLog({
    user: actor,
    action: 'CREATE',
    module: 'events',
    recordId: event.id,
    newData: { eventCode: event.eventCode, name: event.name },
  });

  return event;
}

export async function updateEvent(
  id: string,
  input: Partial<CreateEventInput>,
  actor?: AuthUser
) {
  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) throw new Error('NOT_FOUND');

  const event = await prisma.event.update({
    where: { id },
    data: {
      ...(input.name && { name: input.name }),
      ...(input.typeId && { typeId: input.typeId }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.organizer !== undefined && { organizer: input.organizer }),
      ...(input.centre !== undefined && { centre: input.centre }),
      ...(input.venue !== undefined && { venue: input.venue }),
      ...(input.isOnline !== undefined && { isOnline: input.isOnline }),
      ...(input.startDate && { startDate: new Date(input.startDate) }),
      ...(input.endDate && { endDate: new Date(input.endDate) }),
      ...(input.startTime !== undefined && { startTime: input.startTime }),
      ...(input.endTime !== undefined && { endTime: input.endTime }),
      ...(input.registrationStart !== undefined && {
        registrationStart: input.registrationStart
          ? new Date(input.registrationStart)
          : null,
      }),
      ...(input.registrationEnd !== undefined && {
        registrationEnd: input.registrationEnd
          ? new Date(input.registrationEnd)
          : null,
      }),
      ...(input.capacity !== undefined && { capacity: input.capacity }),
      ...(input.registrationFee !== undefined && { registrationFee: input.registrationFee }),
      ...(input.status && { status: input.status }),
      ...(input.featuredImageUrl !== undefined && {
        featuredImageUrl: input.featuredImageUrl || null,
      }),
    },
    include: { type: true },
  });

  await writeAuditLog({
    user: actor,
    action: 'UPDATE',
    module: 'events',
    recordId: id,
  });

  return event;
}

export async function registerForEvent(
  eventId: string,
  input: RegisterEventInput,
  actor?: AuthUser
) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { _count: { select: { registrations: true } } },
  });
  if (!event) throw new Error('Event not found');

  if (!['published', 'registration_open'].includes(event.status)) {
    throw new Error('Registration is not open for this event');
  }

  if (event.capacity && event._count.registrations >= event.capacity) {
    throw new Error('Event is at full capacity');
  }

  const existingReg = await prisma.eventRegistration.findFirst({
    where: { eventId, email: input.email.toLowerCase() },
  });
  if (existingReg) throw new Error('Already registered for this event');

  if (input.memberId) {
    const memberExists = await prisma.member.findUnique({ where: { id: input.memberId } });
    if (!memberExists) throw new Error('Member not found');
  }

  const registration = await prisma.eventRegistration.create({
    data: {
      registrationNumber: generateApplicationNumber('EREG'),
      eventId,
      memberId: input.memberId || null,
      name: input.name,
      email: input.email.toLowerCase(),
      mobile: input.mobile,
      paymentStatus: Number(event.registrationFee) > 0 ? 'pending' : 'free',
      attendanceStatus: 'registered',
    },
    include: {
      event: { select: { eventCode: true, name: true } },
    },
  });

  await writeAuditLog({
    user: actor,
    action: 'REGISTER',
    module: 'events',
    recordId: eventId,
    newData: { registrationNumber: registration.registrationNumber, email: input.email },
  });

  return registration;
}

export async function listParticipants(eventId: string, query: ListQuery) {
  const { page, limit, skip } = parsePagination(query);
  const where: Record<string, unknown> = { eventId };
  if (query.search) {
    const s = query.search.trim();
    where.OR = [
      { name: { contains: s, mode: 'insensitive' } },
      { email: { contains: s, mode: 'insensitive' } },
      { registrationNumber: { contains: s, mode: 'insensitive' } },
    ];
  }
  if (query.status) where.attendanceStatus = query.status;

  const [items, total] = await Promise.all([
    prisma.eventRegistration.findMany({
      where,
      skip,
      take: limit,
      orderBy: { registrationDate: 'desc' },
      include: {
        member: { select: { membershipNumber: true, fullName: true } },
      },
    }),
    prisma.eventRegistration.count({ where }),
  ]);

  return paginated(items, total, page, limit);
}

export async function markAttendance(
  eventId: string,
  registrationId: string,
  status: 'attended' | 'absent',
  actor?: AuthUser
) {
  const reg = await prisma.eventRegistration.findFirst({
    where: { id: registrationId, eventId },
  });
  if (!reg) throw new Error('NOT_FOUND');

  const updated = await prisma.eventRegistration.update({
    where: { id: registrationId },
    data: { attendanceStatus: status },
  });

  await writeAuditLog({
    user: actor,
    action: 'MARK_ATTENDANCE',
    module: 'events',
    recordId: eventId,
    newData: { registrationId, status },
  });

  return updated;
}

export async function listEventTypes() {
  return prisma.eventType.findMany({ where: { status: 'active' }, orderBy: { name: 'asc' } });
}

export async function getEventStats() {
  const [total, upcoming, ongoing, completed, cancelled, totalRegs] = await Promise.all([
    prisma.event.count(),
    prisma.event.count({
      where: {
        status: { in: ['published', 'registration_open'] },
        startDate: { gte: new Date() },
      },
    }),
    prisma.event.count({ where: { status: 'ongoing' } }),
    prisma.event.count({ where: { status: 'completed' } }),
    prisma.event.count({ where: { status: 'cancelled' } }),
    prisma.eventRegistration.count(),
  ]);

  const revenue = await prisma.eventRegistration.aggregate({
    where: { paymentStatus: 'paid' },
    _count: true,
  });

  return {
    total,
    upcoming,
    ongoing,
    completed,
    cancelled,
    totalRegistrations: totalRegs,
    paidRegistrations: revenue._count,
  };
}
