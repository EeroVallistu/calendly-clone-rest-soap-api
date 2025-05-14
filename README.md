# Calendly Clone SOAP API

This project provides a SOAP service that mirrors the functionality of the existing Calendly Clone REST API. It includes a WSDL description, a SOAP service implementation, client examples, and automated tests to verify equivalence.

## Project Structure

```
/project-root
 ├── wsdl/                # WSDL file defining the SOAP interface
 ├── src/                 # Source code for the SOAP service
 ├── scripts/             # Startup and utility scripts
 ├── client/              # Client example demonstrating SOAP API usage
 ├── tests/               # Automated tests comparing REST and SOAP APIs
 └── README.md            # This documentation
```

## Features

The SOAP API provides identical functionality to the REST API, including:

- User management (create, read, update, delete)
- Authentication (login/logout)
- Event management
- Schedule management
- Appointment management

## Prerequisites

- Node.js (v14 or later)
- npm (v6 or later)
- An existing REST API instance running on port 3002

## Installation

1. Clone the repository:

```bash
git clone https://github.com/your-username/calendly-clone-soap-api.git
cd calendly-clone-soap-api
```

2. Install dependencies:

```bash
# Install SOAP service dependencies
cd src/soap-service
npm install

# Install client example dependencies
cd ../../client
npm install

# Install test dependencies
cd ../tests
npm install
```

## Running the Service

### Using the Run Script

The simplest way to start the SOAP service is using the provided script:

```bash
./scripts/run.sh
```

This will:
1. Navigate to the source directory
2. Install dependencies if needed
3. Start the SOAP service on port 3001

### Manual Start

Alternatively, you can start the service manually:

```bash
cd src/soap-service
npm start
```

The service will be available at:
- SOAP Endpoint: http://localhost:3001/soap
- WSDL: http://localhost:3001/wsdl/calendly-soap-service.wsdl

## Client Example

A client example is provided to demonstrate how to use the SOAP API:

```bash
cd client
npm start
```

This will run through all the main operations of the API:
1. Create a user
2. Login
3. Create, read, update and delete calendar events
4. Manage schedules
5. Create, update and delete appointments
6. Logout

## Testing

The tests verify that the SOAP API provides equivalent functionality to the REST API by comparing responses from both.

To run the tests:

```bash
./tests/test.sh
```

### Test Requirements

- The original REST API must be running on port 3002
- The SOAP service will be started automatically if not already running

### What the Tests Verify

- Both APIs return equivalent data structures
- Both APIs enforce the same validation rules
- Both APIs handle CRUD operations identically
- Authentication works the same way in both APIs

## WSDL Details

The WSDL file (`wsdl/calendly-soap-service.wsdl`) defines:

- All data types using XML Schema
- Operations mapping to REST endpoints
- SOAP bindings for all operations
- Service endpoint details

## Error Handling

The SOAP API uses standard SOAP Fault messages for error conditions, including:

- Client errors (400-level HTTP equivalents)
- Server errors (500-level HTTP equivalents)
- Authentication/authorization failures

## Development

### Adding New Features

1. Update the WSDL file with new types and operations
2. Implement the corresponding operation in `src/soap-service/server.js`
3. Add client examples and tests as needed

### Modifying Existing Features

1. Update the WSDL if the data model changes
2. Modify the implementation in `src/soap-service/server.js`
3. Update tests to verify the changes

## Troubleshooting

### Common Issues

- **WSDL Not Found**: Ensure the SOAP service is running and the WSDL file is in the correct location
- **Database Connection Errors**: Verify that the database file exists and is readable/writable
- **Port Conflicts**: Check if port 3001 is already in use by another service

### Logs

The SOAP service logs information to the console, including:
- Service startup information
- Request/response details
- Error messages

## License

This project is licensed under the MIT License - see the LICENSE file for details.