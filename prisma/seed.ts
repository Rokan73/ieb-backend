/**
 * IEB Backend Demo Seed Data
 * DEMO ADMIN: admin@ieb-demo.local / ChangeMe123!
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { addYears, subMonths, subDays, addDays } from 'date-fns';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding IEB Backend Demo Database...\n');

  // Roles
  const rolesData = [
    { name: 'Super Admin', code: 'super_admin', description: 'Full system access', isSystem: true },
    { name: 'IEB Administrator', code: 'ieb_admin', description: 'Manage all operational modules' },
    { name: 'Membership Officer', code: 'membership_officer', description: 'Members, applications, renewals' },
    { name: 'Committee Officer', code: 'committee_officer', description: 'Committees and members' },
    { name: 'Event Officer', code: 'event_officer', description: 'Events and registrations' },
    { name: 'Registration Officer', code: 'registration_officer', description: 'Professional registration' },
    { name: 'Member', code: 'member', description: 'Registered IEB member' },
  ];
  const roles: Record<string, string> = {};
  for (const r of rolesData) {
    const role = await prisma.role.upsert({
      where: { code: r.code },
      update: {},
      create: r,
    });
    roles[r.code] = role.id;
  }
  console.log('Roles created');

  // Permissions
  const permModules = [
    'members', 'membership_applications', 'membership_renewals',
    'committees', 'events', 'professional_registrations', 'dashboard', 'users',
  ];
  const actions = ['create', 'read', 'update', 'delete', 'approve', 'reject'];
  for (const mod of permModules) {
    for (const act of actions) {
      const code = `${mod}:${act}`;
      await prisma.permission.upsert({
        where: { code },
        update: {},
        create: { name: `${act} ${mod}`, code, module: mod },
      });
    }
  }
  await prisma.permission.upsert({
    where: { code: '*' },
    update: {},
    create: { name: 'All permissions', code: '*', module: 'system' },
  });
  const allPerms = await prisma.permission.findMany();
  for (const p of allPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: roles.super_admin, permissionId: p.id } },
      update: {},
      create: { roleId: roles.super_admin, permissionId: p.id },
    });
  }
  console.log('Permissions created');

  // Membership Categories
  const categoriesData = [
    { name: 'Fellow', code: 'FELLOW', description: 'Senior distinguished members', eligibility: 'Min 15 years experience', fee: 5000 },
    { name: 'Member', code: 'MEMBER', description: 'Full professional members', eligibility: 'Bachelor + 5 years', fee: 3000 },
    { name: 'Associate Member', code: 'ASSOC', description: 'Early career', eligibility: 'Bachelor + 2 years', fee: 2000 },
    { name: 'Student Member', code: 'STUDENT', description: 'Engineering students', eligibility: 'Enrolled student', fee: 500 },
    { name: 'Affiliate', code: 'AFFILIATE', description: 'Related professionals', eligibility: 'Related qualification', fee: 1500 },
    { name: 'Honorary Member', code: 'HONORARY', description: 'Honorary recognition', eligibility: 'By invitation', fee: 0 },
  ];
  const categories: Record<string, string> = {};
  for (const c of categoriesData) {
    const cat = await prisma.membershipCategory.upsert({
      where: { code: c.code },
      update: {},
      create: { ...c, status: 'active' },
    });
    categories[c.code] = cat.id;
  }
  console.log('Categories created');

  // Committee Types & Positions
  const committeeTypesData = [
    { name: 'Executive Committee', code: 'EXEC' },
    { name: 'Standing Committee', code: 'STANDING' },
    { name: 'Technical Committee', code: 'TECH' },
    { name: 'Centre Committee', code: 'CENTRE' },
    { name: 'Special Committee', code: 'SPECIAL' },
  ];
  const committeeTypes: Record<string, string> = {};
  for (const t of committeeTypesData) {
    const ct = await prisma.committeeType.upsert({
      where: { code: t.code },
      update: {},
      create: { ...t, status: 'active' },
    });
    committeeTypes[t.code] = ct.id;
  }

  const positionsData = [
    { name: 'Chairman', code: 'CHAIR', sortOrder: 1 },
    { name: 'Vice Chairman', code: 'VICE_CHAIR', sortOrder: 2 },
    { name: 'Secretary', code: 'SEC', sortOrder: 3 },
    { name: 'Joint Secretary', code: 'JT_SEC', sortOrder: 4 },
    { name: 'Treasurer', code: 'TREAS', sortOrder: 5 },
    { name: 'Member', code: 'MEMBER', sortOrder: 10 },
  ];
  const positions: Record<string, string> = {};
  for (const p of positionsData) {
    const pos = await prisma.committeePosition.upsert({
      where: { code: p.code },
      update: {},
      create: p,
    });
    positions[p.code] = pos.id;
  }
  console.log('Committee types & positions created');

  // Event Types
  const eventTypesData = [
    { name: 'Conference', code: 'CONF' },
    { name: 'Seminar', code: 'SEM' },
    { name: 'Workshop', code: 'WS' },
    { name: 'Training', code: 'TRAIN' },
    { name: 'Webinar', code: 'WEB' },
    { name: 'Technical Session', code: 'TECH_SESS' },
    { name: 'AGM', code: 'AGM' },
    { name: 'Professional Event', code: 'PROF' },
  ];
  const eventTypes: Record<string, string> = {};
  for (const t of eventTypesData) {
    const et = await prisma.eventType.upsert({
      where: { code: t.code },
      update: {},
      create: { ...t, status: 'active' },
    });
    eventTypes[t.code] = et.id;
  }
  console.log('Event types created');

  // Registration Types
  const regTypesData = [
    { name: 'Professional Engineer', code: 'PE' },
    { name: 'Engineering Registration', code: 'ER' },
    { name: 'Specialist Registration', code: 'SR' },
  ];
  const regTypes: Record<string, string> = {};
  for (const t of regTypesData) {
    const rt = await prisma.registrationType.upsert({
      where: { code: t.code },
      update: {},
      create: { ...t, status: 'active' },
    });
    regTypes[t.code] = rt.id;
  }
  console.log('Registration types created');

  // Demo Admin
  const passwordHash = await bcrypt.hash('ChangeMe123!', 12);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@ieb-demo.local' },
    update: {},
    create: {
      email: 'admin@ieb-demo.local',
      passwordHash,
      fullName: 'IEB Demo Administrator',
      mobile: '01700000000',
      isActive: true,
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: roles.super_admin } },
    update: {},
    create: { userId: adminUser.id, roleId: roles.super_admin },
  });
  console.log('Demo admin: admin@ieb-demo.local / ChangeMe123!');

  // Officers
  const officers = [
    { email: 'membership@ieb-demo.local', name: 'Membership Officer', role: 'membership_officer' },
    { email: 'committee@ieb-demo.local', name: 'Committee Officer', role: 'committee_officer' },
    { email: 'events@ieb-demo.local', name: 'Event Officer', role: 'event_officer' },
    { email: 'registration@ieb-demo.local', name: 'Registration Officer', role: 'registration_officer' },
  ];
  for (const o of officers) {
    const u = await prisma.user.upsert({
      where: { email: o.email },
      update: {},
      create: { email: o.email, passwordHash, fullName: o.name, isActive: true },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: u.id, roleId: roles[o.role] } },
      update: {},
      create: { userId: u.id, roleId: roles[o.role] },
    });
  }
  console.log('Officer users created');

  // Sample Members (30)
  const disciplines = [
    'Civil Engineering', 'Electrical Engineering', 'Mechanical Engineering',
    'Computer Science & Engineering', 'Chemical Engineering', 'Architecture',
    'Industrial & Production Engineering',
  ];
  const districts = ['Dhaka', 'Chittagong', 'Rajshahi', 'Khulna', 'Sylhet', 'Barisal', 'Rangpur'];
  const universities = ['BUET', 'CUET', 'KUET', 'RUET', 'DUET', 'IUT', 'AUST', 'NSU'];
  const firstNames = ['Rahman', 'Ahmed', 'Hossain', 'Islam', 'Khan', 'Chowdhury', 'Ali', 'Hasan', 'Uddin', 'Miah', 'Sarkar', 'Das', 'Roy', 'Karim', 'Mahmud'];
  const lastNames = ['Kabir', 'Faruk', 'Nazmul', 'Sajid', 'Tariq', 'Imran', 'Rafiq', 'Salim', 'Jamal', 'Nasir', 'Shahid', 'Bashir', 'Kamal', 'Firoz', 'Anwar'];

  const memberIds: string[] = [];
  for (let i = 1; i <= 30; i++) {
    const fn = firstNames[i % firstNames.length];
    const ln = lastNames[i % lastNames.length];
    const fullName = `${fn} ${ln}`;
    const membershipNumber = `IEB-2024-${String(100000 + i).slice(1)}`;
    const catCode = i <= 3 ? 'FELLOW' : i <= 18 ? 'MEMBER' : i <= 25 ? 'ASSOC' : 'STUDENT';
    const status = i <= 25 ? 'active' : i <= 27 ? 'expired' : i === 28 ? 'suspended' : 'pending';

    const member = await prisma.member.upsert({
      where: { membershipNumber },
      update: {},
      create: {
        membershipNumber,
        fullName,
        fatherName: `Father of ${fullName}`,
        email: `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@demo.ieb.local`,
        mobile: `017${String(10000000 + i).slice(1)}`,
        dateOfBirth: new Date(1980 + (i % 20), i % 12, (i % 28) + 1),
        gender: i % 5 === 0 ? 'female' : 'male',
        nationality: 'Bangladeshi',
        nidPassport: `NID${1000000000 + i}`,
        presentAddress: `House ${i}, Road ${i % 20}, ${districts[i % districts.length]}`,
        district: districts[i % districts.length],
        division: districts[i % districts.length] === 'Dhaka' ? 'Dhaka' : 'Other',
        engineeringDiscipline: disciplines[i % disciplines.length],
        academicQualification: 'B.Sc. Engineering',
        university: universities[i % universities.length],
        graduationYear: 2005 + (i % 15),
        professionalExperience: `${5 + (i % 15)} years professional experience`,
        currentOrganization: `Demo Engineering Ltd ${i % 5}`,
        currentDesignation: i <= 5 ? 'Chief Engineer' : i <= 15 ? 'Senior Engineer' : 'Engineer',
        categoryId: categories[catCode],
        status,
        joiningDate: subMonths(new Date(), 12 + (i % 60)),
        expiryDate: status === 'expired' ? subMonths(new Date(), 2) : addYears(new Date(), 1),
      },
    });
    memberIds.push(member.id);
  }
  console.log('30 sample members created');

  // Applications
  const appStatuses = ['draft', 'submitted', 'under_review', 'query', 'verified', 'recommended', 'approved', 'rejected'];
  for (let i = 1; i <= 12; i++) {
    await prisma.membershipApplication.create({
      data: {
        applicationNumber: `APP-2024-${String(200000 + i).slice(1)}`,
        applicantName: `Applicant ${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`,
        email: `applicant${i}@demo.ieb.local`,
        mobile: `018${String(20000000 + i).slice(1)}`,
        engineeringDiscipline: disciplines[i % disciplines.length],
        academicQualification: 'B.Sc. Engineering',
        university: universities[i % universities.length],
        graduationYear: 2018 + (i % 5),
        requestedCategoryId: categories[i % 2 === 0 ? 'MEMBER' : 'ASSOC'],
        declarationAccepted: true,
        status: appStatuses[i % appStatuses.length],
        applicationDate: subDays(new Date(), i * 3),
      },
    });
  }
  console.log('12 applications created');

  // Renewals
  for (let i = 0; i < 8; i++) {
    const member = await prisma.member.findUnique({ where: { id: memberIds[i] } });
    if (!member) continue;
    await prisma.membershipRenewal.create({
      data: {
        renewalNumber: `REN-2024-${String(300000 + i).slice(1)}`,
        memberId: member.id,
        categoryId: member.categoryId,
        renewalPeriod: i % 3 === 0 ? '2_year' : '1_year',
        feeAmount: 3000,
        paymentStatus: i < 4 ? 'paid' : 'pending',
        status: i < 3 ? 'approved' : i < 5 ? 'pending' : 'under_review',
        contactEmail: member.email,
        contactMobile: member.mobile,
        requestedAt: subDays(new Date(), i * 5),
        newExpiryDate: i < 3 ? addYears(new Date(), 1) : null,
      },
    });
  }
  console.log('8 renewals created');

  // Committees
  const committeesData = [
    { name: 'Central Executive Committee 2024-26', code: 'CEC-2024', type: 'EXEC', centre: 'Dhaka' },
    { name: 'Civil Engineering Division Committee', code: 'CEDC-2024', type: 'TECH', centre: 'Dhaka' },
    { name: 'Electrical Engineering Division Committee', code: 'EEDC-2024', type: 'TECH', centre: 'Dhaka' },
    { name: 'Dhaka Centre Committee', code: 'DCC-2024', type: 'CENTRE', centre: 'Dhaka' },
    { name: 'Chittagong Centre Committee', code: 'CCC-2024', type: 'CENTRE', centre: 'Chittagong' },
    { name: 'Professional Development Standing Committee', code: 'PDSC-2024', type: 'STANDING', centre: 'Dhaka' },
    { name: 'Young Engineers Special Committee', code: 'YESC-2024', type: 'SPECIAL', centre: 'Dhaka' },
  ];
  for (let i = 0; i < committeesData.length; i++) {
    const c = committeesData[i];
    const committee = await prisma.committee.create({
      data: {
        name: c.name,
        code: c.code,
        typeId: committeeTypes[c.type],
        centre: c.centre,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2026-12-31'),
        status: 'active',
      },
    });
    for (let j = 0; j < 4; j++) {
      const posCode = j === 0 ? 'CHAIR' : j === 1 ? 'SEC' : j === 2 ? 'TREAS' : 'MEMBER';
      await prisma.committeeMember.create({
        data: {
          committeeId: committee.id,
          memberId: memberIds[(i * 4 + j) % memberIds.length],
          positionId: positions[posCode],
          appointmentDate: new Date('2024-01-15'),
          startDate: new Date('2024-01-15'),
          endDate: new Date('2026-12-31'),
          status: 'active',
        },
      });
    }
  }
  console.log('7 committees created');

  // Events
  const eventsData = [
    { name: 'IEB Annual Convention 2025', type: 'CONF', status: 'registration_open', daysFromNow: 45 },
    { name: 'Seminar on Sustainable Infrastructure', type: 'SEM', status: 'published', daysFromNow: 20 },
    { name: 'Workshop on BIM for Civil Engineers', type: 'WS', status: 'registration_open', daysFromNow: 15 },
    { name: 'Professional Development Training', type: 'TRAIN', status: 'ongoing', daysFromNow: -2 },
    { name: 'Webinar: AI in Engineering', type: 'WEB', status: 'completed', daysFromNow: -30 },
    { name: 'Technical Session - Power Systems', type: 'TECH_SESS', status: 'registration_closed', daysFromNow: 5 },
    { name: 'IEB AGM 2025', type: 'AGM', status: 'draft', daysFromNow: 90 },
    { name: 'Young Engineers Networking Event', type: 'PROF', status: 'published', daysFromNow: 10 },
    { name: 'Disaster Resilience Engineering Seminar', type: 'SEM', status: 'completed', daysFromNow: -60 },
    { name: 'Software Engineering Best Practices Workshop', type: 'WS', status: 'registration_open', daysFromNow: 25 },
  ];
  for (let i = 0; i < eventsData.length; i++) {
    const e = eventsData[i];
    const start = addDays(new Date(), e.daysFromNow);
    const event = await prisma.event.create({
      data: {
        eventCode: `EVT-2025-${String(1000 + i)}`,
        name: e.name,
        typeId: eventTypes[e.type],
        description: `Demo event: ${e.name}`,
        organizer: 'IEB Headquarters',
        centre: 'Dhaka',
        venue: e.type === 'WEB' ? 'Online (Zoom)' : 'IEB Convention Hall, Ramna, Dhaka',
        isOnline: e.type === 'WEB',
        startDate: start,
        endDate: addDays(start, e.type === 'CONF' ? 2 : 0),
        startTime: '09:00',
        endTime: '17:00',
        registrationStart: subDays(start, 30),
        registrationEnd: subDays(start, 2),
        capacity: 200,
        registrationFee: e.type === 'CONF' ? 2000 : e.type === 'WS' ? 1000 : 500,
        status: e.status,
      },
    });
    if (['registration_open', 'ongoing', 'completed', 'registration_closed'].includes(e.status)) {
      for (let j = 0; j < 5; j++) {
        const m = await prisma.member.findUnique({ where: { id: memberIds[j] } });
        if (!m) continue;
        await prisma.eventRegistration.create({
          data: {
            registrationNumber: `EREG-2025-${i}${j}${String(1000 + j)}`,
            eventId: event.id,
            memberId: m.id,
            name: m.fullName,
            email: m.email || `reg${i}${j}@demo.local`,
            mobile: m.mobile,
            paymentStatus: 'paid',
            attendanceStatus: e.status === 'completed' ? (j < 3 ? 'attended' : 'absent') : 'registered',
          },
        });
      }
    }
  }
  console.log('10 events created');

  // Professional Registrations
  for (let i = 1; i <= 8; i++) {
    const status = i <= 2 ? 'approved' : i <= 4 ? 'under_review' : i <= 6 ? 'submitted' : 'rejected';
    const reg = await prisma.professionalRegistration.create({
      data: {
        applicationNumber: `PRAPP-2024-${String(400000 + i).slice(1)}`,
        registrationNumber: status === 'approved' ? `PR-2024-${String(500000 + i).slice(1)}` : null,
        applicantName: `Prof Applicant ${firstNames[i % firstNames.length]}`,
        email: `pr.applicant${i}@demo.ieb.local`,
        mobile: `019${String(30000000 + i).slice(1)}`,
        memberId: memberIds[i % memberIds.length],
        registrationTypeId: regTypes[i % 2 === 0 ? 'PE' : 'ER'],
        engineeringDiscipline: disciplines[i % disciplines.length],
        academicQualification: 'B.Sc. Engineering',
        university: universities[i % universities.length],
        graduationYear: 2010 + i,
        professionalExperience: `${8 + i} years`,
        status,
        applicationDate: subDays(new Date(), i * 7),
        approvedAt: status === 'approved' ? subDays(new Date(), i) : null,
      },
    });
    if (status === 'approved' && reg.registrationNumber) {
      await prisma.certificate.create({
        data: {
          certificateNumber: `CERT-2024-${String(600000 + i).slice(1)}`,
          registrationId: reg.id,
          registrationNumber: reg.registrationNumber,
          applicantName: reg.applicantName,
          engineeringDiscipline: reg.engineeringDiscipline,
          registrationType: i % 2 === 0 ? 'Professional Engineer' : 'Engineering Registration',
          issueDate: subDays(new Date(), i),
          expiryDate: addYears(new Date(), 5),
          qrVerificationCode: `QR-DEMO-${i}-${Date.now()}`,
          verificationUrl: `https://ieb-demo.netlify.app/api/public/verify-registration/${reg.registrationNumber}`,
          status: 'active',
        },
      });
    }
  }
  console.log('8 professional registrations created');

  console.log('\nSeed completed successfully!');

  // Ticket categories
  const ticketCats = [
    { name: 'Membership Issue', code: 'MEM_ISSUE', type: 'complaint', slaHours: 48 },
    { name: 'Certificate Request', code: 'CERT_REQ', type: 'service_request', slaHours: 72 },
    { name: 'Event Related', code: 'EVENT', type: 'complaint', slaHours: 24 },
    { name: 'Payment Issue', code: 'PAYMENT', type: 'complaint', slaHours: 48 },
    { name: 'General Inquiry', code: 'GENERAL', type: 'service_request', slaHours: 96 },
    { name: 'Profile Update', code: 'PROFILE', type: 'service_request', slaHours: 48 },
  ];
  const ticketCategoryIds: string[] = [];
  for (const c of ticketCats) {
    const cat = await prisma.ticketCategory.upsert({
      where: { code: c.code },
      update: {},
      create: { ...c, status: 'active' },
    });
    ticketCategoryIds.push(cat.id);
  }
  console.log('Ticket categories created');

  // Sample tickets
  const sampleTickets = [
    { subject: 'Unable to renew membership online', type: 'complaint', priority: 'high', status: 'open' },
    { subject: 'Request for membership certificate copy', type: 'service_request', priority: 'medium', status: 'assigned' },
    { subject: 'Event registration fee not reflected', type: 'complaint', priority: 'urgent', status: 'in_progress' },
    { subject: 'Update mobile number on profile', type: 'service_request', priority: 'low', status: 'resolved' },
    { subject: 'Wrong category shown on ID card', type: 'complaint', priority: 'medium', status: 'pending' },
  ];
  for (let i = 0; i < sampleTickets.length; i++) {
    const s = sampleTickets[i];
    const tn = `TKT-2026-${10001 + i}`;
    const exists = await prisma.ticket.findUnique({ where: { ticketNumber: tn } });
    if (exists) continue;
    const sla = new Date();
    sla.setHours(sla.getHours() + 48);
    await prisma.ticket.create({
      data: {
        ticketNumber: tn,
        type: s.type,
        categoryId: ticketCategoryIds[i % ticketCategoryIds.length],
        subject: s.subject,
        description: `Demo ticket: ${s.subject}. Please investigate and resolve.`,
        priority: s.priority,
        status: s.status,
        requesterName: 'Demo Requester',
        requesterEmail: `requester${i}@demo.ieb.local`,
        requesterMobile: '01700000000',
        slaDueAt: sla,
        history: {
          create: {
            action: 'CREATED',
            toStatus: s.status,
            performedBy: 'System',
            notes: 'Seeded demo ticket',
          },
        },
      },
    });
  }
  console.log('Sample tickets created');

  console.log('DEMO CREDENTIALS: admin@ieb-demo.local / ChangeMe123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
