import { getMemberStats } from '../members/members.service';
import { getRenewalStats } from '../membership-renewals/renewals.service';
import { getCommitteeStats } from '../committees/committees.service';
import { getEventStats } from '../events/events.service';
import { getRegistrationStats } from '../professional-registration/registration.service';
import prisma from '../../database/prisma';

export async function getDashboard() {
  const [
    members,
    renewals,
    committees,
    events,
    professionalRegistration,
    applicationStats,
  ] = await Promise.all([
    getMemberStats(),
    getRenewalStats(),
    getCommitteeStats(),
    getEventStats(),
    getRegistrationStats(),
    prisma.membershipApplication.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
  ]);

  const appMap = Object.fromEntries(
    applicationStats.map((r) => [r.status, r._count.id])
  );

  return {
    members: {
      total: members.total,
      active: members.active,
      pending: members.pending,
      expired: members.expired,
      suspended: members.suspended,
      byCategory: members.byCategory,
      byDiscipline: members.byDiscipline,
    },
    applications: {
      pending: (appMap['submitted'] || 0) + (appMap['payment_pending'] || 0),
      underReview:
        (appMap['under_review'] || 0) +
        (appMap['query'] || 0) +
        (appMap['verified'] || 0) +
        (appMap['recommended'] || 0),
      approved: appMap['approved'] || 0,
      rejected: appMap['rejected'] || 0,
      draft: appMap['draft'] || 0,
    },
    renewals: {
      due: renewals.due,
      pending: renewals.pending,
      completed: renewals.approved,
      rejected: renewals.rejected,
      revenue: renewals.revenue,
    },
    committees: {
      total: committees.total,
      active: committees.active,
      expired: committees.expired,
      totalMembers: committees.totalMembers,
      byType: committees.byType,
    },
    events: {
      total: events.total,
      upcoming: events.upcoming,
      ongoing: events.ongoing,
      completed: events.completed,
      cancelled: events.cancelled,
      totalRegistrations: events.totalRegistrations,
    },
    professionalRegistration: {
      pending: professionalRegistration.pending,
      underReview: professionalRegistration.underReview,
      approved: professionalRegistration.approved,
      rejected: professionalRegistration.rejected,
    },
  };
}
