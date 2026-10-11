import prisma from '../../database/prisma';
import { parsePagination, parseSort } from '../../utils/pagination';
import { paginated } from '../../utils/response';
import {
  generateApplicationNumber,
  generateRegistrationNumber,
  generateCertificateNumber,
  generateQrCode,
} from '../../utils/membership-number';
import { writeAuditLog } from '../../utils/audit';
import { AuthUser, ListQuery } from '../../types';
import { config } from '../../config';
import { z } from 'zod';
import { addYears } from 'date-fns';

export const createRegistrationSchema = z.object({
  applicantName: z.string().min(2),
  email: z.string().email(),
  mobile: z.string().optional(),
  memberId: z.string().uuid().optional(),
  registrationTypeId: z.string().uuid(),
  engineeringDiscipline: z.string().optional(),
  academicQualification: z.string().optional(),
  university: z.string().optional(),
  graduationYear: z.number().int().optional(),
  professionalExperience: z.string().optional(),
  currentOrganization: z.string().optional(),
  designation: z.string().optional(),
  experienceDetails: z.string().optional(),
});

export type CreateRegistrationInput = z.infer<typeof createRegistrationSchema>;

export async function listRegistrations(query: ListQuery) {
  const { page, limit, skip } = parsePagination(query);
  const orderBy = parseSort(query, ['createdAt', 'applicationDate', 'status']);

  const where: Record<string, unknown> = {};
  if (query.search) {
    const s = query.search.trim();
    where.OR = [
      { applicantName: { contains: s, mode: 'insensitive' } },
      { applicationNumber: { contains: s, mode: 'insensitive' } },
      { registrationNumber: { contains: s, mode: 'insensitive' } },
      { email: { contains: s, mode: 'insensitive' } },
    ];
  }
  if (query.status) where.status = query.status;

  const [items, total] = await Promise.all([
    prisma.professionalRegistration.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        registrationType: { select: { id: true, name: true, code: true } },
        member: { select: { membershipNumber: true, fullName: true } },
        certificate: { select: { certificateNumber: true, status: true } },
      },
    }),
    prisma.professionalRegistration.count({ where }),
  ]);

  return paginated(items, total, page, limit);
}

export async function getRegistrationById(id: string) {
  const reg = await prisma.professionalRegistration.findUnique({
    where: { id },
    include: {
      registrationType: true,
      member: true,
      documents: true,
      history: { orderBy: { createdAt: 'desc' } },
      certificate: true,
    },
  });
  if (!reg) throw new Error('NOT_FOUND');
  return reg;
}

export async function createRegistration(
  input: CreateRegistrationInput,
  actor?: AuthUser
) {
  const type = await prisma.registrationType.findUnique({
    where: { id: input.registrationTypeId },
  });
  if (!type) throw new Error('Invalid registration type');

  if (input.memberId) {
    const member = await prisma.member.findUnique({ where: { id: input.memberId } });
    if (!member) throw new Error('Member not found');
  }

  const reg = await prisma.professionalRegistration.create({
    data: {
      applicationNumber: generateApplicationNumber('PRAPP'),
      applicantName: input.applicantName,
      email: input.email.toLowerCase(),
      mobile: input.mobile,
      memberId: input.memberId || null,
      registrationTypeId: input.registrationTypeId,
      engineeringDiscipline: input.engineeringDiscipline,
      academicQualification: input.academicQualification,
      university: input.university,
      graduationYear: input.graduationYear,
      professionalExperience: input.professionalExperience,
      currentOrganization: input.currentOrganization,
      designation: input.designation,
      experienceDetails: input.experienceDetails,
      status: 'draft',
    },
    include: { registrationType: true },
  });

  await prisma.registrationHistory.create({
    data: {
      registrationId: reg.id,
      action: 'CREATED',
      fromStatus: null,
      toStatus: 'draft',
      performedBy: actor?.id,
    },
  });

  await writeAuditLog({
    user: actor,
    action: 'CREATE',
    module: 'professional_registrations',
    recordId: reg.id,
  });

  return reg;
}

export async function submitRegistration(id: string, actor?: AuthUser) {
  const existing = await prisma.professionalRegistration.findUnique({ where: { id } });
  if (!existing) throw new Error('NOT_FOUND');
  if (existing.status !== 'draft') {
    throw new Error(`Cannot submit from status: ${existing.status}`);
  }

  const reg = await prisma.professionalRegistration.update({
    where: { id },
    data: { status: 'submitted' },
  });

  await prisma.registrationHistory.create({
    data: {
      registrationId: id,
      action: 'SUBMITTED',
      fromStatus: 'draft',
      toStatus: 'submitted',
      performedBy: actor?.id,
    },
  });

  return reg;
}

