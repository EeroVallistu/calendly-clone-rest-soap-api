# Calendly SOAP API

This directory contains the SOAP API implementation for the Calendly Clone project.

## Directory Structure

```
calendly-soap-api/
├── client/          # SOAP client example
├── src/             # SOAP service implementation
├── wsdl/            # WSDL definition file
├── database.db      # SQLite database
└── package.json     # Root package.json with scripts
```

## Getting Started

To install dependencies:

```bash
npm run install-all
```

To start the SOAP service:

```bash
npm start
```

To run the client example:

```bash
npm run client
```

To run in development mode with auto-reload:

```bash
npm run dev
```

## SOAP Service

The SOAP service runs on port 3001 by default.
- SOAP Endpoint: http://localhost:3001/soap
- WSDL: http://localhost:3001/wsdl/calendly-soap-service.wsdl

## Features

The SOAP API provides functionality for:
- User management (create, read, update, delete)
- Authentication (login/logout)
- Event management
- Schedule management
- Appointment management
