import { z } from 'zod';

export const createApplicationSchema = z.object({
  applicantName: z.string().min(2),
  email: z.string().email(),
  mobile: z.string().min(10),
  dateOfBirth: z.string().optional(),
  nidPassport: z.string().optional(),
  address: z.string().optional(),
  engineeringDiscipline: z.string().optional(),
  academicQualification: z.string().optional(),
  university: z.string().optional(),
  graduationYear: z.number().int().optional(),
  professionalExperience: z.string().optional(),
  currentOrganization: z.string().optional(),
  designation: z.string().optional(),
  requestedCategoryId: z.string().uuid(),
  declarationAccepted: z.boolean().refine((v) => v === true, {
    message: 'Declaration must be accepted',
  }),
});

export const updateApplicationSchema = createApplicationSchema.partial().omit({
  declarationAccepted: true,
});

export const querySchema = z.object({
  queryText: z.string().min(5, 'Query text is required'),
});

export const respondQuerySchema = z.object({
  responseText: z.string().min(2),
});

export const rejectSchema = z.object({
  reason: z.string().min(5, 'Rejection reason is required'),
});

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;
