import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { jsonResponse, optionsResponse, success, error } from '../../src/utils/response';
import { handleError } from '../../src/middleware/error.middleware';
import {
  getAuthUser,
  requireAuth,
  requirePermission,
  requireRoles,
  hasAnyRole,
} from '../../src/middleware/auth.middleware';
import { AuthUser, ROLES } from '../../src/types';

// Auth
import { loginSchema } from '../../src/auth/auth.validation';
import * as authService from '../../src/auth/auth.service';

// Members
import {
  createMemberSchema,
  updateMemberSchema,
} from '../../src/modules/members/members.validation';
import * as membersService from '../../src/modules/members/members.service';

// Applications
import {
  createApplicationSchema,
  updateApplicationSchema,
  querySchema,
  respondQuerySchema,
  rejectSchema,
} from '../../src/modules/membership-applications/applications.validation';
import * as applicationsService from '../../src/modules/membership-applications/applications.service';

// Renewals
import {
  createRenewalSchema,
} from '../../src/modules/membership-renewals/renewals.service';
import * as renewalsService from '../../src/modules/membership-renewals/renewals.service';

// Committees
import {
  createCommitteeSchema,
  addCommitteeMemberSchema,
} from '../../src/modules/committees/committees.service';
import * as committeesService from '../../src/modules/committees/committees.service';

// Events
import {
  createEventSchema,
  registerEventSchema,
} from '../../src/modules/events/events.service';
import * as eventsService from '../../src/modules/events/events.service';

// Professional Registration
import {
  createRegistrationSchema,
} from '../../src/modules/professional-registration/registration.service';
import * as registrationService from '../../src/modules/professional-registration/registration.service';

// Dashboard
import { getDashboard } from '../../src/modules/dashboard/dashboard.service';

function parseBody<T>(event: HandlerEvent): T {
  if (!event.body) return {} as T;
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : event.body;
    return JSON.parse(raw) as T;
  } catch {
    throw new Error('Invalid JSON body');
  }
}
function getQuery(event: HandlerEvent): Record<string, string> {
  return (event.queryStringParameters || {}) as Record<string, string>;
}

