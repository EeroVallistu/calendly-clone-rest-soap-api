const axios = require('axios');
const soap = require('soap');
const assert = require('assert').strict;

// API endpoints
const REST_API_URL = 'http://localhost:3002';
const SOAP_API_URL = 'http://localhost:3001/soap';
const WSDL_URL = 'http://localhost:3001/wsdl/calendly-soap-service.wsdl';

// Generate unique timestamp for this test run
const timestamp = Date.now();
const randomSuffix = Math.floor(Math.random() * 10000);

// Create unique test data for each API
const REST_USER = {
  name: 'Test REST User',
  email: `test.rest.${timestamp}.${randomSuffix}@example.com`,
  password: 'password123',
  timezone: 'Europe/Tallinn'
};

const SOAP_USER = {
  name: 'Test SOAP User',
  email: `test.soap.${timestamp}.${randomSuffix}@example.com`,
  password: 'password123',
  timezone: 'Europe/Tallinn'
};

// Store tokens and IDs
let restToken, soapToken;
let restUserId, soapUserId;
let restEventId, soapEventId;
let restScheduleId, soapScheduleId;
let restAppointmentId, soapAppointmentId;

// Test results summary
const testResults = {
  total: 0,
  passed: 0,
  failed: 0
};

// Helper function to log test results
function logTest(testName, result, error = null) {
  testResults.total++;
  
  if (result) {
    testResults.passed++;
    console.log(`✅ PASS: ${testName}`);
  } else {
    testResults.failed++;
    console.log(`❌ FAIL: ${testName}`);
    if (error) {
      console.error(`   Error: ${error.message || error}`);
    }
  }
}

// Helper function to compare REST and SOAP responses
function compareResponses(restResp, soapResp, fieldsToCompare) {
  const restData = {};
  const soapData = {};
  
  fieldsToCompare.forEach(field => {
    restData[field] = restResp[field];
    soapData[field] = soapResp[field];
  });
  
  try {
    assert.deepEqual(restData, soapData);
    return true;
  } catch (error) {
    console.error('Difference between REST and SOAP:');
    console.error('REST:', restData);
    console.error('SOAP:', soapData);
    return false;
  }
}