export async function approveRegistration(id: string, actor: AuthUser) {
  const existing = await prisma.professionalRegistration.findUnique({
    where: { id },
    include: { registrationType: true },
  });
  if (!existing) throw new Error('NOT_FOUND');
  if (existing.status === 'approved') {
    throw new Error('Registration already approved');
  }
  if (['rejected', 'cancelled'].includes(existing.status)) {
    throw new Error(`Cannot approve from status: ${existing.status}`);
  }

  let registrationNumber = generateRegistrationNumber();
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.professionalRegistration.findUnique({
      where: { registrationNumber },
    });
    if (!exists) break;
    registrationNumber = generateRegistrationNumber();
  }

  const certificateNumber = generateCertificateNumber();
  const qrCode = generateQrCode();
  const issueDate = new Date();
  const expiryDate = addYears(issueDate, 5);
  const verificationUrl = `${config.app.publicVerifyBaseUrl}/verify-registration/${registrationNumber}`;

  const result = await prisma.$transaction(async (tx) => {
    const reg = await tx.professionalRegistration.update({
      where: { id },
      data: {
        status: 'approved',
        registrationNumber,
        approvedBy: actor.id,
        approvedAt: new Date(),
      },
      include: { registrationType: true },
    });

    const certificate = await tx.certificate.create({
      data: {
        certificateNumber,
        registrationId: id,
        registrationNumber,
        applicantName: existing.applicantName,
        engineeringDiscipline: existing.engineeringDiscipline,
        registrationType: existing.registrationType.name,
        issueDate,
        expiryDate,
        qrVerificationCode: qrCode,
        verificationUrl,
        status: 'active',
      },
    });

    await tx.registrationHistory.create({
      data: {
        registrationId: id,
        action: 'APPROVED',
        fromStatus: existing.status,
        toStatus: 'approved',
        performedBy: actor.id,
        notes: `Registration No: ${registrationNumber}`,
      },
    });

    return { reg, certificate };
  });

  await writeAuditLog({
    user: actor,
    action: 'APPROVE',
    module: 'professional_registrations',
    recordId: id,
    newData: {
      registrationNumber,
      certificateNumber,
    },
  });

  return result.reg;
}

export async function rejectRegistration(id: string, reason: string, actor: AuthUser) {
  const existing = await prisma.professionalRegistration.findUnique({ where: { id } });
  if (!existing) throw new Error('NOT_FOUND');
  if (['approved', 'rejected', 'cancelled'].includes(existing.status)) {
    throw new Error(`Cannot reject from status: ${existing.status}`);
  }

  const reg = await prisma.professionalRegistration.update({
    where: { id },
    data: {
      status: 'rejected',
      rejectionReason: reason,
      reviewedBy: actor.id,
      reviewedAt: new Date(),
    },
  });

  await prisma.registrationHistory.create({
    data: {
      registrationId: id,
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
    module: 'professional_registrations',
    recordId: id,
  });

  return reg;
}

export async function verifyRegistrationPublic(registrationNumber: string) {
  const reg = await prisma.professionalRegistration.findUnique({
    where: { registrationNumber },
    include: {
      registrationType: { select: { name: true, code: true } },
      certificate: {
        select: {
          certificateNumber: true,
          issueDate: true,
          expiryDate: true,
          status: true,
          qrVerificationCode: true,
        },
      },
    },
  });

  if (!reg || reg.status !== 'approved') {
    return {
      valid: false,
      message: 'Registration not found or not active',
    };
  }

  return {
    valid: true,
    registrationNumber: reg.registrationNumber,
    applicantName: reg.applicantName,
    registrationType: reg.registrationType.name,
    engineeringDiscipline: reg.engineeringDiscipline,
    status: reg.status,
    approvedAt: reg.approvedAt,
    certificate: reg.certificate
      ? {
          certificateNumber: reg.certificate.certificateNumber,
          issueDate: reg.certificate.issueDate,
          expiryDate: reg.certificate.expiryDate,
          status: reg.certificate.status,
        }
      : null,
  };
}

export async function verifyMemberPublic(membershipNumber: string) {
  const member = await prisma.member.findUnique({
    where: { membershipNumber },
    include: {
      category: { select: { name: true, code: true } },
    },
  });

  if (!member) {
    return { valid: false, message: 'Membership not found' };
  }

  return {
    valid: true,
    membershipNumber: member.membershipNumber,
    fullName: member.fullName,
    category: member.category.name,
    status: member.status,
    joiningDate: member.joiningDate,
    expiryDate: member.expiryDate,
    engineeringDiscipline: member.engineeringDiscipline,
  };
}

export async function listRegistrationTypes() {
  return prisma.registrationType.findMany({
    where: { status: 'active' },
    orderBy: { name: 'asc' },
  });
}

export async function getRegistrationStats() {
  const [pending, underReview, approved, rejected] = await Promise.all([
    prisma.professionalRegistration.count({
      where: { status: { in: ['draft', 'submitted'] } },
    }),
    prisma.professionalRegistration.count({
      where: {
        status: {
          in: ['under_review', 'query', 'document_verification', 'assessment', 'recommended'],
        },
      },
    }),
    prisma.professionalRegistration.count({ where: { status: 'approved' } }),
    prisma.professionalRegistration.count({ where: { status: 'rejected' } }),
  ]);

  return { pending, underReview, approved, rejected };
}
