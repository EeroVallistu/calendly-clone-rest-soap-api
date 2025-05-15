const express = require('express');
const soap = require('soap');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const dotenv = require('dotenv');
const cors = require('cors');

// Load environment variables
dotenv.config();

// Initialize database connection
const db = new sqlite3.Database('./database.db');

// Create Express app
const app = express();
app.use(express.json());
app.use(cors());

// Serve WSDL file from the static directory
app.use('/wsdl', express.static(path.join(__dirname, './wsdl')));

app.get('/wsdl', (req, res) => {
  res.setHeader('Content-Type', 'text/xml');
  res.sendFile(path.join(__dirname, './wsdl/calendly-soap-service.wsdl'));
});

// Helper functions
const isValidEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

const isValidHexColor = (color) => {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
};

const validateToken = (token, callback) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE token = ?', [token], (err, user) => {
      if (err || !user) {
        return reject({
          Fault: {
            Code: {
              Value: 'soap:Client',
              Subcode: { Value: 'Unauthorized' }
            },
            Reason: { Text: 'Invalid token' }
          }
        });
      }
      resolve(user);
    });
  });
};

// Service implementation
const service = {
  CalendlyService: {
    CalendlyPort: {
      // User Operations
      CreateUser: function(args, callback) {
        const { user } = args;
        
        if (!user.name || !user.email || !user.password) {
          return callback({
            Fault: {
              Code: {
                Value: 'soap:Client',
                Subcode: { Value: 'BadRequest' }
              },
              Reason: { Text: 'Name, email, and password are required' }
            }
          });
        }

        if (!isValidEmail(user.email)) {
          return callback({
            Fault: {
              Code: {
                Value: 'soap:Client',
                Subcode: { Value: 'BadRequest' }
              },
              Reason: { Text: 'Invalid email format' }
            }
          });
        }

        const id = Date.now().toString(); // Simple ID generation
        
        db.run(
          'INSERT INTO users (id, name, email, password, timezone) VALUES (?, ?, ?, ?, ?)',
          [id, user.name, user.email, user.password, user.timezone || null],
          function(err) {
            if (err) {
              console.error('Database error:', err.message);
              
              if (err.message.includes('UNIQUE constraint failed: users.email')) {
                return callback({
                  Fault: {
                    Code: {
                      Value: 'soap:Client',
                      Subcode: { Value: 'BadRequest' }
                    },
                    Reason: { Text: 'Email already in use' }
                  }
                });
              }
              
              return callback({
                Fault: {
                  Code: {
                    Value: 'soap:Server',
                    Subcode: { Value: 'DatabaseError' }
                  },
                  Reason: { Text: 'Database error' }
                }
              });
            }
            
            user.id = id;
            callback(null, { user });
          }
        );
      },
      
      GetUsers: function(args, callback) {
        const { token, page = 1, pageSize = 20 } = args;
        
        // Validate token
        validateToken(token)
          .then(user => {
            const offset = (page - 1) * pageSize;
            
            db.all(
              'SELECT * FROM users LIMIT ? OFFSET ?',
              [pageSize, offset],
              (err, rows) => {
                if (err) {
                  return callback({
                    Fault: {
                      Code: {
                        Value: 'soap:Server',
                        Subcode: { Value: 'DatabaseError' }
                      },
                      Reason: { Text: 'Database error' }
                    }
                  });
                }
                
                // Format the response
                const users = rows.map(row => ({
                  id: row.id,
                  name: row.name,
                  email: row.email,
                  timezone: row.timezone
                }));
                
                const pagination = {
                  page: parseInt(page),
                  pageSize: parseInt(pageSize),
                  total: users.length
                };
                
                callback(null, { users, pagination });
              }
            );
          })
          .catch(fault => callback(fault));
      },
      
      GetUser: function(args, callback) {
        const { token, userId } = args;
        
        // Validate token
        validateToken(token)
          .then(userAuth => {
            db.get('SELECT * FROM users WHERE id = ?', [userId], (err, userFound) => {
              if (err) {
                return callback({
                  Fault: {
                    Code: {
                      Value: 'soap:Server',
                      Subcode: { Value: 'DatabaseError' }
                    },
                    Reason: { Text: 'Database error' }
                  }
                });
              }
              
              if (!userFound) {
                return callback({
                  Fault: {
                    Code: {
                      Value: 'soap:Client',
                      Subcode: { Value: 'NotFound' }
                    },
                    Reason: { Text: 'User not found' }
                  }
                });
              }
              
              // Format the response - exclude password for security
              const user = {
                id: userFound.id,
                name: userFound.name,
                email: userFound.email,
                timezone: userFound.timezone
              };
              
              callback(null, { user });
            });
          })
          .catch(fault => callback(fault));
      },
      
      UpdateUser: function(args, callback) {
        const { token, userId, name, email, password, timezone } = args;
        
        // Validate token and ownership
        validateToken(token)
          .then(userAuth => {
            // Check ownership
            if (userAuth.id !== userId) {
              return callback({
                Fault: {
                  Code: {
                    Value: 'soap:Client',
                    Subcode: { Value: 'Forbidden' }
                  },
                  Reason: { Text: 'You can only modify your own data' }
                }
              });
            }
            
            if (!name && !email && !password && !timezone) {
              return callback({
                Fault: {
                  Code: {
                    Value: 'soap:Client',
                    Subcode: { Value: 'BadRequest' }
                  },
                  Reason: { Text: 'At least one field is required' }
                }
              });
            }
            
            if (email && !isValidEmail(email)) {
              return callback({
                Fault: {
                  Code: {
                    Value: 'soap:Client',
                    Subcode: { Value: 'BadRequest' }
                  },
                  Reason: { Text: 'Invalid email format' }
                }
              });
            }
            
            const fields = [];
            const values = [];
            
            if (name) {
              fields.push('name = ?');
              values.push(name);
            }
            if (email) {
              fields.push('email = ?');
              values.push(email);
            }
            if (password) {
              fields.push('password = ?');
              values.push(password);
            }
            if (timezone) {
              fields.push('timezone = ?');
              values.push(timezone);
            }
            
            values.push(userId);
            
            const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
            
            db.run(query, values, function(err) {
              if (err) {
                return callback({
                  Fault: {
                    Code: {
                      Value: 'soap:Server',
                      Subcode: { Value: 'DatabaseError' }
                    },
                    Reason: { Text: 'Database error' }
                  }
                });
              }
              
              if (this.changes === 0) {
                return callback({
                  Fault: {
                    Code: {
                      Value: 'soap:Client',
                      Subcode: { Value: 'NotFound' }
                    },
                    Reason: { Text: 'User not found' }
                  }
                });
              }
              
              // Return updated user info
              const user = {
                id: userId,
                name: name || userAuth.name,
                email: email || userAuth.email,
                timezone: timezone || userAuth.timezone
              };
              
              callback(null, { user });
            });
          })
          .catch(fault => callback(fault));
      },
      
      DeleteUser: function(args, callback) {
        const { token, userId } = args;
        
        // Validate token and ownership
        validateToken(token)
          .then(userAuth => {
            // Check ownership
            if (userAuth.id !== userId) {
              return callback({
                Fault: {
                  Code: {
                    Value: 'soap:Client',
                    Subcode: { Value: 'Forbidden' }
                  },
                  Reason: { Text: 'You can only delete your own account' }
                }
              });
            }
            
            db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
              if (err) {
                return callback({
                  Fault: {
                    Code: {
                      Value: 'soap:Server',
                      Subcode: { Value: 'DatabaseError' }
                    },
                    Reason: { Text: 'Database error' }
                  }
                });
              }
              
              if (this.changes === 0) {
                return callback({
                  Fault: {
                    Code: {
                      Value: 'soap:Client',
                      Subcode: { Value: 'NotFound' }
                    },
                    Reason: { Text: 'User not found' }
                  }
                });
              }
              
              callback(null, { success: true });
            });
          })
          .catch(fault => callback(fault));
      },
      
      // Authentication Operations
      CreateSession: function(args, callback) {
        const { email, password } = args;
        
        if (!email || !password) {
          return callback({
            Fault: {
              Code: {
                Value: 'soap:Client',
                Subcode: { Value: 'BadRequest' }
              },
              Reason: { Text: 'Email and password are required' }
            }
          });
        }
        
        db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
          if (err) {
            return callback({
              Fault: {
                Code: {
                  Value: 'soap:Server',
                  Subcode: { Value: 'DatabaseError' }
                },
                Reason: { Text: 'Database error' }
              }
            });
          }
          
          if (!user || user.password !== password) {
            return callback({
              Fault: {
                Code: {
                  Value: 'soap:Client',
                  Subcode: { Value: 'Unauthorized' }
                },
                Reason: { Text: 'Invalid credentials' }
              }
            });
          }
          
          // Generate token
          const token = crypto.randomBytes(32).toString('hex');
          
          // Save token in database
          db.run('UPDATE users SET token = ? WHERE id = ?', [token, user.id], (err) => {
            if (err) {
              return callback({
                Fault: {
                  Code: {
                    Value: 'soap:Server',
                    Subcode: { Value: 'DatabaseError' }
                  },
                  Reason: { Text: 'Database error' }
                }
              });
            }
            
            callback(null, { token, user: { 
              id: user.id,
              name: user.name,
              email: user.email,
              timezone: user.timezone
            }});
          });
        });
      },
      
      DeleteSession: function(args, callback) {
        const { token } = args;
        
        if (!token) {
          return callback({
            Fault: {
              Code: {
                Value: 'soap:Client',
                Subcode: { Value: 'BadRequest' }
              },
              Reason: { Text: 'No token provided' }
            }
          });
        }
        
        db.run('UPDATE users SET token = NULL WHERE token = ?', [token], (err) => {
          if (err) {
            return callback({
              Fault: {
                Code: {
                  Value: 'soap:Server',
                  Subcode: { Value: 'DatabaseError' }
                },
                Reason: { Text: 'Database error' }
              }
            });
          }
          
          callback(null, { message: 'Logout successful' });
        });
      },
      
      // Events Operations
      CreateEvent: function(args, callback) {
        const { token, event } = args;
        
        validateToken(token)
          .then(user => {
            if (!event.name || !event.duration) {
              return callback({
                Fault: {
                  Code: {
                    Value: 'soap:Client',
                    Subcode: { Value: 'BadRequest' }
                  },
                  Reason: { Text: 'Name and duration are required' }
                }
              });
            }
            
            if (event.color && !isValidHexColor(event.color)) {
              return callback({
                Fault: {
                  Code: {
                    Value: 'soap:Client',
                    Subcode: { Value: 'BadRequest' }
                  },
                  Reason: { Text: 'Color must be a valid hex color (e.g., #FF0000)' }
                }
              });
            }
            
            const id = Date.now().toString();
            const userId = user.id;
            
            db.run(
              'INSERT INTO events (id, name, duration, description, color, userId) VALUES (?, ?, ?, ?, ?, ?)',
              [id, event.name, event.duration, event.description, event.color, userId],
              (err) => {
                if (err) {
                  return callback({
                    Fault: {
                      Code: {
                        Value: 'soap:Server',
                        Subcode: { Value: 'DatabaseError' }
                      },
                      Reason: { Text: 'Database error' }
                    }
                  });
                }
                
                event.id = id;
                event.userId = userId;
                
                callback(null, { event });
              }
            );
          })
          .catch(fault => callback(fault));
      },
      
      GetEvents: function(args, callback) {
        const { token } = args;
        
        validateToken(token)
          .then(user => {
            db.all(
              'SELECT * FROM events WHERE userId = ?',
              [user.id],
              (err, rows) => {
                if (err) {
                  return callback({
                    Fault: {
                      Code: {
                        Value: 'soap:Server',
                        Subcode: { Value: 'DatabaseError' }
                      },
                      Reason: { Text: 'Database error' }
                    }
                  });
                }
                
                callback(null, { events: rows });
              }
            );
          })
          .catch(fault => callback(fault));
      },
      
      GetEvent: function(args, callback) {
        const { token, eventId } = args;
        
        validateToken(token)
          .then(user => {
            db.get('SELECT * FROM events WHERE id = ?', [eventId], (err, event) => {
              if (err) {
                return callback({
                  Fault: {
                    Code: {
                      Value: 'soap:Server',
                      Subcode: { Value: 'DatabaseError' }
                    },
                    Reason: { Text: 'Database error' }
                  }
                });
              }
              
              if (!event) {
                return callback({
                  Fault: {
                    Code: {
                      Value: 'soap:Client',
                      Subcode: { Value: 'NotFound' }
                    },
                    Reason: { Text: 'Event not found' }
                  }
                });
              }
              
              // Add isOwner flag
              event.isOwner = event.userId === user.id;
              
              callback(null, { event });
            });
          })
          .catch(fault => callback(fault));
      },
      
      UpdateEvent: function(args, callback) {
        const { token, eventId, name, duration, description, color } = args;
        
        validateToken(token)
          .then(user => {
            // Verify event ownership
            db.get('SELECT * FROM events WHERE id = ?', [eventId], (err, event) => {
              if (err) {
                return callback({
                  Fault: {
                    Code: {
                      Value: 'soap:Server',
                      Subcode: { Value: 'DatabaseError' }
                    },
                    Reason: { Text: 'Database error' }
                  }
                });
              }
              
              if (!event) {
                return callback({
                  Fault: {
                    Code: {
                      Value: 'soap:Client',
                      Subcode: { Value: 'NotFound' }
                    },
                    Reason: { Text: 'Event not found' }
                  }
                });
              }
              
              if (event.userId !== user.id) {
                return callback({
                  Fault: {
                    Code: {
                      Value: 'soap:Client',
                      Subcode: { Value: 'Forbidden' }
                    },
                    Reason: { Text: 'You can only modify your own events' }
                  }
                });
              }
              
              if (!name && !duration && !description && !color) {
                return callback({
                  Fault: {
                    Code: {
                      Value: 'soap:Client',
                      Subcode: { Value: 'BadRequest' }
                    },
                    Reason: { Text: 'At least one field is required' }
                  }
                });
              }
              
              if (color && !isValidHexColor(color)) {
                return callback({
                  Fault: {
                    Code: {
                      Value: 'soap:Client',
                      Subcode: { Value: 'BadRequest' }
                    },
                    Reason: { Text: 'Color must be a valid hex color (e.g., #FF0000)' }
                  }
                });
              }
              
              const fields = [];
              const values = [];
              
              if (name) {
                fields.push('name = ?');
                values.push(name);
              }
              if (duration) {
                fields.push('duration = ?');
                values.push(duration);
              }
              if (description !== undefined) {
                fields.push('description = ?');
                values.push(description);
              }
              if (color) {
                fields.push('color = ?');
                values.push(color);
              }
              
              values.push(eventId);
              
              const query = `UPDATE events SET ${fields.join(', ')} WHERE id = ?`;
              
              db.run(query, values, function(err) {
                if (err) {
                  return callback({
                    Fault: {
                      Code: {
                        Value: 'soap:Server',
                        Subcode: { Value: 'DatabaseError' }
                      },
                      Reason: { Text: 'Database error' }
                    }
                  });
                }
                
                // Return updated event info
                const updatedEvent = {
                  id: eventId,
                  name: name || event.name,
                  duration: duration || event.duration,
                  description: description !== undefined ? description : event.description,
                  color: color || event.color,
                  userId: user.id
                };
                
                callback(null, { event: updatedEvent });
              });
            });
          })
          .catch(fault => callback(fault));
      },
      
      DeleteEvent: function(args, callback) {
        const { token, eventId } = args;
        
        validateToken(token)
          .then(user => {
            // Verify event ownership
            db.get('SELECT * FROM events WHERE id = ?', [eventId], (err, event) => {
              if (err) {
                return callback({
                  Fault: {
                    Code: {
                      Value: 'soap:Server',
                      Subcode: { Value: 'DatabaseError' }
                    },
                    Reason: { Text: 'Database error' }
                  }
                });
              }
              
              if (!event) {
                return callback({
                  Fault: {
                    Code: {
                      Value: 'soap:Client',
                      Subcode: { Value: 'NotFound' }
                    },
                    Reason: { Text: 'Event not found' }
                  }
                });
              }
              
              if (event.userId !== user.id) {
                return callback({
                  Fault: {
                    Code: {
                      Value: 'soap:Client',
                      Subcode: { Value: 'Forbidden' }
                    },
                    Reason: { Text: 'You can only delete your own events' }
                  }
                });
              }
              
              db.run('DELETE FROM events WHERE id = ?', [eventId], function(err) {
                if (err) {
                  return callback({
                    Fault: {
                      Code: {
                        Value: 'soap:Server',
                        Subcode: { Value: 'DatabaseError' }
                      },
                      Reason: { Text: 'Database error' }
                    }
                  });
                }
                
                callback(null, { success: true });
              });
            });
          })
          .catch(fault => callback(fault));
      },
      
      // Schedules Operations
      CreateSchedule: function(args, callback) {
        const { token, schedule } = args;
        
        validateToken(token)
          .then(user => {
            if (!schedule.userId || !schedule.availability) {
              return callback({
                Fault: {
                  Code: {
                    Value: 'soap:Client',
                    Subcode: { Value: 'BadRequest' }
                  },
                  Reason: { Text: 'UserId and availability are required' }
                }
              });
            }
            
            // Check if user is creating schedule for themselves
            if (schedule.userId !== user.id) {
              return callback({
                Fault: {
                  Code: {
                    Value: 'soap:Client',
                    Subcode: { Value: 'Forbidden' }
                  },
                  Reason: { Text: 'You can only create schedules for yourself' }
                }
              });
            }
            
            // Convert availability to JSON string for database storage
            const availabilityJson = JSON.stringify(schedule.availability);
            
            db.run(
              'INSERT INTO schedules (userId, availability) VALUES (?, ?)',
              [schedule.userId, availabilityJson],
              function(err) {
                if (err) {
                  return callback({
                    Fault: {
                      Code: {
                        Value: 'soap:Server',
                        Subcode: { Value: 'DatabaseError' }
                      },
                      Reason: { Text: 'Database error' }
                    }
                  });
                }
                
                // Set ID in response
                schedule.id = this.lastID;
                
                callback(null, { schedule });
              }
            );
          })
          .catch(fault => callback(fault));
      },
      
      GetSchedules: function(args, callback) {
        const { token } = args;
        
        validateToken(token)
          .then(user => {
            db.all(
              'SELECT * FROM schedules WHERE userId = ?',
              [user.id],
              (err, rows) => {
                if (err) {
                  return callback({
                    Fault: {
                      Code: {
                        Value: 'soap:Server',
                        Subcode: { Value: 'DatabaseError' }
                      },
                      Reason: { Text: 'Database error' }
                    }
                  });
                }
                
                // Parse availability for each schedule
                try {
                  const schedules = rows.map(row => ({
                    id: row.id,
                    userId: row.userId,
                    availability: JSON.parse(row.availability)
                  }));
                  
                  callback(null, { schedules });
                } catch (parseError) {
                  return callback({
                    Fault: {
                      Code: {
                        Value: 'soap:Server',
                        Subcode: { Value: 'ParsingError' }
                      },
                      Reason: { Text: 'Failed to parse availability data' }
                    }
                  });
                }
              }
            );
          })
          .catch(fault => callback(fault));
      },
      
      GetSchedule: function(args, callback) {
        const { userId } = args;
        
        // No authentication required for this endpoint (public view)
        db.get(
          'SELECT * FROM schedules WHERE userId = ?',
          [userId],
          (err, row) => {
            if (err) {
              return callback({
                Fault: {
                  Code: {
                    Value: 'soap:Server',
                    Subcode: { Value: 'DatabaseError' }
                  },
                  Reason: { Text: 'Database error' }
                }
              });
            }
            
            if (!row) {
              return callback({
                Fault: {
                  Code: {
                    Value: 'soap:Client',
                    Subcode: { Value: 'NotFound' }
                  },
                  Reason: { Text: 'Schedule not found' }
                }
              });
            }
            
            // Parse availability
            try {
              const schedule = {
                id: row.id,
                userId: row.userId,
                availability: JSON.parse(row.availability)
              };
              
              callback(null, { schedule });
            } catch (parseError) {
              return callback({
                Fault: {
                  Code: {
                    Value: 'soap:Server',
                    Subcode: { Value: 'ParsingError' }
                  },
                  Reason: { Text: 'Failed to parse availability data' }
                }
              });
            }
          }
        );
      },
      
      UpdateSchedule: function(args, callback) {
        const { token, userId, availability } = args;
        
        validateToken(token)
          .then(user => {
            // Check ownership
            if (user.id !== userId) {
              return callback({
                Fault: {
                  Code: {
                    Value: 'soap:Client',
                    Subcode: { Value: 'Forbidden' }
                  },
                  Reason: { Text: 'You can only update your own schedule' }
                }
              });
            }
            
            if (!availability) {
              return callback({
                Fault: {
                  Code: {
                    Value: 'soap:Client',
                    Subcode: { Value: 'BadRequest' }
                  },
                  Reason: { Text: 'Availability is required' }
                }
              });
            }
            
            // Convert availability to JSON string
            const availabilityJson = JSON.stringify(availability);
            
            db.run(
              'UPDATE schedules SET availability = ? WHERE userId = ?',
              [availabilityJson, userId],
              function(err) {
                if (err) {
                  return callback({
                    Fault: {
                      Code: {
                        Value: 'soap:Server',
                        Subcode: { Value: 'DatabaseError' }
                      },
                      Reason: { Text: 'Database error' }
                    }
                  });
                }
                
                if (this.changes === 0) {
                  // If schedule doesn't exist yet, create it
                  db.run(
                    'INSERT INTO schedules (userId, availability) VALUES (?, ?)',
                    [userId, availabilityJson],
                    function(err) {
                      if (err) {
                        return callback({
                          Fault: {
                            Code: {
                              Value: 'soap:Server',
                              Subcode: { Value: 'DatabaseError' }
                            },
                            Reason: { Text: 'Database error' }
                          }
                        });
                      }
                      
                      // Return updated schedule
                      const schedule = {
                        id: this.lastID,
                        userId,
                        availability
                      };
                      
                      callback(null, { schedule });
                    }
                  );
                } else {
                  // Get the updated schedule from the database to return
                  db.get(
                    'SELECT * FROM schedules WHERE userId = ?',
                    [userId],
                    (err, row) => {
                      if (err || !row) {
                        return callback({
                          Fault: {
                            Code: {
                              Value: 'soap:Server',
                              Subcode: { Value: 'DatabaseError' }
                            },
                            Reason: { Text: 'Database error' }
                          }
                        });
                      }
                      
                      try {
                        const schedule = {
                          id: row.id,
                          userId: row.userId,
                          availability: JSON.parse(row.availability)
                        };
                        
                        callback(null, { schedule });
                      } catch (parseError) {
                        return callback({
                          Fault: {
                            Code: {
                              Value: 'soap:Server',
                              Subcode: { Value: 'ParsingError' }
                            },
                            Reason: { Text: 'Failed to parse availability data' }
                          }
                        });
                      }
                    }
                  );
                }
              }
            );
          })
          .catch(fault => callback(fault));
      },
      
      DeleteSchedule: function(args, callback) {
        const { token, userId } = args;
        
        validateToken(token)
          .then(user => {
            // Check ownership
            if (user.id !== userId) {
              return callback({
                Fault: {
                  Code: {
                    Value: 'soap:Client',
                    Subcode: { Value: 'Forbidden' }
                  },
                  Reason: { Text: 'You can only delete your own schedule' }
                }
              });
            }
            
            db.run(
              'DELETE FROM schedules WHERE userId = ?',
              [userId],
              function(err) {
                if (err) {
                  return callback({
                    Fault: {
                      Code: {
                        Value: 'soap:Server',
                        Subcode: { Value: 'DatabaseError' }
                      },
                      Reason: { Text: 'Database error' }
                    }
                  });
                }
                
                if (this.changes === 0) {
                  return callback({
                    Fault: {
                      Code: {
                        Value: 'soap:Client',
                        Subcode: { Value: 'NotFound' }
                      },
                      Reason: { Text: 'Schedule not found' }
                    }
                  });
                }
                
                callback(null, { success: true });
              }
            );
          })
          .catch(fault => callback(fault));
      },
      
      // Appointments Operations
      CreateAppointment: function(args, callback) {
        const { token, appointment } = args;
        
        validateToken(token)
          .then(user => {
            if (!appointment.eventId || !appointment.inviteeEmail || !appointment.startTime || !appointment.endTime) {
              return callback({
                Fault: {
                  Code: {
                    Value: 'soap:Client',
                    Subcode: { Value: 'BadRequest' }
                  },
                  Reason: { Text: 'EventId, inviteeEmail, startTime, and endTime are required' }
                }
              });
            }
            
            if (!isValidEmail(appointment.inviteeEmail)) {
              return callback({
                Fault: {
                  Code: {
                    Value: 'soap:Client',
                    Subcode: { Value: 'BadRequest' }
                  },
                  Reason: { Text: 'Invalid invitee email format' }
                }
              });
            }
            
            // Verify event exists
            db.get('SELECT * FROM events WHERE id = ?', [appointment.eventId], (err, event) => {
              if (err) {
                return callback({
                  Fault: {
                    Code: {
                      Value: 'soap:Server',
                      Subcode: { Value: 'DatabaseError' }
                    },
                    Reason: { Text: 'Database error' }
                  }
                });
              }
              
              if (!event) {
                return callback({
                  Fault: {
                    Code: {
                      Value: 'soap:Client',
                      Subcode: { Value: 'NotFound' }
                    },
                    Reason: { Text: 'Event not found' }
                  }
                });
              }
              
              const id = Date.now().toString();
              const userId = user.id;
              const status = appointment.status || 'scheduled';
              
              db.run(
                'INSERT INTO appointments (id, eventId, userId, inviteeEmail, startTime, endTime, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [id, appointment.eventId, userId, appointment.inviteeEmail, appointment.startTime, appointment.endTime, status],
                (err) => {
                  if (err) {
                    return callback({
                      Fault: {
                        Code: {
                          Value: 'soap:Server',
                          Subcode: { Value: 'DatabaseError' }
                        },
                        Reason: { Text: 'Database error' }
                      }
                    });
                  }
                  
                  // Return the created appointment
                  const createdAppointment = {
                    id,
                    eventId: appointment.eventId,
                    userId,
                    inviteeEmail: appointment.inviteeEmail,
                    startTime: appointment.startTime,
                    endTime: appointment.endTime,
                    status
                  };
                  
                  callback(null, { appointment: createdAppointment });
                }
              );
            });
          })
          .catch(fault => callback(fault));
      },
      
      GetAppointments: function(args, callback) {
        const { token } = args;
        
        validateToken(token)
          .then(user => {
            db.all(
              'SELECT * FROM appointments WHERE userId = ?',
              [user.id],
              (err, rows) => {
                if (err) {
                  return callback({
                    Fault: {
                      Code: {
                        Value: 'soap:Server',
                        Subcode: { Value: 'DatabaseError' }
                      },
                      Reason: { Text: 'Database error' }
                    }
                  });
                }
                
                callback(null, { appointments: rows });
              }
            );
          })
          .catch(fault => callback(fault));
      },
      
      GetAppointment: function(args, callback) {
        const { token, appointmentId } = args;
        
        validateToken(token)
          .then(user => {
            db.get(
              'SELECT * FROM appointments WHERE id = ? AND userId = ?',
              [appointmentId, user.id],
              (err, appointment) => {
                if (err) {
                  return callback({
                    Fault: {
                      Code: {
                        Value: 'soap:Server',
                        Subcode: { Value: 'DatabaseError' }
                      },
                      Reason: { Text: 'Database error' }
                    }
                  });
                }
                
                if (!appointment) {
                  return callback({
                    Fault: {
                      Code: {
                        Value: 'soap:Client',
                        Subcode: { Value: 'NotFound' }
                      },
                      Reason: { Text: 'Appointment not found' }
                    }
                  });
                }
                
                callback(null, { appointment });
              }
            );
          })
          .catch(fault => callback(fault));
      },
      
      UpdateAppointment: function(args, callback) {
        const { token, appointmentId, eventId, inviteeEmail, startTime, endTime, status } = args;
        
        validateToken(token)
          .then(user => {
            // Verify appointment exists and is owned by the user
            db.get(
              'SELECT * FROM appointments WHERE id = ?',
              [appointmentId],
              (err, appointment) => {
                if (err) {
                  return callback({
                    Fault: {
                      Code: {
                        Value: 'soap:Server',
                        Subcode: { Value: 'DatabaseError' }
                      },
                      Reason: { Text: 'Database error' }
                    }
                  });
                }
                
                if (!appointment) {
                  return callback({
                    Fault: {
                      Code: {
                        Value: 'soap:Client',
                        Subcode: { Value: 'NotFound' }
                      },
                      Reason: { Text: 'Appointment not found' }
                    }
                  });
                }
                
                if (appointment.userId !== user.id) {
                  return callback({
                    Fault: {
                      Code: {
                        Value: 'soap:Client',
                        Subcode: { Value: 'Forbidden' }
                      },
                      Reason: { Text: 'You can only modify your own appointments' }
                    }
                  });
                }
                
                if (!eventId && !inviteeEmail && !startTime && !endTime && !status) {
                  return callback({
                    Fault: {
                      Code: {
                        Value: 'soap:Client',
                        Subcode: { Value: 'BadRequest' }
                      },
                      Reason: { Text: 'At least one field is required' }
                    }
                  });
                }
                
                if (inviteeEmail && !isValidEmail(inviteeEmail)) {
                  return callback({
                    Fault: {
                      Code: {
                        Value: 'soap:Client',
                        Subcode: { Value: 'BadRequest' }
                      },
                      Reason: { Text: 'Invalid invitee email format' }
                    }
                  });
                }
                
                // If event ID is being changed, verify it exists
                if (eventId) {
                  db.get('SELECT * FROM events WHERE id = ?', [eventId], (err, event) => {
                    if (err) {
                      return callback({
                        Fault: {
                          Code: {
                            Value: 'soap:Server',
                            Subcode: { Value: 'DatabaseError' }
                          },
                          Reason: { Text: 'Database error' }
                        }
                      });
                    }
                    
                    if (!event) {
                      return callback({
                        Fault: {
                          Code: {
                            Value: 'soap:Client',
                            Subcode: { Value: 'NotFound' }
                          },
                          Reason: { Text: 'Event not found' }
                        }
                      });
                    }
                    
                    // Continue with update
                    updateAppointmentInDb();
                  });
                } else {
                  // Continue with update directly
                  updateAppointmentInDb();
                }
                
                function updateAppointmentInDb() {
                  const fields = [];
                  const values = [];
                  
                  if (eventId) {
                    fields.push('eventId = ?');
                    values.push(eventId);
                  }
                  if (inviteeEmail) {
                    fields.push('inviteeEmail = ?');
                    values.push(inviteeEmail);
                  }
                  if (startTime) {
                    fields.push('startTime = ?');
                    values.push(startTime);
                  }
                  if (endTime) {
                    fields.push('endTime = ?');
                    values.push(endTime);
                  }
                  if (status) {
                    fields.push('status = ?');
                    values.push(status);
                  }
                  
                  values.push(appointmentId);
                  
                  const query = `UPDATE appointments SET ${fields.join(', ')} WHERE id = ?`;
                  
                  db.run(query, values, function(err) {
                    if (err) {
                      return callback({
                        Fault: {
                          Code: {
                            Value: 'soap:Server',
                            Subcode: { Value: 'DatabaseError' }
                          },
                          Reason: { Text: 'Database error' }
                        }
                      });
                    }
                    
                    // Return updated appointment
                    const updatedAppointment = {
                      id: appointmentId,
                      eventId: eventId || appointment.eventId,
                      userId: user.id,
                      inviteeEmail: inviteeEmail || appointment.inviteeEmail,
                      startTime: startTime || appointment.startTime,
                      endTime: endTime || appointment.endTime,
                      status: status || appointment.status
                    };
                    
                    callback(null, { appointment: updatedAppointment });
                  });
                }
              }
            );
          })
          .catch(fault => callback(fault));
      },
      
      DeleteAppointment: function(args, callback) {
        const { token, appointmentId } = args;
        
        validateToken(token)
          .then(user => {
            // Verify appointment exists and is owned by the user
            db.get(
              'SELECT * FROM appointments WHERE id = ?',
              [appointmentId],
              (err, appointment) => {
                if (err) {
                  return callback({
                    Fault: {
                      Code: {
                        Value: 'soap:Server',
                        Subcode: { Value: 'DatabaseError' }
                      },
                      Reason: { Text: 'Database error' }
                    }
                  });
                }
                
                if (!appointment) {
                  return callback({
                    Fault: {
                      Code: {
                        Value: 'soap:Client',
                        Subcode: { Value: 'NotFound' }
                      },
                      Reason: { Text: 'Appointment not found' }
                    }
                  });
                }
                
                if (appointment.userId !== user.id) {
                  return callback({
                    Fault: {
                      Code: {
                        Value: 'soap:Client',
                        Subcode: { Value: 'Forbidden' }
                      },
                      Reason: { Text: 'You can only delete your own appointments' }
                    }
                  });
                }
                
                db.run(
                  'DELETE FROM appointments WHERE id = ?',
                  [appointmentId],
                  function(err) {
                    if (err) {
                      return callback({
                        Fault: {
                          Code: {
                            Value: 'soap:Server',
                            Subcode: { Value: 'DatabaseError' }
                          },
                          Reason: { Text: 'Database error' }
                        }
                      });
                    }
                    
                    callback(null, { success: true });
                  }
                );
              }
            );
          })
          .catch(fault => callback(fault));
      }
    }
  }
};

// Read WSDL file
const wsdlPath = path.join(__dirname, './wsdl/calendly-soap-service.wsdl');
const wsdl = fs.readFileSync(wsdlPath, 'utf8');

// Create SOAP server
soap.listen(app, '/soap', service, wsdl);

const PORT = process.env.SOAP_PORT || 3001;
app.listen(PORT, () => {
  console.log(`SOAP Service running at http://localhost:${PORT}/soap`);
  console.log(`View WSDL file at http://localhost:${PORT}/wsdl`);
});

module.exports = app;