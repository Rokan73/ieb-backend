import { z } from 'zod';

export const createMemberSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  nameInBangla: z.string().optional(),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  nationality: z.string().optional(),
  nidPassport: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  mobile: z.string().optional(),
  alternatePhone: z.string().optional(),
  presentAddress: z.string().optional(),
  permanentAddress: z.string().optional(),
  district: z.string().optional(),
  division: z.string().optional(),
  engineeringDiscipline: z.string().optional(),
  academicQualification: z.string().optional(),
  university: z.string().optional(),
  graduationYear: z.number().int().min(1950).max(2030).optional(),
  professionalExperience: z.string().optional(),
  currentOrganization: z.string().optional(),
  currentDesignation: z.string().optional(),
  categoryId: z.string().uuid('Invalid category'),
  status: z
    .enum(['active', 'pending', 'suspended', 'expired', 'cancelled', 'deceased'])
    .optional(),
  joiningDate: z.string().optional(),
  expiryDate: z.string().optional(),
  profilePhotoUrl: z.string().url().optional().or(z.literal('')),
  signatureUrl: z.string().url().optional().or(z.literal('')),
});

export const updateMemberSchema = createMemberSchema.partial();

export const memberListQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  status: z.string().optional(),
  categoryId: z.string().optional(),
  discipline: z.string().optional(),
  district: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

export type CreateMemberInput = z.infer<typeof createMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