function getPathSegments(event: HandlerEvent): string[] {
  // Path comes as /api/... or /.netlify/functions/api/...
  let path = event.path || '';
  path = path.replace(/^\/\.netlify\/functions\/api/, '');
  path = path.replace(/^\/api/, '');
  path = path.replace(/^\//, '');
  return path.split('/').filter(Boolean);
}

function isAuthError(result: unknown): result is ReturnType<typeof jsonResponse> {
  return (
    typeof result === 'object' &&
    result !== null &&
    'statusCode' in result &&
    typeof (result as { statusCode: number }).statusCode === 'number'
  );
}

const handler: Handler = async (event: HandlerEvent, _context: HandlerContext) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return optionsResponse();
  }

  try {
    const method = event.httpMethod;
    const segments = getPathSegments(event);
    const query = getQuery(event);
    const resource = segments[0] || '';
    const id = segments[1];
    const action = segments[2];
    const subId = segments[3];

    // ========== PUBLIC ROUTES (no auth) ==========
    if (resource === 'public') {
      if (segments[1] === 'verify-member' && id && method === 'GET') {
        const data = await registrationService.verifyMemberPublic(id);
        return jsonResponse(success(data, 'Verification result'));
      }
      if (segments[1] === 'verify-registration' && id && method === 'GET') {
        const data = await registrationService.verifyRegistrationPublic(id);
        return jsonResponse(success(data, 'Verification result'));
      }
      // Public events list
      if (segments[1] === 'events' && method === 'GET') {
        const data = await eventsService.listEvents(query, true);
        return jsonResponse(success(data, 'Public events'));
      }
      return jsonResponse(error('Not found'), 404);
    }

    // Public membership application create
    if (resource === 'membership-applications' && method === 'POST' && !id) {
      const body = parseBody(event);
      const input = createApplicationSchema.parse(body);
      const data = await applicationsService.createApplication(input);
      return jsonResponse(success(data, 'Application created'), 201);
    }

    // Public professional registration create
    if (resource === 'professional-registrations' && method === 'POST' && !id) {
      const body = parseBody(event);
      const input = createRegistrationSchema.parse(body);
      const data = await registrationService.createRegistration(input);
      return jsonResponse(success(data, 'Registration application created'), 201);
    }

    // Public event registration
    if (resource === 'events' && id && action === 'register' && method === 'POST') {
      const body = parseBody(event);
      const input = registerEventSchema.parse(body);
      const data = await eventsService.registerForEvent(id, input);
      return jsonResponse(success(data, 'Registered successfully'), 201);
    }

    // ========== AUTH ROUTES ==========
    if (resource === 'auth') {
      if (id === 'login' && method === 'POST') {
        const body = parseBody(event);
        const input = loginSchema.parse(body);
        const data = await authService.login(input, {
          ip: event.headers['x-forwarded-for'] || event.headers['client-ip'],
          userAgent: event.headers['user-agent'],
        });
        return jsonResponse(success(data, 'Login successful'));
      }
      if (id === 'me' && method === 'GET') {
        const authResult = requireAuth(event);
        if (isAuthError(authResult)) return authResult;
        const user = authResult as AuthUser;
        const data = await authService.getMe(user.id);
        return jsonResponse(success(data, 'Profile retrieved'));
      }
      if (id === 'logout' && method === 'POST') {
        return jsonResponse(success(null, 'Logged out'));
      }
      return jsonResponse(error('Auth route not found'), 404);
    }

    // ========== ALL OTHER ROUTES REQUIRE AUTH ==========
    const authResult = requireAuth(event);
    if (isAuthError(authResult)) return authResult;
    const user = authResult as AuthUser;

    // ========== DASHBOARD ==========
    if (resource === 'dashboard' && method === 'GET') {
      const data = await getDashboard();
      return jsonResponse(success(data, 'Dashboard statistics'));
    }

    // ========== MEMBERS ==========
    if (resource === 'members') {
      if (method === 'GET' && !id) {
        const data = await membersService.listMembers(query);
        return jsonResponse(success(data, 'Members retrieved'));
      }
      if (method === 'GET' && id === 'stats') {
        const data = await membersService.getMemberStats();
        return jsonResponse(success(data, 'Member statistics'));
      }
      if (method === 'GET' && id === 'categories') {
        const data = await membersService.listCategories();
        return jsonResponse(success(data, 'Categories retrieved'));
      }
      if (method === 'GET' && id) {
        // Own profile for members
        if (
          user.roles.includes(ROLES.MEMBER) &&
          !hasAnyRole(user, [
            ROLES.SUPER_ADMIN,
            ROLES.IEB_ADMIN,
            ROLES.MEMBERSHIP_OFFICER,
          ])
        ) {
          const me = await authService.getMe(user.id);
          if (me.member?.id !== id) {
            return jsonResponse(error('Forbidden'), 403);
          }
        }
        const data = await membersService.getMemberById(id);
        return jsonResponse(success(data, 'Member retrieved'));
      }
      if (method === 'POST' && !id) {
        const perm = requirePermission(user, 'members:create');
        if (isAuthError(perm)) {
          // Fallback: allow admin roles
          if (
            !hasAnyRole(user, [
              ROLES.SUPER_ADMIN,
              ROLES.IEB_ADMIN,
              ROLES.MEMBERSHIP_OFFICER,
            ])
          ) {
            return jsonResponse(error('Forbidden'), 403);
          }
        }
        const body = parseBody(event);
        const input = createMemberSchema.parse(body);
        const data = await membersService.createMember(input, user);
        return jsonResponse(success(data, 'Member created'), 201);
      }
      if ((method === 'PUT' || method === 'PATCH') && id) {
        if (
          !hasAnyRole(user, [
            ROLES.SUPER_ADMIN,
            ROLES.IEB_ADMIN,
            ROLES.MEMBERSHIP_OFFICER,
          ])
        ) {
          return jsonResponse(error('Forbidden'), 403);
        }
        const body = parseBody(event);
        const input = updateMemberSchema.parse(body);
        const data = await membersService.updateMember(id, input, user);
        return jsonResponse(success(data, 'Member updated'));
      }
      if (method === 'DELETE' && id) {
        if (!hasAnyRole(user, [ROLES.SUPER_ADMIN, ROLES.IEB_ADMIN])) {
          return jsonResponse(error('Forbidden'), 403);
        }
        const data = await membersService.deleteMember(id, user);
        return jsonResponse(success(data, 'Member cancelled'));
      }
    }

    // ========== MEMBERSHIP APPLICATIONS ==========
    if (resource === 'membership-applications') {
      if (method === 'GET' && !id) {
        if (
          !hasAnyRole(user, [
            ROLES.SUPER_ADMIN,
            ROLES.IEB_ADMIN,
            ROLES.MEMBERSHIP_OFFICER,
          ])
        ) {
          return jsonResponse(error('Forbidden'), 403);
        }
        const data = await applicationsService.listApplications(query);
        return jsonResponse(success(data, 'Applications retrieved'));
      }
      if (method === 'GET' && id) {
        const data = await applicationsService.getApplicationById(id);
        return jsonResponse(success(data, 'Application retrieved'));
      }
      if ((method === 'PUT' || method === 'PATCH') && id) {
        const body = parseBody(event);
        const input = updateApplicationSchema.parse(body);
        const data = await applicationsService.updateApplication(id, input, user);
        return jsonResponse(success(data, 'Application updated'));
      }
      if (id && action === 'submit' && method === 'POST') {
        const data = await applicationsService.submitApplication(id, user);
        return jsonResponse(success(data, 'Application submitted'));
      }
      if (id && action === 'query' && method === 'POST') {
        if (
          !hasAnyRole(user, [
            ROLES.SUPER_ADMIN,
            ROLES.IEB_ADMIN,
            ROLES.MEMBERSHIP_OFFICER,
          ])
        ) {
          return jsonResponse(error('Forbidden'), 403);
        }
        const body = parseBody(event);
        const input = querySchema.parse(body);
        const data = await applicationsService.raiseQuery(id, input.queryText, user);
        return jsonResponse(success(data, 'Query raised'));
      }
      if (id && action === 'respond-query' && method === 'POST') {
        const body = parseBody<{ queryId: string; responseText: string }>(event);
        const input = respondQuerySchema.parse(body);
        const data = await applicationsService.respondToQuery(
          id,
          body.queryId,
          input.responseText,
          user
        );
        return jsonResponse(success(data, 'Query responded'));
      }
      if (id && action === 'approve' && method === 'POST') {
        if (
          !hasAnyRole(user, [
            ROLES.SUPER_ADMIN,
            ROLES.IEB_ADMIN,
            ROLES.MEMBERSHIP_OFFICER,
          ])
        ) {
          return jsonResponse(error('Forbidden'), 403);
        }
        const data = await applicationsService.approveApplication(id, user);
        return jsonResponse(success(data, 'Application approved and member created'));
      }
      if (id && action === 'reject' && method === 'POST') {
        if (
          !hasAnyRole(user, [
            ROLES.SUPER_ADMIN,
            ROLES.IEB_ADMIN,
            ROLES.MEMBERSHIP_OFFICER,
          ])
        ) {
          return jsonResponse(error('Forbidden'), 403);
        }
        const body = parseBody(event);
        const input = rejectSchema.parse(body);
        const data = await applicationsService.rejectApplication(id, input.reason, user);
        return jsonResponse(success(data, 'Application rejected'));
      }
    }

    // ========== MEMBERSHIP RENEWALS ==========
    if (resource === 'membership-renewals') {
      if (method === 'GET' && !id) {
        const data = await renewalsService.listRenewals(query);
        return jsonResponse(success(data, 'Renewals retrieved'));
      }
      if (method === 'GET' && id === 'stats') {
        const data = await renewalsService.getRenewalStats();
        return jsonResponse(success(data, 'Renewal statistics'));
      }
      if (method === 'GET' && id) {
        const data = await renewalsService.getRenewalById(id);
        return jsonResponse(success(data, 'Renewal retrieved'));
      }
      if (method === 'POST' && !id) {
        const body = parseBody(event);
        const input = createRenewalSchema.parse(body);
        const data = await renewalsService.createRenewal(input, user);
        return jsonResponse(success(data, 'Renewal request created'), 201);
      }
      if (id && action === 'approve' && method === 'POST') {
        if (
          !hasAnyRole(user, [
            ROLES.SUPER_ADMIN,
            ROLES.IEB_ADMIN,
            ROLES.MEMBERSHIP_OFFICER,
          ])
        ) {
          return jsonResponse(error('Forbidden'), 403);
        }
        const data = await renewalsService.approveRenewal(id, user);
        return jsonResponse(success(data, 'Renewal approved'));
      }
      if (id && action === 'reject' && method === 'POST') {
        if (
          !hasAnyRole(user, [
            ROLES.SUPER_ADMIN,
            ROLES.IEB_ADMIN,
            ROLES.MEMBERSHIP_OFFICER,
          ])
        ) {
          return jsonResponse(error('Forbidden'), 403);
        }
        const body = parseBody(event);
        const input = rejectSchema.parse(body);
        const data = await renewalsService.rejectRenewal(id, input.reason, user);
        return jsonResponse(success(data, 'Renewal rejected'));
      }
    }

    // ========== COMMITTEES ==========
    if (resource === 'committees') {
      if (method === 'GET' && id === 'types') {
        const data = await committeesService.listCommitteeTypes();
        return jsonResponse(success(data, 'Committee types'));
      }
      if (method === 'GET' && id === 'positions') {
        const data = await committeesService.listCommitteePositions();
        return jsonResponse(success(data, 'Committee positions'));
      }
      if (method === 'GET' && id === 'stats') {
        const data = await committeesService.getCommitteeStats();
        return jsonResponse(success(data, 'Committee statistics'));
      }
      if (method === 'GET' && !id) {
        const data = await committeesService.listCommittees(query);
        return jsonResponse(success(data, 'Committees retrieved'));
      }
      if (method === 'GET' && id) {
        const data = await committeesService.getCommitteeById(id);
        return jsonResponse(success(data, 'Committee retrieved'));
      }
      if (method === 'POST' && !id) {
        if (
          !hasAnyRole(user, [
            ROLES.SUPER_ADMIN,
            ROLES.IEB_ADMIN,
            ROLES.COMMITTEE_OFFICER,
          ])
        ) {
          return jsonResponse(error('Forbidden'), 403);
        }
        const body = parseBody(event);
        const input = createCommitteeSchema.parse(body);
        const data = await committeesService.createCommittee(input, user);
        return jsonResponse(success(data, 'Committee created'), 201);
      }
      if ((method === 'PUT' || method === 'PATCH') && id) {
        if (
          !hasAnyRole(user, [
            ROLES.SUPER_ADMIN,
            ROLES.IEB_ADMIN,
            ROLES.COMMITTEE_OFFICER,
          ])
        ) {
          return jsonResponse(error('Forbidden'), 403);
        }
        const body = parseBody(event);
        const input = createCommitteeSchema.partial().parse(body);
        const data = await committeesService.updateCommittee(id, input, user);
        return jsonResponse(success(data, 'Committee updated'));
      }
      if (id && action === 'members' && method === 'POST') {
        if (
          !hasAnyRole(user, [
            ROLES.SUPER_ADMIN,
            ROLES.IEB_ADMIN,
            ROLES.COMMITTEE_OFFICER,
          ])
        ) {
          return jsonResponse(error('Forbidden'), 403);
        }
        const body = parseBody(event);
        const input = addCommitteeMemberSchema.parse(body);
        const data = await committeesService.addCommitteeMember(id, input, user);
        return jsonResponse(success(data, 'Committee member added'), 201);
      }
      if (id && action === 'members' && subId && method === 'DELETE') {
        if (
          !hasAnyRole(user, [
            ROLES.SUPER_ADMIN,
            ROLES.IEB_ADMIN,
            ROLES.COMMITTEE_OFFICER,
          ])
        ) {
          return jsonResponse(error('Forbidden'), 403);
        }
        const data = await committeesService.removeCommitteeMember(id, subId, user);
        return jsonResponse(success(data, 'Committee member removed'));
      }
    }

    // ========== EVENTS ==========
    if (resource === 'events') {
      if (method === 'GET' && id === 'types') {
        const data = await eventsService.listEventTypes();
        return jsonResponse(success(data, 'Event types'));
      }
      if (method === 'GET' && id === 'stats') {
        const data = await eventsService.getEventStats();
        return jsonResponse(success(data, 'Event statistics'));
      }
      if (method === 'GET' && !id) {
        const data = await eventsService.listEvents(query);
        return jsonResponse(success(data, 'Events retrieved'));
      }
      if (method === 'GET' && id && !action) {
        const data = await eventsService.getEventById(id);
        return jsonResponse(success(data, 'Event retrieved'));
      }
      if (method === 'POST' && !id) {
        if (
          !hasAnyRole(user, [
            ROLES.SUPER_ADMIN,
            ROLES.IEB_ADMIN,
            ROLES.EVENT_OFFICER,
          ])
        ) {
          return jsonResponse(error('Forbidden'), 403);
        }
        const body = parseBody(event);
        const input = createEventSchema.parse(body);
        const data = await eventsService.createEvent(input, user);
        return jsonResponse(success(data, 'Event created'), 201);
      }
      if ((method === 'PUT' || method === 'PATCH') && id) {
        if (
          !hasAnyRole(user, [
            ROLES.SUPER_ADMIN,
            ROLES.IEB_ADMIN,
            ROLES.EVENT_OFFICER,
          ])
        ) {
          return jsonResponse(error('Forbidden'), 403);
        }
        const body = parseBody(event);
        const input = createEventSchema.partial().parse(body);
        const data = await eventsService.updateEvent(id, input, user);
        return jsonResponse(success(data, 'Event updated'));
      }
      if (id && action === 'participants' && method === 'GET') {
        if (
          !hasAnyRole(user, [
            ROLES.SUPER_ADMIN,
            ROLES.IEB_ADMIN,
            ROLES.EVENT_OFFICER,
          ])
        ) {
          return jsonResponse(error('Forbidden'), 403);
        }
        const data = await eventsService.listParticipants(id, query);
        return jsonResponse(success(data, 'Participants retrieved'));
      }
      if (id && action === 'participants' && subId && method === 'PATCH') {
        if (
          !hasAnyRole(user, [
            ROLES.SUPER_ADMIN,
            ROLES.IEB_ADMIN,
            ROLES.EVENT_OFFICER,
          ])
        ) {
          return jsonResponse(error('Forbidden'), 403);
        }
        const body = parseBody<{ attendanceStatus: 'attended' | 'absent' }>(event);
        const data = await eventsService.markAttendance(
          id,
          subId,
          body.attendanceStatus,
          user
        );
        return jsonResponse(success(data, 'Attendance updated'));
      }
    }

    // ========== PROFESSIONAL REGISTRATIONS ==========
    if (resource === 'professional-registrations') {
      if (method === 'GET' && id === 'types') {
        const data = await registrationService.listRegistrationTypes();
        return jsonResponse(success(data, 'Registration types'));
      }
      if (method === 'GET' && id === 'stats') {
        const data = await registrationService.getRegistrationStats();
        return jsonResponse(success(data, 'Registration statistics'));
      }
      if (method === 'GET' && !id) {
        if (
          !hasAnyRole(user, [
            ROLES.SUPER_ADMIN,
            ROLES.IEB_ADMIN,
            ROLES.REGISTRATION_OFFICER,
          ])
        ) {
          return jsonResponse(error('Forbidden'), 403);
        }
        const data = await registrationService.listRegistrations(query);
        return jsonResponse(success(data, 'Registrations retrieved'));
      }
      if (method === 'GET' && id) {
        const data = await registrationService.getRegistrationById(id);
        return jsonResponse(success(data, 'Registration retrieved'));
      }
      if (id && action === 'submit' && method === 'POST') {
        const data = await registrationService.submitRegistration(id, user);
        return jsonResponse(success(data, 'Registration submitted'));
      }
      if (id && action === 'approve' && method === 'POST') {
        if (
          !hasAnyRole(user, [
            ROLES.SUPER_ADMIN,
            ROLES.IEB_ADMIN,
            ROLES.REGISTRATION_OFFICER,
          ])
        ) {
          return jsonResponse(error('Forbidden'), 403);
        }
        const data = await registrationService.approveRegistration(id, user);
        return jsonResponse(success(data, 'Registration approved and certificate generated'));
      }
      if (id && action === 'reject' && method === 'POST') {
        if (
          !hasAnyRole(user, [
            ROLES.SUPER_ADMIN,
            ROLES.IEB_ADMIN,
            ROLES.REGISTRATION_OFFICER,
          ])
        ) {
          return jsonResponse(error('Forbidden'), 403);
        }
        const body = parseBody(event);
        const input = rejectSchema.parse(body);
        const data = await registrationService.rejectRegistration(id, input.reason, user);
        return jsonResponse(success(data, 'Registration rejected'));
      }
    }

    return jsonResponse(error('Route not found'), 404);
  } catch (err) {
    return handleError(err);
  }
};

export { handler };
