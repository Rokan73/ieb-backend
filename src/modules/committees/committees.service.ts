import prisma from '../../database/prisma';
import { parsePagination, parseSort } from '../../utils/pagination';
import { paginated } from '../../utils/response';
import { writeAuditLog } from '../../utils/audit';
import { AuthUser, ListQuery } from '../../types';
import { z } from 'zod';

export const createCommitteeSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2),
  typeId: z.string().uuid(),
  description: z.string().optional(),
  centre: z.string().optional(),
  location: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(['active', 'inactive', 'expired']).optional(),
});

export const addCommitteeMemberSchema = z.object({
  memberId: z.string().uuid(),
  positionId: z.string().uuid(),
  appointmentDate: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type CreateCommitteeInput = z.infer<typeof createCommitteeSchema>;
export type AddCommitteeMemberInput = z.infer<typeof addCommitteeMemberSchema>;

export async function listCommittees(query: ListQuery) {
  const { page, limit, skip } = parsePagination(query);
  const orderBy = parseSort(query, ['createdAt', 'name', 'startDate', 'status']);

  const where: Record<string, unknown> = {};
  if (query.search) {
    const s = query.search.trim();
    where.OR = [
      { name: { contains: s, mode: 'insensitive' } },
      { code: { contains: s, mode: 'insensitive' } },
      { centre: { contains: s, mode: 'insensitive' } },
    ];
  }
  if (query.status) where.status = query.status;
  if (query.typeId) where.typeId = query.typeId;

  const [items, total] = await Promise.all([
    prisma.committee.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        type: true,
        _count: { select: { members: true } },
      },
    }),
    prisma.committee.count({ where }),
  ]);

  return paginated(items, total, page, limit);
}

export async function getCommitteeById(id: string) {
  const committee = await prisma.committee.findUnique({
    where: { id },
    include: {
      type: true,
      members: {
        include: {
          member: {
            select: {
              id: true,
              membershipNumber: true,
              fullName: true,
              email: true,
              mobile: true,
            },
          },
          position: true,
        },
        orderBy: { position: { sortOrder: 'asc' } },
      },
    },
  });
  if (!committee) throw new Error('NOT_FOUND');
  return committee;
}

export async function createCommittee(input: CreateCommitteeInput, actor?: AuthUser) {
  const type = await prisma.committeeType.findUnique({ where: { id: input.typeId } });
  if (!type) throw new Error('Invalid committee type');

  const committee = await prisma.committee.create({
    data: {
      name: input.name,
      code: input.code.toUpperCase(),
      typeId: input.typeId,
      description: input.description,
      centre: input.centre,
      location: input.location,
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
      status: input.status || 'active',
    },
    include: { type: true },
  });

  await writeAuditLog({
    user: actor,
    action: 'CREATE',
    module: 'committees',
    recordId: committee.id,
    newData: { name: committee.name, code: committee.code },
  });

  return committee;
}

export async function updateCommittee(
  id: string,
  input: Partial<CreateCommitteeInput>,
  actor?: AuthUser
) {
  const existing = await prisma.committee.findUnique({ where: { id } });
  if (!existing) throw new Error('NOT_FOUND');

  const committee = await prisma.committee.update({
    where: { id },
    data: {
      ...(input.name && { name: input.name }),
      ...(input.code && { code: input.code.toUpperCase() }),
      ...(input.typeId && { typeId: input.typeId }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.centre !== undefined && { centre: input.centre }),
      ...(input.location !== undefined && { location: input.location }),
      ...(input.startDate !== undefined && {
        startDate: input.startDate ? new Date(input.startDate) : null,
      }),
      ...(input.endDate !== undefined && {
        endDate: input.endDate ? new Date(input.endDate) : null,
      }),
      ...(input.status && { status: input.status }),
    },
    include: { type: true },
  });

  await writeAuditLog({
    user: actor,
    action: 'UPDATE',
    module: 'committees',
    recordId: id,
  });

  return committee;
}

export async function addCommitteeMember(
  committeeId: string,
  input: AddCommitteeMemberInput,
  actor?: AuthUser
) {
  const committee = await prisma.committee.findUnique({ where: { id: committeeId } });
  if (!committee) throw new Error('Committee not found');

  const member = await prisma.member.findUnique({ where: { id: input.memberId } });
  if (!member) throw new Error('Member not found');

  const position = await prisma.committeePosition.findUnique({
    where: { id: input.positionId },
  });
  if (!position) throw new Error('Position not found');

  const existing = await prisma.committeeMember.findFirst({
    where: {
      committeeId,
      memberId: input.memberId,
      positionId: input.positionId,
      status: 'active',
    },
  });
  if (existing) throw new Error('Member already holds this position in the committee');

  const cm = await prisma.committeeMember.create({
    data: {
      committeeId,
      memberId: input.memberId,
      positionId: input.positionId,
      appointmentDate: input.appointmentDate
        ? new Date(input.appointmentDate)
        : new Date(),
      startDate: input.startDate ? new Date(input.startDate) : new Date(),
      endDate: input.endDate ? new Date(input.endDate) : null,
      status: 'active',
    },
    include: {
      member: { select: { membershipNumber: true, fullName: true } },
      position: true,
    },
  });

  await writeAuditLog({
    user: actor,
    action: 'ADD_MEMBER',
    module: 'committees',
    recordId: committeeId,
    newData: { memberId: input.memberId, position: position.name },
  });

  return cm;
}

export async function removeCommitteeMember(
  committeeId: string,
  committeeMemberId: string,
  actor?: AuthUser
) {
  const cm = await prisma.committeeMember.findFirst({
    where: { id: committeeMemberId, committeeId },
  });
  if (!cm) throw new Error('NOT_FOUND');

  await prisma.committeeMember.update({
    where: { id: committeeMemberId },
    data: { status: 'removed' },
  });

  await writeAuditLog({
    user: actor,
    action: 'REMOVE_MEMBER',
    module: 'committees',
    recordId: committeeId,
    oldData: { committeeMemberId },
  });

  return { success: true };
}

export async function listCommitteeTypes() {
  return prisma.committeeType.findMany({ where: { status: 'active' }, orderBy: { name: 'asc' } });
}

export async function listCommitteePositions() {
  return prisma.committeePosition.findMany({ orderBy: { sortOrder: 'asc' } });
}

export async function getCommitteeStats() {
  const [total, active, expired, totalMembers] = await Promise.all([
    prisma.committee.count(),
    prisma.committee.count({ where: { status: 'active' } }),
    prisma.committee.count({ where: { status: 'expired' } }),
    prisma.committeeMember.count({ where: { status: 'active' } }),
  ]);

  const byType = await prisma.committee.groupBy({
    by: ['typeId'],
    _count: { id: true },
  });

  const types = await prisma.committeeType.findMany();
  const typeMap = Object.fromEntries(types.map((t) => [t.id, t]));

  return {
    total,
    active,
    expired,
    totalMembers,
    byType: byType.map((r) => ({
      type: typeMap[r.typeId] || { id: r.typeId, name: 'Unknown' },
      count: r._count.id,
    })),
  };
}
