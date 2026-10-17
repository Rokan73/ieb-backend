import prisma from '../../database/prisma';
import { parsePagination, parseSort } from '../../utils/pagination';
import { paginated } from '../../utils/response';
import { generateMembershipNumber } from '../../utils/membership-number';
import { writeAuditLog } from '../../utils/audit';
import { AuthUser, ListQuery } from '../../types';
import { CreateMemberInput, UpdateMemberInput } from './members.validation';

export async function listMembers(query: ListQuery) {
  const { page, limit, skip } = parsePagination(query);
  const orderBy = parseSort(query, [
    'createdAt',
    'fullName',
    'membershipNumber',
    'joiningDate',
    'expiryDate',
    'status',
  ]);

  const where: Record<string, unknown> = {};

  if (query.search) {
    const s = query.search.trim();
    where.OR = [
      { fullName: { contains: s, mode: 'insensitive' } },
      { membershipNumber: { contains: s, mode: 'insensitive' } },
      { email: { contains: s, mode: 'insensitive' } },
      { mobile: { contains: s, mode: 'insensitive' } },
      { nidPassport: { contains: s, mode: 'insensitive' } },
    ];
  }
  if (query.status) where.status = query.status;
  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.discipline) {
    where.engineeringDiscipline = { contains: query.discipline, mode: 'insensitive' };
  }
  if (query.district) {
    where.district = { contains: query.district, mode: 'insensitive' };
  }

  const [items, total] = await Promise.all([
    prisma.member.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        category: { select: { id: true, name: true, code: true } },
      },
    }),
    prisma.member.count({ where }),
  ]);

  return paginated(items, total, page, limit);
}

export async function getMemberById(id: string) {
  const member = await prisma.member.findUnique({
    where: { id },
    include: {
      category: true,
      user: { select: { id: true, email: true, fullName: true } },
    },
  });
  if (!member) throw new Error('NOT_FOUND');
  return member;
}

export async function getMemberByMembershipNumber(membershipNumber: string) {
  const member = await prisma.member.findUnique({
    where: { membershipNumber },
    include: {
      category: { select: { name: true, code: true } },
    },
  });
  if (!member) throw new Error('NOT_FOUND');
  return member;
}

export async function createMember(input: CreateMemberInput, actor?: AuthUser) {
  const category = await prisma.membershipCategory.findUnique({
    where: { id: input.categoryId },
  });
  if (!category) throw new Error('Invalid membership category');

  let membershipNumber = generateMembershipNumber();
  // ensure uniqueness
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.member.findUnique({ where: { membershipNumber } });
    if (!exists) break;
    membershipNumber = generateMembershipNumber();
  }

  const member = await prisma.member.create({
    data: {
      membershipNumber,
      fullName: input.fullName,
      nameInBangla: input.nameInBangla,
      fatherName: input.fatherName,
      motherName: input.motherName,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
      gender: input.gender,
      nationality: input.nationality || 'Bangladeshi',
      nidPassport: input.nidPassport,
      email: input.email || null,
      mobile: input.mobile,
      alternatePhone: input.alternatePhone,
      presentAddress: input.presentAddress,
      permanentAddress: input.permanentAddress,
      district: input.district,
      division: input.division,
      engineeringDiscipline: input.engineeringDiscipline,
      academicQualification: input.academicQualification,
      university: input.university,
      graduationYear: input.graduationYear,
      professionalExperience: input.professionalExperience,
      currentOrganization: input.currentOrganization,
      currentDesignation: input.currentDesignation,
      categoryId: input.categoryId,
      status: input.status || 'active',
      joiningDate: input.joiningDate ? new Date(input.joiningDate) : new Date(),
      expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
      profilePhotoUrl: input.profilePhotoUrl || null,
      signatureUrl: input.signatureUrl || null,
    },
    include: { category: true },
  });

  await writeAuditLog({
    user: actor,
    action: 'CREATE',
    module: 'members',
    recordId: member.id,
    newData: { membershipNumber: member.membershipNumber, fullName: member.fullName },
  });

  return member;
}

