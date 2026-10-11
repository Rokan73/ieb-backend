import prisma from '../../database/prisma';
import { parsePagination, parseSort } from '../../utils/pagination';
import { paginated } from '../../utils/response';
import { generateRenewalNumber } from '../../utils/membership-number';
import { writeAuditLog } from '../../utils/audit';
import { AuthUser, ListQuery } from '../../types';
import { addYears } from 'date-fns';
import { z } from 'zod';

export const createRenewalSchema = z.object({
  memberId: z.string().uuid(),
  renewalPeriod: z.enum(['1_year', '2_year', '5_year']),
  contactEmail: z.string().email().optional(),
  contactMobile: z.string().optional(),
});

export type CreateRenewalInput = z.infer<typeof createRenewalSchema>;

const periodYears: Record<string, number> = {
  '1_year': 1,
  '2_year': 2,
  '5_year': 5,
};

export async function listRenewals(query: ListQuery) {
  const { page, limit, skip } = parsePagination(query);
  const orderBy = parseSort(query, ['createdAt', 'requestedAt', 'status']);

  const where: Record<string, unknown> = {};
  if (query.search) {
    const s = query.search.trim();
    where.OR = [
      { renewalNumber: { contains: s, mode: 'insensitive' } },
      { member: { fullName: { contains: s, mode: 'insensitive' } } },
      { member: { membershipNumber: { contains: s, mode: 'insensitive' } } },
    ];
  }
  if (query.status) where.status = query.status;
  if (query.memberId) where.memberId = query.memberId;

  const [items, total] = await Promise.all([
    prisma.membershipRenewal.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        member: {
          select: {
            id: true,
            membershipNumber: true,
            fullName: true,
            status: true,
            expiryDate: true,
          },
        },
        category: { select: { id: true, name: true, code: true, fee: true } },
      },
    }),
    prisma.membershipRenewal.count({ where }),
  ]);

  return paginated(items, total, page, limit);
}

export async function getRenewalById(id: string) {
  const renewal = await prisma.membershipRenewal.findUnique({
    where: { id },
    include: {
      member: true,
      category: true,
      history: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!renewal) throw new Error('NOT_FOUND');
  return renewal;
}

export async function createRenewal(input: CreateRenewalInput, actor?: AuthUser) {
  const member = await prisma.member.findUnique({
    where: { id: input.memberId },
    include: { category: true },
  });
  if (!member) throw new Error('Member not found');
  if (member.status === 'cancelled' || member.status === 'deceased') {
    throw new Error('Cannot renew cancelled or deceased membership');
  }

  const years = periodYears[input.renewalPeriod] || 1;
  const feeAmount = Number(member.category.fee) * years;

  const renewal = await prisma.membershipRenewal.create({
    data: {
      renewalNumber: generateRenewalNumber(),
      memberId: member.id,
      categoryId: member.categoryId,
      renewalPeriod: input.renewalPeriod,
      feeAmount,
      paymentStatus: 'pending',
      status: 'pending',
      contactEmail: input.contactEmail || member.email,
      contactMobile: input.contactMobile || member.mobile,
    },
    include: {
      member: { select: { membershipNumber: true, fullName: true } },
      category: true,
    },
  });

  await prisma.renewalHistory.create({
    data: {
      renewalId: renewal.id,
      action: 'CREATED',
      fromStatus: null,
      toStatus: 'pending',
      performedBy: actor?.id,
    },
  });

  await writeAuditLog({
    user: actor,
    action: 'CREATE',
    module: 'membership_renewals',
    recordId: renewal.id,
  });

  return renewal;
}

export async function approveRenewal(id: string, actor: AuthUser) {
  const existing = await prisma.membershipRenewal.findUnique({
    where: { id },
    include: { member: true },
  });
  if (!existing) throw new Error('NOT_FOUND');
  if (existing.status === 'approved') throw new Error('Renewal already approved');
  if (!existing.member) throw new Error('Member does not exist');

  const years = periodYears[existing.renewalPeriod] || 1;
  const baseDate =
    existing.member.expiryDate && existing.member.expiryDate > new Date()
      ? existing.member.expiryDate
      : new Date();
  const newExpiryDate = addYears(baseDate, years);

  const result = await prisma.$transaction(async (tx) => {
    await tx.member.update({
      where: { id: existing.memberId },
      data: {
        expiryDate: newExpiryDate,
        status: 'active',
      },
    });

    const renewal = await tx.membershipRenewal.update({
      where: { id },
      data: {
        status: 'approved',
        paymentStatus: 'paid',
        approvedBy: actor.id,
        approvedAt: new Date(),
        newExpiryDate,
      },
      include: { member: true, category: true },
    });

    await tx.renewalHistory.create({
      data: {
        renewalId: id,
        action: 'APPROVED',
        fromStatus: existing.status,
        toStatus: 'approved',
        performedBy: actor.id,
        notes: `New expiry: ${newExpiryDate.toISOString().slice(0, 10)}`,
      },
    });

    return renewal;
  });

  await writeAuditLog({
    user: actor,
    action: 'APPROVE',
    module: 'membership_renewals',
    recordId: id,
    newData: { newExpiryDate },
  });

  return result;
}

export async function rejectRenewal(id: string, reason: string, actor: AuthUser) {
  const existing = await prisma.membershipRenewal.findUnique({ where: { id } });
  if (!existing) throw new Error('NOT_FOUND');
  if (['approved', 'rejected', 'cancelled'].includes(existing.status)) {
    throw new Error(`Cannot reject from status: ${existing.status}`);
  }

  const renewal = await prisma.membershipRenewal.update({
    where: { id },
    data: {
      status: 'rejected',
      rejectionReason: reason,
      reviewedBy: actor.id,
      reviewedAt: new Date(),
    },
  });

  await prisma.renewalHistory.create({
    data: {
      renewalId: id,
      action: 'REJECTED',
      fromStatus: existing.status,
      toStatus: 'rejected',
      performedBy: actor.id,
      notes: reason,
    },
  });

  await writeAuditLog({
    user: actor,
    action: 'REJECT',
    module: 'membership_renewals',
    recordId: id,
  });

  return renewal;
}

export async function getRenewalStats() {
  const [pending, approved, rejected, due] = await Promise.all([
    prisma.membershipRenewal.count({ where: { status: 'pending' } }),
    prisma.membershipRenewal.count({ where: { status: 'approved' } }),
    prisma.membershipRenewal.count({ where: { status: 'rejected' } }),
    prisma.member.count({
      where: {
        status: 'active',
        expiryDate: { lte: addYears(new Date(), 0.25) }, // next 3 months approx
      },
    }),
  ]);

  const revenue = await prisma.membershipRenewal.aggregate({
    where: { status: 'approved' },
    _sum: { feeAmount: true },
  });

  return {
    pending,
    approved,
    rejected,
    due,
    revenue: Number(revenue._sum.feeAmount || 0),
  };
}
