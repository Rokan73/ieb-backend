import prisma from '../../database/prisma';
import { parsePagination, parseSort } from '../../utils/pagination';
import { paginated } from '../../utils/response';
import {
  generateApplicationNumber,
  generateMembershipNumber,
} from '../../utils/membership-number';
import { writeAuditLog } from '../../utils/audit';
import { AuthUser, ListQuery } from '../../types';
import { CreateApplicationInput, UpdateApplicationInput } from './applications.validation';
import { addYears } from 'date-fns';

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['payment_pending', 'under_review', 'cancelled'],
  payment_pending: ['under_review', 'cancelled'],
  under_review: ['query', 'verified', 'rejected', 'cancelled'],
  query: ['resubmission_required', 'under_review'],
  resubmission_required: ['under_review', 'cancelled'],
  verified: ['recommended', 'rejected'],
  recommended: ['approved', 'rejected'],
  approved: [],
  rejected: [],
  cancelled: [],
};

async function addHistory(
  applicationId: string,
  action: string,
  fromStatus: string | null,
  toStatus: string | null,
  performedBy?: string,
  notes?: string
) {
  await prisma.applicationHistory.create({
    data: { applicationId, action, fromStatus, toStatus, performedBy, notes },
  });
}

export async function listApplications(query: ListQuery) {
  const { page, limit, skip } = parsePagination(query);
  const orderBy = parseSort(query, ['createdAt', 'applicationDate', 'status', 'applicantName']);

  const where: Record<string, unknown> = {};
  if (query.search) {
    const s = query.search.trim();
    where.OR = [
      { applicantName: { contains: s, mode: 'insensitive' } },
      { applicationNumber: { contains: s, mode: 'insensitive' } },
      { email: { contains: s, mode: 'insensitive' } },
      { mobile: { contains: s, mode: 'insensitive' } },
    ];
  }
  if (query.status) where.status = query.status;

  const [items, total] = await Promise.all([
    prisma.membershipApplication.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        requestedCategory: { select: { id: true, name: true, code: true } },
        member: { select: { id: true, membershipNumber: true } },
      },
    }),
    prisma.membershipApplication.count({ where }),
  ]);

  return paginated(items, total, page, limit);
}

