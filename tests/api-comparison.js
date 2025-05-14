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