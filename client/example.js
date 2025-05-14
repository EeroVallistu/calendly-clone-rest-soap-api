const soap = require('soap');
const util = require('util');

// WSDL URL
const wsdlUrl = 'http://localhost:3001/wsdl/calendly-soap-service.wsdl';

// User credentials for testing
const testUserEmail = 'test@example.com';
const testUserPassword = 'password123';
let authToken = null;
let userId = null;
let eventId = null;
let scheduleId = null;
let appointmentId = null;

// Helper function to log responses
function logResponse(operationName, response) {
  console.log(`\n=== ${operationName} Response ===`);
  console.log(util.inspect(response, false, null, true));
  console.log('========================\n');
}

// Main async function to execute all operations
async function runSoapExamples() {
  try {
    console.log('Creating SOAP client...');
    const client = await soap.createClientAsync(wsdlUrl);
    
    // 1. Create a user
    console.log('\n1. Creating a user...');
    const createUserResponse = await client.CreateUserAsync({
      user: {
        name: 'Test User',
        email: testUserEmail,
        password: testUserPassword,
        timezone: 'Europe/Tallinn'
      }
    });
    logResponse('CreateUser', createUserResponse);
    
    // Save user ID
    userId = createUserResponse[0].user.id;
    console.log(`User ID: ${userId}`);
    
    // 2. Login (Create session)
    console.log('\n2. Logging in...');
    const loginResponse = await client.CreateSessionAsync({
      email: testUserEmail,
      password: testUserPassword
    });
    logResponse('CreateSession', loginResponse);
    
    // Save auth token
    authToken = loginResponse[0].token;
    console.log(`Auth Token: ${authToken}`);
    
    // 3. Get user details
    console.log('\n3. Getting user details...');
    const getUserResponse = await client.GetUserAsync({
      token: authToken,
      userId: userId
    });
    logResponse('GetUser', getUserResponse);
    
    // 4. Create an event
    console.log('\n4. Creating an event...');
    const createEventResponse = await client.CreateEventAsync({
      token: authToken,
      event: {
        name: 'Test Event',
        duration: 60,
        description: 'This is a test event',
        color: '#3498db'
      }
    });
    logResponse('CreateEvent', createEventResponse);
    
    // Save event ID
    eventId = createEventResponse[0].event.id;
    console.log(`Event ID: ${eventId}`);
    
    // 5. Get all events
    console.log('\n5. Getting all events...');
    const getEventsResponse = await client.GetEventsAsync({
      token: authToken
    });
    logResponse('GetEvents', getEventsResponse);
    
    // 6. Create a schedule
    console.log('\n6. Creating a schedule...');
    const createScheduleResponse = await client.CreateScheduleAsync({
      token: authToken,
      schedule: {
        userId: userId,
        availability: {
          timeSlot: [
            {
              day: 'monday',
              startTime: '09:00',
              endTime: '17:00'
            },
            {
              day: 'tuesday',
              startTime: '09:00',
              endTime: '17:00'
            },
            {
              day: 'wednesday',
              startTime: '09:00',
              endTime: '17:00'
            }
          ]
        }
      }
    });
    logResponse('CreateSchedule', createScheduleResponse);
    
    // Save schedule ID
    scheduleId = createScheduleResponse[0].schedule.id;
    console.log(`Schedule ID: ${scheduleId}`);
    
    // 7. Get schedule
    console.log('\n7. Getting schedule...');
    const getScheduleResponse = await client.GetScheduleAsync({
      userId: userId
    });
    logResponse('GetSchedule', getScheduleResponse);
    
    // 8. Create an appointment
    console.log('\n8. Creating an appointment...');
    const createAppointmentResponse = await client.CreateAppointmentAsync({
      token: authToken,
      appointment: {
        eventId: eventId,
        inviteeEmail: 'invitee@example.com',
        startTime: '2025-01-15T10:00:00',
        endTime: '2025-01-15T11:00:00'
      }
    });
    logResponse('CreateAppointment', createAppointmentResponse);
    
    // Save appointment ID
    appointmentId = createAppointmentResponse[0].appointment.id;
    console.log(`Appointment ID: ${appointmentId}`);
    
    // 9. Get appointments
    console.log('\n9. Getting all appointments...');
    const getAppointmentsResponse = await client.GetAppointmentsAsync({
      token: authToken
    });
    logResponse('GetAppointments', getAppointmentsResponse);
    
    // 10. Update appointment
    console.log('\n10. Updating appointment...');
    const updateAppointmentResponse = await client.UpdateAppointmentAsync({
      token: authToken,
      appointmentId: appointmentId,
      status: 'canceled'
    });
    logResponse('UpdateAppointment', updateAppointmentResponse);
    
    // 11. Update event
    console.log('\n11. Updating event...');
    const updateEventResponse = await client.UpdateEventAsync({
      token: authToken,
      eventId: eventId,
      duration: 45,
      description: 'Updated description'
    });
    logResponse('UpdateEvent', updateEventResponse);
    
    // 12. Delete appointment
    console.log('\n12. Deleting appointment...');
    const deleteAppointmentResponse = await client.DeleteAppointmentAsync({
      token: authToken,
      appointmentId: appointmentId
    });
    logResponse('DeleteAppointment', deleteAppointmentResponse);
    
    // 13. Logout
    console.log('\n13. Logging out...');
    const logoutResponse = await client.DeleteSessionAsync({
      token: authToken
    });
    logResponse('DeleteSession', logoutResponse);
    
    console.log('\nAll SOAP operations completed successfully!');
    
  } catch (error) {
    console.error('Error executing SOAP operations:');
    if (error.root && error.root.Envelope && error.root.Envelope.Body && error.root.Envelope.Body.Fault) {
      console.error('SOAP Fault:', error.root.Envelope.Body.Fault);
    } else {
      console.error(error);
    }
  }
}

// Run examples
runSoapExamples(); 