export async function updateMember(
  id: string,
  input: UpdateMemberInput,
  actor?: AuthUser
) {
  const existing = await prisma.member.findUnique({ where: { id } });
  if (!existing) throw new Error('NOT_FOUND');

  if (input.categoryId) {
    const cat = await prisma.membershipCategory.findUnique({
      where: { id: input.categoryId },
    });
    if (!cat) throw new Error('Invalid membership category');
  }

  const member = await prisma.member.update({
    where: { id },
    data: {
      ...(input.fullName !== undefined && { fullName: input.fullName }),
      ...(input.nameInBangla !== undefined && { nameInBangla: input.nameInBangla }),
      ...(input.fatherName !== undefined && { fatherName: input.fatherName }),
      ...(input.motherName !== undefined && { motherName: input.motherName }),
      ...(input.dateOfBirth !== undefined && {
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
      }),
      ...(input.gender !== undefined && { gender: input.gender }),
      ...(input.nationality !== undefined && { nationality: input.nationality }),
      ...(input.nidPassport !== undefined && { nidPassport: input.nidPassport }),
      ...(input.email !== undefined && { email: input.email || null }),
      ...(input.mobile !== undefined && { mobile: input.mobile }),
      ...(input.alternatePhone !== undefined && { alternatePhone: input.alternatePhone }),
      ...(input.presentAddress !== undefined && { presentAddress: input.presentAddress }),
      ...(input.permanentAddress !== undefined && { permanentAddress: input.permanentAddress }),
      ...(input.district !== undefined && { district: input.district }),
      ...(input.division !== undefined && { division: input.division }),
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
      ...(input.currentDesignation !== undefined && {
        currentDesignation: input.currentDesignation,
      }),
      ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.joiningDate !== undefined && {
        joiningDate: input.joiningDate ? new Date(input.joiningDate) : null,
      }),
      ...(input.expiryDate !== undefined && {
        expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
      }),
      ...(input.profilePhotoUrl !== undefined && {
        profilePhotoUrl: input.profilePhotoUrl || null,
      }),
      ...(input.signatureUrl !== undefined && { signatureUrl: input.signatureUrl || null }),
    },
    include: { category: true },
  });

  await writeAuditLog({
    user: actor,
    action: 'UPDATE',
    module: 'members',
    recordId: id,
    oldData: { status: existing.status, fullName: existing.fullName },
    newData: { status: member.status, fullName: member.fullName },
  });

  return member;
}

export async function deleteMember(id: string, actor?: AuthUser) {
  const existing = await prisma.member.findUnique({ where: { id } });
  if (!existing) throw new Error('NOT_FOUND');

  // Soft delete via status
  const member = await prisma.member.update({
    where: { id },
    data: { status: 'cancelled' },
  });

  await writeAuditLog({
    user: actor,
    action: 'DELETE',
    module: 'members',
    recordId: id,
    oldData: { status: existing.status },
    newData: { status: 'cancelled' },
  });

  return member;
}

export async function getMemberStats() {
  const [
    total,
    active,
    pending,
    expired,
    suspended,
    byCategory,
    byDiscipline,
  ] = await Promise.all([
    prisma.member.count(),
    prisma.member.count({ where: { status: 'active' } }),
    prisma.member.count({ where: { status: 'pending' } }),
    prisma.member.count({ where: { status: 'expired' } }),
    prisma.member.count({ where: { status: 'suspended' } }),
    prisma.member.groupBy({
      by: ['categoryId'],
      _count: { id: true },
    }),
    prisma.member.groupBy({
      by: ['engineeringDiscipline'],
      _count: { id: true },
      where: { engineeringDiscipline: { not: null } },
    }),
  ]);

  const categories = await prisma.membershipCategory.findMany({
    select: { id: true, name: true, code: true },
  });
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));

  return {
    total,
    active,
    pending,
    expired,
    suspended,
    byCategory: byCategory.map((r) => ({
      category: catMap[r.categoryId] || { id: r.categoryId, name: 'Unknown' },
      count: r._count.id,
    })),
    byDiscipline: byDiscipline.map((r) => ({
      discipline: r.engineeringDiscipline || 'Unknown',
      count: r._count.id,
    })),
  };
}

export async function listCategories() {
  return prisma.membershipCategory.findMany({
    where: { status: 'active' },
    orderBy: { name: 'asc' },
  });
}

/** Digital membership ID card payload for print / QR */
export async function getMemberIdCard(id: string) {
  const member = await prisma.member.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true, code: true } },
    },
  });
  if (!member) throw new Error('NOT_FOUND');

  const publicBase =
    process.env.PUBLIC_VERIFY_BASE_URL ||
    'https://fanciful-torrone-561891.netlify.app/api/public';
  const verificationUrl = `${publicBase}/verify-member/${member.membershipNumber}`;

  return {
    membershipNumber: member.membershipNumber,
    fullName: member.fullName,
    nameInBangla: member.nameInBangla,
    category: member.category,
    status: member.status,
    engineeringDiscipline: member.engineeringDiscipline,
    joiningDate: member.joiningDate,
    expiryDate: member.expiryDate,
    profilePhotoUrl: member.profilePhotoUrl,
    district: member.district,
    mobile: member.mobile,
    email: member.email,
    verificationUrl,
    qrPayload: verificationUrl,
    issuedBy: 'Institution of Engineers, Bangladesh (IEB)',
    cardType: 'Digital Membership ID Card',
  };
}