// Main test function
async function runTests() {
  try {
    console.log('Initializing SOAP client...');
    console.log(`Using REST user email: ${REST_USER.email}`);
    console.log(`Using SOAP user email: ${SOAP_USER.email}`);
    const client = await soap.createClientAsync(WSDL_URL);
    
    // Test 1: Create User
    console.log('\n--- Test 1: Create User ---');
    try {
      // REST API create user
      console.log('Creating user via REST API...');
      const restCreateUserResp = await axios.post(`${REST_API_URL}/users`, REST_USER);
      restUserId = restCreateUserResp.data.id;
      console.log(`REST user created with ID: ${restUserId}`);
      
      // SOAP API create user
      console.log('Creating user via SOAP API...');
      const soapCreateUserResp = await client.CreateUserAsync({
        user: SOAP_USER
      });
      soapUserId = soapCreateUserResp[0].user.id;
      console.log(`SOAP user created with ID: ${soapUserId}`);
      
      // Verify both APIs created a user
      logTest('Both APIs created a user with ID', restUserId && soapUserId);
      
      // Compare fields except for email (which will be different)
      const restUser = restCreateUserResp.data;
      const soapUser = soapCreateUserResp[0].user;
      
      logTest('User data matches expected fields', 
        restUser.name === REST_USER.name && 
        soapUser.name === SOAP_USER.name && 
        restUser.timezone === REST_USER.timezone && 
        soapUser.timezone === SOAP_USER.timezone);
      
    } catch (error) {
      console.error('Error details:', error.response ? error.response.data : error.root);
      logTest('Create User', false, error);
    }
    
    // Only continue if both users were created
    if (!restUserId || !soapUserId) {
      console.error('Stopping tests: Failed to create test users');
      return;
    }
    
    // Test 2: Login
    console.log('\n--- Test 2: Login ---');
    try {
      // REST API login
      console.log('Logging in via REST API...');
      const restLoginResp = await axios.post(`${REST_API_URL}/sessions`, {
        email: REST_USER.email,
        password: REST_USER.password
      });
      restToken = restLoginResp.data.token;
      console.log('REST login successful');
      
      // SOAP API login
      console.log('Logging in via SOAP API...');
      const soapLoginResp = await client.CreateSessionAsync({
        email: SOAP_USER.email,
        password: SOAP_USER.password
      });
      soapToken = soapLoginResp[0].token;
      console.log('SOAP login successful');
      
      // Verify both APIs returned a token
      logTest('Both APIs returned a token', restToken && soapToken);
      
    } catch (error) {
      console.error('Error details:', error.response ? error.response.data : error.root);
      logTest('Login', false, error);
    }
    
    // Only continue if authentication succeeded
    if (!restToken || !soapToken) {
      console.error('Stopping tests: Failed to authenticate');
      return;
    }
    
    // Test 3: Create Event
    console.log('\n--- Test 3: Create Event ---');
    const eventData = {
      name: 'Test Compare Event',
      duration: 60,
      description: 'This is a test comparison event',
      color: '#3498db'
    };
    
    try {
      // REST API create event
      console.log('Creating event via REST API...');
      const restCreateEventResp = await axios.post(
        `${REST_API_URL}/events`,
        eventData,
        { headers: { 'Authorization': `Bearer ${restToken}` } }
      );
      restEventId = restCreateEventResp.data.id;
      console.log(`REST event created with ID: ${restEventId}`);
      
      // SOAP API create event
      console.log('Creating event via SOAP API...');
      const soapCreateEventResp = await client.CreateEventAsync({
        token: soapToken,
        event: eventData
      });
      soapEventId = soapCreateEventResp[0].event.id;
      console.log(`SOAP event created with ID: ${soapEventId}`);
      
      // Verify both APIs created an event
      logTest('Both APIs created an event with ID', restEventId && soapEventId);
      
      // Compare event data
      const restEvent = restCreateEventResp.data;
      const soapEvent = soapCreateEventResp[0].event;
      
      logTest('Event data matches', compareResponses(
        restEvent,
        soapEvent,
        ['name', 'duration', 'description', 'color']
      ));
      
    } catch (error) {
      console.error('Error details:', error.response ? error.response.data : error.root);
      logTest('Create Event', false, error);
    }
    
    // Only continue if both events were created
    if (!restEventId || !soapEventId) {
      console.error('Stopping tests: Failed to create events');
      return;
    }
    
    // Test 4: Get Events
    console.log('\n--- Test 4: Get Events ---');
    try {
      // REST API get events
      console.log('Getting events via REST API...');
      const restGetEventsResp = await axios.get(
        `${REST_API_URL}/events`,
        { headers: { 'Authorization': `Bearer ${restToken}` } }
      );
      
      // SOAP API get events
      console.log('Getting events via SOAP API...');
      const soapGetEventsResp = await client.GetEventsAsync({
        token: soapToken
      });
      
      // Verify both APIs returned events
      const restHasEvents = restGetEventsResp.data.length > 0;
      const soapHasEvents = soapGetEventsResp[0].events.length > 0;
      console.log(`REST returned ${restGetEventsResp.data.length} events`);
      console.log(`SOAP returned ${soapGetEventsResp[0].events.length} events`);
      
      logTest('Both APIs returned events', restHasEvents && soapHasEvents);
      
    } catch (error) {
      console.error('Error details:', error.response ? error.response.data : error.root);
      logTest('Get Events', false, error);
    }
    
    // Test 5: Create Schedule
    console.log('\n--- Test 5: Create Schedule ---');
    try {
      // Prepare schedule data
      const restScheduleData = {
        userId: restUserId,
        availability: [
          {
            day: 'monday',
            startTime: '09:00',
            endTime: '17:00'
          },
          {
            day: 'wednesday',
            startTime: '10:00',
            endTime: '18:00'
          }
        ]
      };
      
      const soapScheduleData = {
        userId: soapUserId,
        availability: {
          timeSlot: [
            {
              day: 'monday',
              startTime: '09:00',
              endTime: '17:00'
            },
            {
              day: 'wednesday',
              startTime: '10:00',
              endTime: '18:00'
            }
          ]
        }
      };
      
      // REST API create schedule
      console.log('Creating schedule via REST API...');
      const restCreateScheduleResp = await axios.post(
        `${REST_API_URL}/schedules`,
        restScheduleData,
        { headers: { 'Authorization': `Bearer ${restToken}` } }
      );
      console.log('REST schedule created successfully');
      
      // SOAP API create schedule
      console.log('Creating schedule via SOAP API...');
      const soapCreateScheduleResp = await client.CreateScheduleAsync({
        token: soapToken,
        schedule: soapScheduleData
      });
      
      if (soapCreateScheduleResp[0].schedule && soapCreateScheduleResp[0].schedule.id) {
        soapScheduleId = soapCreateScheduleResp[0].schedule.id;
        console.log(`SOAP schedule created with ID: ${soapScheduleId}`);
      }
      
      // Verify both APIs created a schedule
      logTest('Both APIs created a schedule', 
        restCreateScheduleResp.data && soapCreateScheduleResp[0].schedule);
      
    } catch (error) {
      console.error('Error details:', error.response ? error.response.data : error.root);
      logTest('Create Schedule', false, error);
    }
      // Test 6A: Get User
    console.log('\n--- Test 6A: Get User ---');
    try {
      // REST API get user
      console.log('Getting user via REST API...');
      const restGetUserResp = await axios.get(
        `${REST_API_URL}/users/${restUserId}`,
        { headers: { 'Authorization': `Bearer ${restToken}` } }
      );
      
      // SOAP API get user
      console.log('Getting user via SOAP API...');
      const soapGetUserResp = await client.GetUserAsync({
        token: soapToken,
        userId: soapUserId
      });
      
      // Verify both APIs returned user data
      logTest('Both APIs returned user data', 
        restGetUserResp.data.id === restUserId && 
        soapGetUserResp[0].user.id === soapUserId);
      
    } catch (error) {
      console.error('Error details:', error.response ? error.response.data : error.root);
      logTest('Get User', false, error);
    }
    
    // Test 6B: Update User
    console.log('\n--- Test 6B: Update User ---');
    try {
      const updatedName = "Updated User Name";
      
      // REST API update user
      console.log('Updating user via REST API...');
      const restUpdateUserResp = await axios.patch(
        `${REST_API_URL}/users/${restUserId}`,
        { name: updatedName },
        { headers: { 'Authorization': `Bearer ${restToken}` } }
      );
      
      // SOAP API update user
      console.log('Updating user via SOAP API...');
      const soapUpdateUserResp = await client.UpdateUserAsync({
        token: soapToken,
        userId: soapUserId,
        name: updatedName
      });
      
      // Verify both APIs updated the user
      logTest('Both APIs updated the user name', 
        restUpdateUserResp.data.name === updatedName && 
        soapUpdateUserResp[0].user.name === updatedName);
      
    } catch (error) {
      console.error('Error details:', error.response ? error.response.data : error.root);
      logTest('Update User', false, error);
    }

    // Test 6C: Get Event
    console.log('\n--- Test 6C: Get Event ---');
    try {
      // REST API get event
      console.log('Getting event via REST API...');
      const restGetEventResp = await axios.get(
        `${REST_API_URL}/events/${restEventId}`,
        { headers: { 'Authorization': `Bearer ${restToken}` } }
      );
      
      // SOAP API get event
      console.log('Getting event via SOAP API...');
      const soapGetEventResp = await client.GetEventAsync({
        token: soapToken,
        eventId: soapEventId
      });
      
      // Verify both APIs returned event data
      logTest('Both APIs returned event data', 
        restGetEventResp.data.id === restEventId && 
        soapGetEventResp[0].event.id === soapEventId);
      
    } catch (error) {
      console.error('Error details:', error.response ? error.response.data : error.root);
      logTest('Get Event', false, error);
    }
    
    // Test 6D: Update Event
    console.log('\n--- Test 6D: Update Event ---');
    try {
      const updatedDescription = "Updated event description";
      
      // REST API update event
      console.log('Updating event via REST API...');
      const restUpdateEventResp = await axios.patch(
        `${REST_API_URL}/events/${restEventId}`,
        { description: updatedDescription },
        { headers: { 'Authorization': `Bearer ${restToken}` } }
      );
      
      // SOAP API update event
      console.log('Updating event via SOAP API...');
      const soapUpdateEventResp = await client.UpdateEventAsync({
        token: soapToken,
        eventId: soapEventId,
        description: updatedDescription
      });
      
      // Verify both APIs updated the event
      logTest('Both APIs updated the event description', 
        restUpdateEventResp.data.description === updatedDescription && 
        soapUpdateEventResp[0].event.description === updatedDescription);
      
    } catch (error) {
      console.error('Error details:', error.response ? error.response.data : error.root);
      logTest('Update Event', false, error);
    }
    
    // Test 6E: Get Schedules
    console.log('\n--- Test 6E: Get Schedules ---');
    try {
      // REST API get schedules
      console.log('Getting schedules via REST API...');
      const restGetSchedulesResp = await axios.get(
        `${REST_API_URL}/schedules`,
        { headers: { 'Authorization': `Bearer ${restToken}` } }
      );
      
      // SOAP API get schedules
      console.log('Getting schedules via SOAP API...');
      const soapGetSchedulesResp = await client.GetSchedulesAsync({
        token: soapToken
      });
      
      // Verify both APIs returned schedules
      const restHasSchedules = restGetSchedulesResp.data.length > 0;
      const soapHasSchedules = soapGetSchedulesResp[0].schedules.length > 0;
      
      logTest('Both APIs returned schedules', restHasSchedules && soapHasSchedules);
      
    } catch (error) {
      console.error('Error details:', error.response ? error.response.data : error.root);
      logTest('Get Schedules', false, error);
    }
    
    // Test 6F: Get Schedule
    console.log('\n--- Test 6F: Get Schedule ---');
    try {
      // REST API get schedule
      console.log('Getting schedule via REST API...');
      const restGetScheduleResp = await axios.get(
        `${REST_API_URL}/schedules/${restUserId}`,
        { headers: { 'Authorization': `Bearer ${restToken}` } }
      );
      
      // SOAP API get schedule
      console.log('Getting schedule via SOAP API...');
      const soapGetScheduleResp = await client.GetScheduleAsync({
        userId: soapUserId
      });
      
      // Verify both APIs returned schedule data
      logTest('Both APIs returned schedule data', 
        restGetScheduleResp.data.userId === restUserId && 
        soapGetScheduleResp[0].schedule.userId === soapUserId);
      
    } catch (error) {
      console.error('Error details:', error.response ? error.response.data : error.root);
      logTest('Get Schedule', false, error);
    }
    
    // Test 6G: Update Schedule
    console.log('\n--- Test 6G: Update Schedule ---');
    try {
      // Prepare updated availability data
      const restScheduleUpdate = {
        availability: [
          {
            day: 'friday',
            startTime: '09:00',
            endTime: '14:00'
          }
        ]
      };
      
      const soapScheduleUpdate = {
        availability: {
          timeSlot: [
            {
              day: 'friday',
              startTime: '09:00',
              endTime: '14:00'
            }
          ]
        }
      };
      
      // REST API update schedule
      console.log('Updating schedule via REST API...');
      const restUpdateScheduleResp = await axios.patch(
        `${REST_API_URL}/schedules/${restUserId}`,
        restScheduleUpdate,
        { headers: { 'Authorization': `Bearer ${restToken}` } }
      );
      
      // SOAP API update schedule
      console.log('Updating schedule via SOAP API...');
      const soapUpdateScheduleResp = await client.UpdateScheduleAsync({
        token: soapToken,
        userId: soapUserId,
        availability: soapScheduleUpdate.availability
      });
      
      // Verify both APIs updated the schedule
      logTest('Both APIs updated the schedule', 
        restUpdateScheduleResp.data && soapUpdateScheduleResp[0].schedule);
      
    } catch (error) {
      console.error('Error details:', error.response ? error.response.data : error.root);
      logTest('Update Schedule', false, error);
    }
    
    // Test 6: Create Appointment
    console.log('\n--- Test 6: Create Appointment ---');
    try {
      // Prepare appointment data for each API
      const restAppointmentData = {
        eventId: restEventId,
        inviteeEmail: 'rest.invitee@example.com',
        startTime: '2025-06-15T14:00:00',
        endTime: '2025-06-15T15:00:00'
      };
      
      const soapAppointmentData = {
        eventId: soapEventId,
        inviteeEmail: 'soap.invitee@example.com',
        startTime: '2025-06-15T14:00:00',
        endTime: '2025-06-15T15:00:00'
      };
      
      // REST API create appointment
      console.log('Creating appointment via REST API...');
      const restCreateApptResp = await axios.post(
        `${REST_API_URL}/appointments`,
        restAppointmentData,
        { headers: { 'Authorization': `Bearer ${restToken}` } }
      );
      restAppointmentId = restCreateApptResp.data.id;
      console.log(`REST appointment created with ID: ${restAppointmentId}`);
      
      // SOAP API create appointment
      console.log('Creating appointment via SOAP API...');
      const soapCreateApptResp = await client.CreateAppointmentAsync({
        token: soapToken,
        appointment: soapAppointmentData
      });
      soapAppointmentId = soapCreateApptResp[0].appointment.id;
      console.log(`SOAP appointment created with ID: ${soapAppointmentId}`);
      
      // Verify both APIs created an appointment
      logTest('Both APIs created an appointment with ID', restAppointmentId && soapAppointmentId);
      
      // Compare appointment data
      logTest('Appointment status matches', 
        restCreateApptResp.data.status === soapCreateApptResp[0].appointment.status);
      
    } catch (error) {
      console.error('Error details:', error.response ? error.response.data : error.root);
      logTest('Create Appointment', false, error);
    }
    
    // Only continue if both appointments were created
    if (!restAppointmentId || !soapAppointmentId) {
      console.error('Stopping tests: Failed to create appointments');
      return;
    }
      // Test 6H: Get Appointments
    console.log('\n--- Test 6H: Get Appointments ---');
    try {
      // REST API get appointments
      console.log('Getting appointments via REST API...');
      const restGetAppointmentsResp = await axios.get(
        `${REST_API_URL}/appointments`,
        { headers: { 'Authorization': `Bearer ${restToken}` } }
      );
      
      // SOAP API get appointments
      console.log('Getting appointments via SOAP API...');
      const soapGetAppointmentsResp = await client.GetAppointmentsAsync({
        token: soapToken
      });
      
      // Verify both APIs returned appointments
      const restHasAppointments = restGetAppointmentsResp.data.length > 0;
      const soapHasAppointments = soapGetAppointmentsResp[0].appointments.length > 0;
      
      logTest('Both APIs returned appointments', restHasAppointments && soapHasAppointments);
      
    } catch (error) {
      console.error('Error details:', error.response ? error.response.data : error.root);
      logTest('Get Appointments', false, error);
    }
    
    // Test 6I: Get Appointment
    console.log('\n--- Test 6I: Get Appointment ---');
    try {
      // REST API get appointment
      console.log('Getting appointment via REST API...');
      const restGetAppointmentResp = await axios.get(
        `${REST_API_URL}/appointments/${restAppointmentId}`,
        { headers: { 'Authorization': `Bearer ${restToken}` } }
      );
      
      // SOAP API get appointment
      console.log('Getting appointment via SOAP API...');
      const soapGetAppointmentResp = await client.GetAppointmentAsync({
        token: soapToken,
        appointmentId: soapAppointmentId
      });
      
      // Verify both APIs returned appointment data
      logTest('Both APIs returned appointment data', 
        restGetAppointmentResp.data.id === restAppointmentId && 
        soapGetAppointmentResp[0].appointment.id === soapAppointmentId);
      
    } catch (error) {
      console.error('Error details:', error.response ? error.response.data : error.root);
      logTest('Get Appointment', false, error);
    }
    
    // Test 7: Update Appointment
    console.log('\n--- Test 7: Update Appointment ---');
    try {
      // REST API update appointment
      console.log('Updating appointment via REST API...');
      const restUpdateApptResp = await axios.patch(
        `${REST_API_URL}/appointments/${restAppointmentId}`,
        { status: 'canceled' },
        { headers: { 'Authorization': `Bearer ${restToken}` } }
      );
      console.log(`REST appointment updated, new status: ${restUpdateApptResp.data.status}`);
      
      // SOAP API update appointment
      console.log('Updating appointment via SOAP API...');
      const soapUpdateApptResp = await client.UpdateAppointmentAsync({
        token: soapToken,
        appointmentId: soapAppointmentId,
        status: 'canceled'
      });
      console.log(`SOAP appointment updated, new status: ${soapUpdateApptResp[0].appointment.status}`);
      
      // Verify both APIs updated the appointment status
      logTest('Both APIs updated appointment status', 
        restUpdateApptResp.data.status === 'canceled' && 
        soapUpdateApptResp[0].appointment.status === 'canceled');
      
    } catch (error) {
      console.error('Error details:', error.response ? error.response.data : error.root);
      logTest('Update Appointment', false, error);
    }
    
    // Test 8: Delete Appointment
    console.log('\n--- Test 8: Delete Appointment ---');
    try {
      // REST API delete appointment
      console.log('Deleting appointment via REST API...');
      const restDeleteApptResp = await axios.delete(
        `${REST_API_URL}/appointments/${restAppointmentId}`,
        { headers: { 'Authorization': `Bearer ${restToken}` } }
      );
      console.log(`REST appointment deleted, status: ${restDeleteApptResp.status}`);
      
      // SOAP API delete appointment
      console.log('Deleting appointment via SOAP API...');
      const soapDeleteApptResp = await client.DeleteAppointmentAsync({
        token: soapToken,
        appointmentId: soapAppointmentId
      });
      console.log(`SOAP appointment deleted, success: ${soapDeleteApptResp[0].success}`);
      
      // Verify both APIs deleted the appointment successfully
      logTest('Both APIs deleted appointment successfully', 
        restDeleteApptResp.status === 204 && soapDeleteApptResp[0].success === true);
      
    } catch (error) {
      console.error('Error details:', error.response ? error.response.data : error.root);
      logTest('Delete Appointment', false, error);
    }
      // Test 8A: Delete Schedule
    console.log('\n--- Test 8A: Delete Schedule ---');
    try {
      // We'll create a new schedule first that we can safely delete
      // Prepare schedule data
      const restScheduleData = {
        userId: restUserId,
        availability: [
          {
            day: 'saturday',
            startTime: '10:00',
            endTime: '13:00'
          }
        ]
      };
      
      const soapScheduleData = {
        userId: soapUserId,
        availability: {
          timeSlot: [
            {
              day: 'saturday',
              startTime: '10:00',
              endTime: '13:00'
            }
          ]
        }
      };
      
      // Create schedules to delete
      console.log('Creating temporary schedules to test deletion...');
      await axios.post(
        `${REST_API_URL}/schedules`,
        restScheduleData,
        { headers: { 'Authorization': `Bearer ${restToken}` } }
      );
      
      await client.CreateScheduleAsync({
        token: soapToken,
        schedule: soapScheduleData
      });
      
      // REST API delete schedule
      console.log('Deleting schedule via REST API...');
      const restDeleteScheduleResp = await axios.delete(
        `${REST_API_URL}/schedules/${restUserId}`,
        { headers: { 'Authorization': `Bearer ${restToken}` } }
      );
      console.log(`REST schedule deleted, status: ${restDeleteScheduleResp.status}`);
      
      // SOAP API delete schedule
      console.log('Deleting schedule via SOAP API...');
      const soapDeleteScheduleResp = await client.DeleteScheduleAsync({
        token: soapToken,
        userId: soapUserId
      });
      console.log(`SOAP schedule deleted, success: ${soapDeleteScheduleResp[0].success}`);
      
      // Verify both APIs deleted the schedule successfully
      logTest('Both APIs deleted schedule successfully', 
        restDeleteScheduleResp.status === 204 && 
        soapDeleteScheduleResp[0].success === true);
      
    } catch (error) {
      console.error('Error details:', error.response ? error.response.data : error.root);
      logTest('Delete Schedule', false, error);
    }
    
    // Test 8B: Delete Event
    console.log('\n--- Test 8B: Delete Event ---');
    try {
      // Creating a test event to delete
      const testEventData = {
        name: 'Test Event To Delete',
        duration: 30,
        description: 'This event will be deleted',
        color: '#FF5733'
      };
      
      // Create events to delete
      console.log('Creating temporary events to test deletion...');
      const restDeleteEventResp1 = await axios.post(
        `${REST_API_URL}/events`,
        testEventData,
        { headers: { 'Authorization': `Bearer ${restToken}` } }
      );
      const tempRestEventId = restDeleteEventResp1.data.id;
      
      const soapDeleteEventResp1 = await client.CreateEventAsync({
        token: soapToken,
        event: testEventData
      });
      const tempSoapEventId = soapDeleteEventResp1[0].event.id;
      
      // REST API delete event
      console.log('Deleting event via REST API...');
      const restDeleteEventResp = await axios.delete(
        `${REST_API_URL}/events/${tempRestEventId}`,
        { headers: { 'Authorization': `Bearer ${restToken}` } }
      );
      console.log(`REST event deleted, status: ${restDeleteEventResp.status}`);
      
      // SOAP API delete event
      console.log('Deleting event via SOAP API...');
      const soapDeleteEventResp = await client.DeleteEventAsync({
        token: soapToken,
        eventId: tempSoapEventId
      });
      console.log(`SOAP event deleted, success: ${soapDeleteEventResp[0].success}`);
      
      // Verify both APIs deleted the event successfully
      logTest('Both APIs deleted event successfully', 
        restDeleteEventResp.status === 204 && 
        soapDeleteEventResp[0].success === true);
      
    } catch (error) {
      console.error('Error details:', error.response ? error.response.data : error.root);
      logTest('Delete Event', false, error);
    }

    // Test 8C: Get Users
    console.log('\n--- Test 8C: Get Users ---');
    try {
      // REST API get users
      console.log('Getting users via REST API...');
      const restGetUsersResp = await axios.get(
        `${REST_API_URL}/users?page=1&pageSize=10`,
        { headers: { 'Authorization': `Bearer ${restToken}` } }
      );
      
      // SOAP API get users
      console.log('Getting users via SOAP API...');
      const soapGetUsersResp = await client.GetUsersAsync({
        token: soapToken,
        page: 1,
        pageSize: 10
      });
      
      // Verify both APIs returned users
      const restHasUsers = restGetUsersResp.data.length > 0;
      const soapHasUsers = soapGetUsersResp[0].users.length > 0;
      
      logTest('Both APIs returned users', restHasUsers && soapHasUsers);
      
    } catch (error) {
      console.error('Error details:', error.response ? error.response.data : error.root);
      logTest('Get Users', false, error);
    }
    
    // Test 9: Logout
    console.log('\n--- Test 9: Logout ---');
    try {
      // REST API logout
      console.log('Logging out via REST API...');
      const restLogoutResp = await axios.delete(
        `${REST_API_URL}/sessions`,
        { headers: { 'Authorization': `Bearer ${restToken}` } }
      );
      console.log(`REST logout response: ${restLogoutResp.data.message}`);
      
      // SOAP API logout
      console.log('Logging out via SOAP API...');
      const soapLogoutResp = await client.DeleteSessionAsync({
        token: soapToken
      });
      console.log(`SOAP logout response: ${soapLogoutResp[0].message}`);
      
      // Verify both APIs logged out successfully
      logTest('Both APIs logged out successfully', 
        restLogoutResp.data.message.includes('success') && 
        soapLogoutResp[0].message.includes('success'));
      
    } catch (error) {
      console.error('Error details:', error.response ? error.response.data : error.root);
      logTest('Logout', false, error);
    }
      // Test 9A: Delete User
    console.log('\n--- Test 9A: Delete User ---');
    try {
      // Create temp users to delete
      const tempRestUser = {
        name: 'Temp REST User',
        email: `temp.rest.${timestamp}.${randomSuffix+1}@example.com`,
        password: 'password123',
        timezone: 'Europe/Tallinn'
      };
      
      const tempSoapUser = {
        name: 'Temp SOAP User',
        email: `temp.soap.${timestamp}.${randomSuffix+1}@example.com`,
        password: 'password123',
        timezone: 'Europe/Tallinn'
      };
      
      // Create users
      console.log('Creating temporary users to test deletion...');
      const tempRestUserResp = await axios.post(`${REST_API_URL}/users`, tempRestUser);
      const tempRestUserId = tempRestUserResp.data.id;
      
      const tempSoapUserResp = await client.CreateUserAsync({
        user: tempSoapUser
      });
      const tempSoapUserId = tempSoapUserResp[0].user.id;
      
      // Login to get tokens
      const tempRestLoginResp = await axios.post(`${REST_API_URL}/sessions`, {
        email: tempRestUser.email,
        password: tempRestUser.password
      });
      const tempRestToken = tempRestLoginResp.data.token;
      
      const tempSoapLoginResp = await client.CreateSessionAsync({
        email: tempSoapUser.email,
        password: tempSoapUser.password
      });
      const tempSoapToken = tempSoapLoginResp[0].token;
      
      // REST API delete user
      console.log('Deleting user via REST API...');
      const restDeleteUserResp = await axios.delete(
        `${REST_API_URL}/users/${tempRestUserId}`,
        { headers: { 'Authorization': `Bearer ${tempRestToken}` } }
      );
      console.log(`REST user deleted, status: ${restDeleteUserResp.status}`);
      
      // SOAP API delete user
      console.log('Deleting user via SOAP API...');
      const soapDeleteUserResp = await client.DeleteUserAsync({
        token: tempSoapToken,
        userId: tempSoapUserId
      });
      console.log(`SOAP user deleted, success: ${soapDeleteUserResp[0].success}`);
      
      // Verify both APIs deleted the user successfully
      logTest('Both APIs deleted user successfully', 
        restDeleteUserResp.status === 204 && 
        soapDeleteUserResp[0].success === true);
      
    } catch (error) {
      console.error('Error details:', error.response ? error.response.data : error.root);
      logTest('Delete User', false, error);
    }

    // Print test summary
    console.log('\n=== Test Summary ===');
    console.log(`Total tests: ${testResults.total}`);
    console.log(`Passed: ${testResults.passed}`);
    console.log(`Failed: ${testResults.failed}`);
    
    if (testResults.failed > 0) {
      process.exit(1);
    }
    
  } catch (error) {
    console.error('Error running tests:', error);
    process.exit(1);
  }
}

// Run the tests
runTests(); 