export async function getApplicationById(id: string) {
  const app = await prisma.membershipApplication.findUnique({
    where: { id },
    include: {
      requestedCategory: true,
      member: true,
      documents: true,
      queries: { orderBy: { raisedAt: 'desc' } },
      history: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!app) throw new Error('NOT_FOUND');
  return app;
}

export async function createApplication(input: CreateApplicationInput, actor?: AuthUser) {
  const category = await prisma.membershipCategory.findUnique({
    where: { id: input.requestedCategoryId },
  });
  if (!category) throw new Error('Invalid membership category');

  const applicationNumber = generateApplicationNumber('APP');

  const app = await prisma.membershipApplication.create({
    data: {
      applicationNumber,
      applicantName: input.applicantName,
      email: input.email.toLowerCase(),
      mobile: input.mobile,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
      nidPassport: input.nidPassport,
      address: input.address,
      engineeringDiscipline: input.engineeringDiscipline,
      academicQualification: input.academicQualification,
      university: input.university,
      graduationYear: input.graduationYear,
      professionalExperience: input.professionalExperience,
      currentOrganization: input.currentOrganization,
      designation: input.designation,
      requestedCategoryId: input.requestedCategoryId,
      declarationAccepted: input.declarationAccepted,
      status: 'draft',
    },
    include: { requestedCategory: true },
  });

  await addHistory(app.id, 'CREATED', null, 'draft', actor?.id);
  await writeAuditLog({
    user: actor,
    action: 'CREATE',
    module: 'membership_applications',
    recordId: app.id,
    newData: { applicationNumber: app.applicationNumber },
  });

  return app;
}

export async function updateApplication(
  id: string,
  input: UpdateApplicationInput,
  actor?: AuthUser
) {
  const existing = await prisma.membershipApplication.findUnique({ where: { id } });
  if (!existing) throw new Error('NOT_FOUND');
  if (['approved', 'rejected', 'cancelled'].includes(existing.status)) {
    throw new Error('Cannot update a finalized application');
  }

  const app = await prisma.membershipApplication.update({
    where: { id },
    data: {
      ...(input.applicantName && { applicantName: input.applicantName }),
      ...(input.email && { email: input.email.toLowerCase() }),
      ...(input.mobile && { mobile: input.mobile }),
      ...(input.dateOfBirth !== undefined && {
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
      }),
      ...(input.nidPassport !== undefined && { nidPassport: input.nidPassport }),
      ...(input.address !== undefined && { address: input.address }),
      ...(input.engineeringDiscipline !== undefined && {
        engineeringDiscipline: input.engineeringDiscipline,
      }),
      ...(input.academicQualification !== undefined && {
        academicQualification: input.academicQualification,
      }),
      ...(input.university !== undefined && { university: input.university }),
      ...(input.graduationYear !== undefined && { graduationYear: input.graduationYear }),
      ...(input.professionalExperience !== undefined && {
        professionalExperience: input.professionalExperience,
      }),
      ...(input.currentOrganization !== undefined && {
        currentOrganization: input.currentOrganization,
      }),
      ...(input.designation !== undefined && { designation: input.designation }),
      ...(input.requestedCategoryId && { requestedCategoryId: input.requestedCategoryId }),
    },
    include: { requestedCategory: true },
  });

  await writeAuditLog({
    user: actor,
    action: 'UPDATE',
    module: 'membership_applications',
    recordId: id,
  });

  return app;
}

export async function submitApplication(id: string, actor?: AuthUser) {
  const existing = await prisma.membershipApplication.findUnique({ where: { id } });
  if (!existing) throw new Error('NOT_FOUND');
  if (!VALID_TRANSITIONS[existing.status]?.includes('submitted')) {
    throw new Error(`Cannot submit from status: ${existing.status}`);
  }

  const app = await prisma.membershipApplication.update({
    where: { id },
    data: { status: 'submitted' },
  });

  await addHistory(id, 'SUBMITTED', existing.status, 'submitted', actor?.id);
  await writeAuditLog({
    user: actor,
    action: 'SUBMIT',
    module: 'membership_applications',
    recordId: id,
  });

  return app;
}

export async function raiseQuery(
  id: string,
  queryText: string,
  actor: AuthUser
) {
  const existing = await prisma.membershipApplication.findUnique({ where: { id } });
  if (!existing) throw new Error('NOT_FOUND');
  if (!VALID_TRANSITIONS[existing.status]?.includes('query')) {
    throw new Error(`Cannot raise query from status: ${existing.status}`);
  }

  const [app] = await prisma.$transaction([
    prisma.membershipApplication.update({
      where: { id },
      data: { status: 'query' },
    }),
    prisma.applicationQuery.create({
      data: {
        applicationId: id,
        queryText,
        raisedBy: actor.id,
      },
    }),
  ]);

  await addHistory(id, 'QUERY_RAISED', existing.status, 'query', actor.id, queryText);
  await writeAuditLog({
    user: actor,
    action: 'QUERY',
    module: 'membership_applications',
    recordId: id,
    newData: { queryText },
  });

  return app;
}

export async function respondToQuery(
  id: string,
  queryId: string,
  responseText: string,
  actor?: AuthUser
) {
  const query = await prisma.applicationQuery.findFirst({
    where: { id: queryId, applicationId: id },
  });
  if (!query) throw new Error('NOT_FOUND');

  await prisma.applicationQuery.update({
    where: { id: queryId },
    data: {
      responseText,
      respondedAt: new Date(),
      status: 'responded',
    },
  });

  const app = await prisma.membershipApplication.update({
    where: { id },
    data: { status: 'resubmission_required' },
  });

  await addHistory(id, 'QUERY_RESPONDED', 'query', 'resubmission_required', actor?.id);
  return app;
}

export async function approveApplication(id: string, actor: AuthUser) {
  const existing = await prisma.membershipApplication.findUnique({
    where: { id },
    include: { requestedCategory: true },
  });
  if (!existing) throw new Error('NOT_FOUND');
  if (existing.status === 'approved') {
    throw new Error('Application is already approved');
  }
  if (!VALID_TRANSITIONS[existing.status]?.includes('approved') && existing.status !== 'recommended') {
    // Allow from recommended or verified for demo flexibility
    if (!['recommended', 'verified', 'under_review'].includes(existing.status)) {
      throw new Error(`Cannot approve from status: ${existing.status}`);
    }
  }

  let membershipNumber = generateMembershipNumber();
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.member.findUnique({ where: { membershipNumber } });
    if (!exists) break;
    membershipNumber = generateMembershipNumber();
  }

  const joiningDate = new Date();
  const expiryDate = addYears(joiningDate, 1);

  const result = await prisma.$transaction(async (tx) => {
    const member = await tx.member.create({
      data: {
        membershipNumber,
        fullName: existing.applicantName,
        email: existing.email,
        mobile: existing.mobile,
        dateOfBirth: existing.dateOfBirth,
        nidPassport: existing.nidPassport,
        presentAddress: existing.address,
        engineeringDiscipline: existing.engineeringDiscipline,
        academicQualification: existing.academicQualification,
        university: existing.university,
        graduationYear: existing.graduationYear,
        professionalExperience: existing.professionalExperience,
        currentOrganization: existing.currentOrganization,
        currentDesignation: existing.designation,
        categoryId: existing.requestedCategoryId,
        status: 'active',
        joiningDate,
        expiryDate,
      },
    });

    const app = await tx.membershipApplication.update({
      where: { id },
      data: {
        status: 'approved',
        memberId: member.id,
        approvedBy: actor.id,
        approvedAt: new Date(),
      },
      include: { member: true, requestedCategory: true },
    });

    return { app, member };
  });

  await addHistory(id, 'APPROVED', existing.status, 'approved', actor.id);
  await writeAuditLog({
    user: actor,
    action: 'APPROVE',
    module: 'membership_applications',
    recordId: id,
    newData: {
      membershipNumber: result.member.membershipNumber,
      memberId: result.member.id,
    },
  });

  return result.app;
}

export async function rejectApplication(id: string, reason: string, actor: AuthUser) {
  const existing = await prisma.membershipApplication.findUnique({ where: { id } });
  if (!existing) throw new Error('NOT_FOUND');
  if (['approved', 'rejected', 'cancelled'].includes(existing.status)) {
    throw new Error(`Cannot reject from status: ${existing.status}`);
  }

  const app = await prisma.membershipApplication.update({
    where: { id },
    data: {
      status: 'rejected',
      rejectionReason: reason,
      reviewedBy: actor.id,
      reviewedAt: new Date(),
    },
  });

  await addHistory(id, 'REJECTED', existing.status, 'rejected', actor.id, reason);
  await writeAuditLog({
    user: actor,
    action: 'REJECT',
    module: 'membership_applications',
    recordId: id,
    newData: { reason },
  });

  return app;
}
