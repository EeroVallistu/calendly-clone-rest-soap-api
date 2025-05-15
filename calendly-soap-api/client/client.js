#!/usr/bin/env node
// Minimal CLI to invoke each SOAP operation at least once
const soap = require('soap');

const WSDL_URL = 'http://localhost:3001/wsdl/calendly-soap-service.wsdl';

async function main() {
  const client = await soap.createClientAsync(WSDL_URL);

  // 1. CreateUser
  const userResp = await client.CreateUserAsync({
    user: {
      name: 'CLI User',
      email: `cli.user.${Date.now()}@example.com`,
      password: 'password123',
      timezone: 'Europe/Tallinn'
    }
  });
  const userId = userResp[0].user.id;
  console.log('CreateUser:', userResp[0].user);

  // 2. CreateSession
  const sessionResp = await client.CreateSessionAsync({
    email: userResp[0].user.email,
    password: 'password123'
  });
  const token = sessionResp[0].token;
  console.log('CreateSession:', sessionResp[0]);

  // 3. GetUser
  const getUserResp = await client.GetUserAsync({ token, userId });
  console.log('GetUser:', getUserResp[0].user);

  // 4. UpdateUser
  const updateUserResp = await client.UpdateUserAsync({ token, userId, name: 'CLI User Updated' });
  console.log('UpdateUser:', updateUserResp[0].user);

  // 5. GetUsers
  const getUsersResp = await client.GetUsersAsync({ token, page: 1, pageSize: 5 });
  console.log('GetUsers:', getUsersResp[0].users);

  // 6. CreateEvent
  const eventResp = await client.CreateEventAsync({
    token,
    event: { name: 'CLI Event', duration: 30, description: 'desc', color: '#123456' }
  });
  const eventId = eventResp[0].event.id;
  console.log('CreateEvent:', eventResp[0].event);

  // 7. GetEvent
  const getEventResp = await client.GetEventAsync({ token, eventId });
  console.log('GetEvent:', getEventResp[0].event);

  // 8. UpdateEvent
  const updateEventResp = await client.UpdateEventAsync({ token, eventId, description: 'Updated desc' });
  console.log('UpdateEvent:', updateEventResp[0].event);

  // 9. GetEvents
  const getEventsResp = await client.GetEventsAsync({ token });
  console.log('GetEvents:', getEventsResp[0].events);

  // 10. CreateSchedule
  const scheduleResp = await client.CreateScheduleAsync({
    token,
    schedule: { userId, availability: { timeSlot: [{ day: 'monday', startTime: '09:00', endTime: '17:00' }] } }
  });
  console.log('CreateSchedule:', scheduleResp[0].schedule);

  // 11. GetSchedule
  const getScheduleResp = await client.GetScheduleAsync({ userId });
  console.log('GetSchedule:', getScheduleResp[0].schedule);

  // 12. UpdateSchedule
  const updateScheduleResp = await client.UpdateScheduleAsync({
    token,
    userId,
    availability: { timeSlot: [{ day: 'tuesday', startTime: '10:00', endTime: '15:00' }] }
  });
  console.log('UpdateSchedule:', updateScheduleResp[0].schedule);

  // 13. GetSchedules
  const getSchedulesResp = await client.GetSchedulesAsync({ token });
  console.log('GetSchedules:', getSchedulesResp[0].schedules);

  // 14. CreateAppointment
  const appointmentResp = await client.CreateAppointmentAsync({
    token,
    appointment: {
      eventId,
      inviteeEmail: `invitee.${Date.now()}@example.com`,
      startTime: '2025-06-15T14:00:00',
      endTime: '2025-06-15T15:00:00'
    }
  });
  const appointmentId = appointmentResp[0].appointment.id;
  console.log('CreateAppointment:', appointmentResp[0].appointment);

  // 15. GetAppointment
  const getAppointmentResp = await client.GetAppointmentAsync({ token, appointmentId });
  console.log('GetAppointment:', getAppointmentResp[0].appointment);

  // 16. UpdateAppointment
  const updateAppointmentResp = await client.UpdateAppointmentAsync({ token, appointmentId, status: 'canceled' });
  console.log('UpdateAppointment:', updateAppointmentResp[0].appointment);

  // 17. GetAppointments
  const getAppointmentsResp = await client.GetAppointmentsAsync({ token });
  console.log('GetAppointments:', getAppointmentsResp[0].appointments);

  // 18. DeleteAppointment
  const deleteAppointmentResp = await client.DeleteAppointmentAsync({ token, appointmentId });
  console.log('DeleteAppointment:', deleteAppointmentResp[0]);

  // 19. DeleteSchedule
  const deleteScheduleResp = await client.DeleteScheduleAsync({ token, userId });
  console.log('DeleteSchedule:', deleteScheduleResp[0]);

  // 20. DeleteEvent
  const deleteEventResp = await client.DeleteEventAsync({ token, eventId });
  console.log('DeleteEvent:', deleteEventResp[0]);

  // 21. DeleteSession
  const deleteSessionResp = await client.DeleteSessionAsync({ token });
  console.log('DeleteSession:', deleteSessionResp[0]);

  // 22. DeleteUser
  // Need to login again to delete user
  const relogin = await client.CreateSessionAsync({ email: userResp[0].user.email, password: 'password123' });
  const delToken = relogin[0].token;
  const deleteUserResp = await client.DeleteUserAsync({ token: delToken, userId });
  console.log('DeleteUser:', deleteUserResp[0]);
}

main().catch(e => { console.error(e); process.exit(1); });
